import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import mariadb from "mariadb";
import { SignJWT } from "jose";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const [mode, directory, container, ...extra] = process.argv.slice(2);
assert(["prepare", "baseline", "services", "http", "constraints"].includes(mode));
assert(path.isAbsolute(directory) && !path.resolve(directory).startsWith(process.cwd() + path.sep));
const url = new URL(process.env.DATABASE_URL);
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const database = url.pathname.slice(1);
assert(/^e06_rehearsal_[a-z0-9_]{1,24}$/.test(database));
const stateFile = path.join(directory, `${database}.json`);
const contractFile = path.join(directory, `${database}-contracts.json`);
// Nunca enviar correos ni cargar claves de pago en el servidor del ensayo HTTP.
for (const name of ["SMTP_HOST", "SMTP_PASS", "SMTP_USER", "STORE_EMAIL"]) process.env[name] = "";
const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
let applicationClient, server;
let serverLog = "", checks = 0;
const check = async (label, callback) => { await callback(); checks++; console.log(`OK ${label}`); };
const dockerArgs = ["exec", "-i", "-e", `MYSQL_PWD=${decodeURIComponent(url.password)}`, container];
function sql(target, input) {
  assert(/^e06_rehearsal_[a-z0-9_]+$/.test(target));
  return spawnSync("docker", [...dockerArgs, "mariadb", `-u${decodeURIComponent(url.username)}`, target], { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}
function dump(target) {
  assert(/^e0[56]_rehearsal_[a-z0-9_]+$/.test(target));
  const result = spawnSync("docker", [...dockerArgs, "mariadb-dump", `-u${decodeURIComponent(url.username)}`, "--single-transaction", "--routines", "--triggers", "--skip-comments", target], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
}
async function createCopy(name, backup) {
  assert(/^e06_rehearsal_[a-z0-9_]+$/.test(name));
  const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
  try { await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); }
  finally { await connection.end(); }
  const restored = sql(name, backup); assert.equal(restored.status, 0, restored.stderr);
}
const shape = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return { array: [...new Set(value.map((item) => JSON.stringify(shape(item))))].sort() };
  if (typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  return typeof value;
};
function request(port, host, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: target, method: options.method ?? "GET", headers: { host, "content-type": "application/json", ...options.headers }, timeout: 40_000 }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("HTTP timeout")));
    req.end(options.body === undefined ? undefined : JSON.stringify(options.body));
  });
}
async function api(port, host, target, expected = 200, options = {}) {
  const response = await request(port, host, target, options);
  assert.equal(response.status, expected, `${host}${target}: ${response.status} ${response.text}`);
  assert.match(response.headers["cache-control"], /private.*no-store/);
  return { ...response, body: JSON.parse(response.text) };
}
const storeSnapshot = (storeId) => Promise.all([
  raw.product.findMany({ where: { storeId }, orderBy: { id: "asc" } }), raw.productVariant.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
  raw.order.findMany({ where: { storeId }, include: { payments: { orderBy: { id: "asc" } }, items: { orderBy: { id: "asc" } }, events: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } }),
  raw.discountCode.findMany({ where: { storeId }, orderBy: { id: "asc" } }), raw.discountRedemption.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
]);

try {
  const { resolveStoreContext, runWithStoreContext } = await import("../src/lib/server/store-context.ts");
  if (mode === "prepare") {
    const [source, first, second] = extra;
    assert(/^e05_rehearsal_[a-z0-9_]+$/.test(source));
    await fs.mkdir(directory, { recursive: true });
    const backup = dump(source);
    await fs.writeFile(path.join(directory, `${database}-source.sql`), backup, { flag: "wx" });
    await createCopy(database, backup);
    const contexts = await Promise.all([first, second].map((host) => resolveStoreContext(raw, new Headers({ host }), { environment: "production" })));
    const stores = contexts.map((context) => context.id);
    const users = await raw.user.findMany({ orderBy: { id: "asc" } }); assert.equal(users.length, 2);
    const admin = users.find((user) => user.email === "admin@variedadeslosprimos.com"); assert(admin);
    const legacy = sql(database, `
      INSERT INTO orders (id,code,storeId,userId,email,phone,shippingName,street,city,state,zip,subtotal,total,updatedAt) VALUES
      ('e06-legacy','E06-LEGACY','${stores[0]}','${admin.id}','','','E06','','','','',100,100,NOW(3));
      INSERT INTO payments (id,storeId,orderId,method,status,amount,reference,createdAt) VALUES
      ('e06-legacy-p1','${stores[0]}','e06-legacy','WOMPI','FAILED',100,'E06-LEGACY-TX1','2026-11-10 00:00:00'),
      ('e06-legacy-p2','${stores[0]}','e06-legacy','WOMPI','PENDING',100,NULL,'2026-11-11 00:00:00');
    `); assert.equal(legacy.status, 0, legacy.stderr);
    const beforeMigration = dump(database);
    await fs.writeFile(path.join(directory, `${database}-before-migration.sql`), beforeMigration, { flag: "wx" });
    const migration = await fs.readFile("prisma/migrations/20261113000000_payment_isolation/migration.sql", "utf8");
    await check("preflight bloquea intentos históricos ambiguos antes del DDL", async () => {
      await createCopy(database + "_bad", beforeMigration);
      assert.equal(sql(database + "_bad", "UPDATE payments SET createdAt='2026-11-10 00:00:00' WHERE id='e06-legacy-p2';").status, 0);
      const failed = sql(database + "_bad", migration); assert.notEqual(failed.status, 0); assert.match(failed.stderr, /CONSTRAINT/);
      const columns = sql(database + "_bad", "SHOW COLUMNS FROM orders LIKE 'inventoryRestoredAt';"); assert.equal(columns.stdout.trim(), "");
    });
    await check("migración aditiva ensayada en copia y referencias históricas conservadas", async () => {
      const migrated = sql(database, migration); assert.equal(migrated.status, 0, migrated.stderr);
      const payments = await raw.payment.findMany({ where: { orderId: "e06-legacy" }, orderBy: { id: "asc" } });
      assert.deepEqual(payments.map((payment) => payment.gatewayReference), ["E06-LEGACY", "E06-LEGACY-R2"]);
      assert.equal(payments[0].gatewayTransactionId, "E06-LEGACY-TX1");
    });
    await check("restauración del respaldo en otra copia recupera esquema anterior", async () => {
      await createCopy(database + "_rollback", beforeMigration);
      const columns = sql(database + "_rollback", "SHOW COLUMNS FROM payments LIKE 'gatewayReference';"); assert.equal(columns.stdout.trim(), "");
      assert.match(sql(database + "_rollback", "SELECT COUNT(*) FROM payments WHERE orderId='e06-legacy';").stdout, /2/);
    });
    for (const [index, storeId] of stores.entries()) {
      const tag = index ? "B" : "A";
      await raw.category.create({ data: { storeId, slug: "e06-shared", name: `E06 ${tag}`, icon: "Store", gradient: "bg-primary" } });
      for (const kind of ["main", "variant", "race", "zero", "rollback", "baseline"]) {
        await raw.product.create({ data: { id: `e06-${tag}-${kind}`, storeId, slug: `e06-${kind}`, name: `E06 ${tag} ${kind}`, brand: `E06 ${tag}`, categorySlug: "e06-shared", price: 100, cost: 15, shippingCost: 0, stock: kind === "zero" ? 0 : kind === "race" ? 1 : 30 } });
      }
      await raw.productVariant.create({ data: { id: `e06-${tag}-v`, storeId, productId: `e06-${tag}-variant`, name: `E06 ${tag} variante`, stock: 30 } });
      await raw.discountCode.create({ data: { id: `e06-${tag}-discount`, storeId, code: "E06-SHARED", type: "PERCENT", value: index ? 20 : 10 } });
      await raw.discountCode.create({ data: { id: `e06-${tag}-once`, storeId, code: `E06-${tag}-ONCE`, type: "FIXED", value: 5, usageLimit: 1 } });
      await raw.discountCode.create({ data: { id: `e06-${tag}-gift`, storeId, code: `E06-${tag}-GIFT`, type: "GIFT_CARD", value: 100, balance: 100 } });
    }
    await fs.writeFile(stateFile, JSON.stringify({ stores, hosts: [first, second], userIds: users.map((user) => user.id), adminId: admin.id, source, backupSha256: createHash("sha256").update(beforeMigration).digest("hex") }, null, 2), { flag: "wx" });
    console.log(`ROLLBACK: no se desplegó fuera de copias. Respaldo ${database}-before-migration.sql SHA256 ${createHash("sha256").update(beforeMigration).digest("hex")}. Restauración verificada en ${database}_rollback. Para un despliegue: detener escrituras, respaldar y confirmar restauración humana; no borrar columnas con nuevos cobros.`);
  } else {
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const contexts = await Promise.all(state.hosts.map((host) => resolveStoreContext(raw, new Headers({ host }), { environment: "production" })));
    if (mode === "constraints") {
      const wompi = await import("../src/lib/server/wompi.ts");
      const { restockOrderOnce } = await import("../src/lib/server/stock.ts");
      applicationClient = (await import("../src/lib/prisma.ts")).prisma;
      await check("SQL impide reutilizar referencia/id del proveedor y enlazar un pago a otra tienda", async () => {
        const payment = await raw.payment.findUniqueOrThrow({ where: { gatewayReference: "E06-WOMPI-A-PAID" } });
        const count = await raw.payment.count();
        const data = { storeId: payment.storeId, orderId: payment.orderId, method: "WOMPI", amount: payment.amount };
        await assert.rejects(raw.payment.create({ data: { ...data, gatewayReference: payment.gatewayReference } }), { code: "P2002" });
        await assert.rejects(raw.payment.create({ data: { ...data, gatewayReference: "E06-UNUSED-ID", gatewayTransactionId: payment.gatewayTransactionId } }), { code: "P2002" });
        await assert.rejects(raw.payment.create({ data: { ...data, storeId: state.stores[1], gatewayReference: "E06-INVALID-STORE" } }), { code: "P2003" });
        assert.equal(await raw.payment.count(), count);
      });
      await check("colación SQL no permite conciliar una referencia con mayúsculas alteradas", async () => {
        const before = await storeSnapshot(state.stores[0]);
        const transaction = { id: "E06-TX-A-PAID", reference: "e06-wompi-a-paid", status: "APPROVED", amount_in_cents: 20000, currency: "COP" };
        assert.equal(await runWithStoreContext(contexts[0], () => wompi.applyWompiTransaction(transaction)), null);
        assert.deepEqual(await storeSnapshot(state.stores[0]), before);
      });
      await check("snapshot histórico con cantidad inválida no repone ni deja marca parcial", async () => {
        const storeId = state.stores[0]; const id = "E06-INVALID-QTY";
        await raw.order.create({ data: { id, code: id, storeId, email: "", phone: "", shippingName: "E06", street: "", city: "", state: "", zip: "", subtotal: 0, total: 0 } });
        await raw.orderItem.create({ data: { storeId, orderId: id, productId: "e06-A-main", name: "E06 inválido", brand: "E06", unitPrice: 0, qty: 0 } });
        const stock = (await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock;
        await assert.rejects(runWithStoreContext(contexts[0], () => restockOrderOnce(id)), { status: 409 });
        assert.equal((await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock, stock);
        assert.equal((await raw.order.findUniqueOrThrow({ where: { id } })).inventoryRestoredAt, null);
      });
    } else if (mode === "services") {
      const wompi = await import("../src/lib/server/wompi.ts");
      const { createWompiWebhookHandler } = await import("../src/lib/server/wompi-webhook.ts");
      const { reserveOrderStock } = await import("../src/lib/server/stock.ts");
      applicationClient = (await import("../src/lib/prisma.ts")).prisma;
      const eventsSecret = randomBytes(32).toString("hex");
      const transactions = new Map();
      let lookups = 0;
      const handler = createWompiWebhookHandler({ verify: (event) => wompi.verifyWompiEvent(event, eventsSecret), environment: () => "test", load: async (id) => { lookups++; return transactions.get(id) ?? null; }, apply: wompi.applyWompiWebhookTransaction });
      const eventFor = (transaction, properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"]) => {
        const event = { event: "transaction.updated", environment: "test", data: { transaction }, timestamp: Math.floor(Date.now() / 1000), signature: { properties, checksum: "" } };
        const values = properties.map((property) => property.split(".").reduce((value, key) => value[key], event.data)).join("");
        event.signature.checksum = createHash("sha256").update(`${values}${event.timestamp}${eventsSecret}`).digest("hex"); return event;
      };
      const deliver = (event, host = state.hosts[1]) => handler(new Request(`https://${host}/api/webhooks/wompi`, { method: "POST", headers: { host, "content-type": "application/json", "x-store-id": state.stores[1] }, body: JSON.stringify(event) }));
      const pending = async (tag, suffix, attempts = 1) => {
        const index = tag === "A" ? 0 : 1; const storeId = state.stores[index]; const code = `E06-WOMPI-${tag}-${suffix}`;
        await runWithStoreContext(contexts[index], () => applicationClient.$transaction(async (tx) => {
          await reserveOrderStock(tx, [{ productId: `e06-${tag}-main`, variantId: null, qty: 2 }]);
          await tx.order.create({ data: { id: code, storeId, code, userId: state.adminId, email: "", phone: "", shippingName: "E06", street: "", city: "", state: "", zip: "", subtotal: 200, total: 200 } });
          await tx.orderItem.create({ data: { storeId, orderId: code, productId: `e06-${tag}-main`, name: `E06 ${tag}`, brand: "E06", qty: 2, unitPrice: 100 } });
          for (let attempt = 1; attempt <= attempts; attempt++) await tx.payment.create({ data: { storeId, orderId: code, method: "WOMPI", amount: 200, gatewayReference: wompi.buildPaymentReference(code, attempt) } });
        }));
        return { id: `E06-TX-${tag}-${suffix}`, reference: code, status: "APPROVED", amount_in_cents: 20000, currency: "COP", payment_method_type: "CARD" };
      };
      const a = await pending("A", "PAID"); const b = await pending("B", "PAID"); transactions.set(a.id, a); transactions.set(b.id, b);
      await check("firma dinámica, campos alterados, checksum y entradas malformadas", async () => {
        assert(wompi.verifyWompiEvent(eventFor(a), eventsSecret));
        for (const input of [null, [], {}, { ...eventFor(a), timestamp: null }, { ...eventFor(a), signature: { properties: [], checksum: "" } }]) assert.equal(wompi.verifyWompiEvent(input, eventsSecret), false);
        for (const key of ["status", "amount_in_cents", "id"]) {
          const event = eventFor(a); event.data.transaction = { ...a, [key]: key === "amount_in_cents" ? 1 : "ALTERADO" };
          assert.equal((await deliver(event)).status, 401);
        }
        assert.equal(lookups, 0);
        assert.equal(wompi.orderCodeFromReference("VLP-10235-R2"), "VLP-10235");
      });
      await check("webhook A con Host B concilia únicamente referencia persistida A", async () => {
        const beforeB = await storeSnapshot(state.stores[1]);
        assert.equal((await deliver(eventFor(a))).status, 200);
        assert.equal((await raw.order.findUniqueOrThrow({ where: { code: a.reference } })).status, "PAID");
        assert.deepEqual(await storeSnapshot(state.stores[1]), beforeB);
      });
      await check("referencia no firmada manipulada no desvía el pago B a A; Host desconocido no autentica", async () => {
        const beforeA = await storeSnapshot(state.stores[0]);
        const event = eventFor(b); event.data.transaction = { ...b, reference: a.reference, currency: "USD" };
        assert.equal((await deliver(event, "unrecognized")).status, 200);
        assert.equal((await raw.order.findUniqueOrThrow({ where: { code: b.reference } })).status, "PAID");
        assert.deepEqual(await storeSnapshot(state.stores[0]), beforeA);
        assert.equal(await runWithStoreContext(contexts[0], () => wompi.applyWompiTransaction(b)), null);
      });
      await check("20 eventos concurrentes repetidos no duplican pago, evento PAID ni reposición", async () => {
        const stock = (await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock;
        const responses = await Promise.all(Array.from({ length: 20 }, () => deliver(eventFor(a)))); assert(responses.every((response) => response.status === 200));
        assert.equal(await raw.orderStatusEvent.count({ where: { orderId: a.reference, status: "PAID" } }), 1);
        assert.equal(await raw.payment.count({ where: { orderId: a.reference, status: "COMPLETED" } }), 1);
        assert.equal((await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock, stock);
      });
      const rejected = await pending("A", "FAILED"); transactions.set(rejected.id, { ...rejected, status: "DECLINED" });
      await check("importe/moneda incorrectos no cambian pedido ni stock", async () => {
        const before = await storeSnapshot(state.stores[0]);
        for (const changed of [{ amount_in_cents: 1 }, { currency: "USD" }]) await assert.rejects(runWithStoreContext(contexts[0], () => wompi.applyWompiTransaction({ ...rejected, ...changed })), { status: 409 });
        assert.deepEqual(await storeSnapshot(state.stores[0]), before);
      });
      await check("rechazos concurrentes reponen una vez; aprobación tardía de cancelado falla cerrada", async () => {
        const stock = (await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock;
        const responses = await Promise.all(Array.from({ length: 12 }, () => deliver(eventFor(transactions.get(rejected.id))))); assert(responses.every((response) => response.status === 200));
        assert.equal((await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock, stock + 2);
        assert.equal(await raw.orderStatusEvent.count({ where: { orderId: rejected.reference, status: "CANCELLED" } }), 1);
        assert((await raw.order.findUniqueOrThrow({ where: { code: rejected.reference } })).inventoryRestoredAt);
        await assert.rejects(runWithStoreContext(contexts[0], () => wompi.applyWompiTransaction(rejected)), { status: 409 });
      });
      await check("intento antiguo no cancela intento vigente; referencias inexistentes no hacen fallback", async () => {
        const first = await pending("A", "RETRY", 2);
        await runWithStoreContext(contexts[0], () => wompi.applyWompiTransaction({ ...first, status: "DECLINED" }));
        assert.equal((await raw.order.findUniqueOrThrow({ where: { code: first.reference } })).status, "PENDING");
        const second = { ...first, id: first.id + "-R2", reference: first.reference + "-R2" };
        assert.equal((await runWithStoreContext(contexts[0], () => wompi.applyWompiTransaction(second))).status, "PAID");
        assert.equal(await runWithStoreContext(contexts[0], () => wompi.applyWompiTransaction({ ...first, id: first.id + "-R3", reference: first.reference + "-R3" })), null);
      });
      await check("ambiente, campos firmados mínimos y caída del proveedor fallan cerrados", async () => {
        assert.equal((await deliver({ ...eventFor(a), environment: "prod" })).status, 400);
        assert.equal((await deliver(eventFor(a, ["transaction.currency"])) ).status, 400);
        const unavailable = { ...a, id: "E06-NOT-AVAILABLE" }; assert.equal((await deliver(eventFor(unavailable))).status, 503);
        const missing = { ...a, id: "E06-NO-REFERENCE", reference: "E06-UNKNOWN" }; transactions.set(missing.id, missing);
        assert.equal((await deliver(eventFor(missing))).status, 200);
        assert.equal(await raw.order.count({ where: { code: "E06-UNKNOWN" } }), 0);
      });
      console.log("Wompi local: proveedor sustituido solo en el arnés; NO se ejecutó sandbox ni se configuraron claves ficticias.");
    } else {
      const port = Number(extra[0]); assert(port > 1024 && port < 65536);
      const secret = randomBytes(32).toString("hex");
      const environment = { ...process.env, SESSION_SECRET: secret };
      for (const key of ["WOMPI_PUBLIC_KEY", "WOMPI_PRIVATE_KEY", "WOMPI_EVENTS_SECRET", "WOMPI_INTEGRITY_SECRET"]) environment[key] = "";
      server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: environment, stdio: ["ignore", "pipe", "pipe"] });
      server.stdout.on("data", (data) => { serverLog = (serverLog + data).slice(-6000); }); server.stderr.on("data", (data) => { serverLog = (serverLog + data).slice(-6000); });
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        try { ready = (await request(port, state.hosts[0], "/api/cart")).status === 200; } catch { /* Solo este servidor de ensayo. */ }
        if (ready || server.exitCode !== null) break; await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert(ready, serverLog);
      const tokens = new Map();
      for (const id of state.userIds) {
        const user = await raw.user.findUniqueOrThrow({ where: { id } });
        tokens.set(id, await new SignJWT({ name: user.name, email: user.email, role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret)));
      }
      const call = (index, target, status = 200, body, method = body === undefined ? "GET" : "POST", id = state.adminId) => api(port, state.hosts[index], target, status, { method, body, headers: { cookie: `vlp_session=${tokens.get(id)}`, "x-store-id": state.stores[1 - index] } });
      const checkoutBody = { method: "COD", contact: { name: "E06 ensayo", email: "admin@variedadeslosprimos.com", phone: "0000000" }, shipping: { street: "E06 ensayo", city: "E06", state: "E06", zip: "000", country: "Colombia" } };
      const fillCart = async (index, lines, userId = state.adminId) => {
        const storeId = state.stores[index];
        const cart = await raw.cart.upsert({ where: { storeId_userId: { storeId, userId } }, create: { storeId, userId }, update: {} });
        await raw.cartItem.deleteMany({ where: { storeId, cartId: cart.id } });
        await raw.cartItem.createMany({ data: lines.map(([productId, qty, variantId]) => ({ storeId, cartId: cart.id, productId, qty, variantId: variantId ?? null })) });
      };
      if (mode === "baseline") {
        await raw.product.create({ data: { id: "e06-A-baseline-variant", storeId: state.stores[0], slug: "e06-baseline-variant", name: "E06 A baseline variante", brand: "E06", categorySlug: "e06-shared", price: 100, shippingCost: 0, stock: 0 } });
        await raw.productVariant.create({ data: { id: "e06-A-baseline-v", storeId: state.stores[0], productId: "e06-A-baseline-variant", name: "E06 baseline variante", stock: 10 } });
        await fillCart(0, [["e06-A-baseline", 1], ["e06-A-baseline-variant", 1, "e06-A-baseline-v"]]);
        const checkout = await call(0, "/api/checkout", 201, checkoutBody);
        const code = checkout.body.data.code;
        await fs.writeFile(contractFile, JSON.stringify({ checkout: shape(checkout.body), detail: shape((await call(0, `/api/orders/${code}`)).body), list: shape((await call(0, "/api/orders")).body) }, null, 2), { flag: "wx" });
        console.log("Contratos HTTP E05 capturados mediante COD en la copia E06; sin SMTP ni pagos online.");
      } else {
        const contracts = JSON.parse(await fs.readFile(contractFile, "utf8"));
        let own, other;
        await check("checkout COD A solo consume stock/variante/cupón de A, DTO compatible", async () => {
          await fillCart(0, [["e06-A-main", 2], ["e06-A-variant", 1, "e06-A-v"]]);
          const beforeB = await storeSnapshot(state.stores[1]);
          const stock = (await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock;
          const response = await call(0, "/api/checkout", 201, { ...checkoutBody, discountCode: "E06-SHARED", storeId: state.stores[1], total: 1 });
          own = response.body.data; assert.match(own.code, /^VLP-[A-F0-9]{32}$/); assert.equal(own.total, 270);
          assert.deepEqual(shape(response.body), contracts.checkout);
          assert.equal((await raw.product.findUniqueOrThrow({ where: { id: "e06-A-main" } })).stock, stock - 2);
          assert.equal((await raw.productVariant.findUniqueOrThrow({ where: { id: "e06-A-v" } })).stock, 29);
          assert.deepEqual(await storeSnapshot(state.stores[1]), beforeB);
          assert.equal((await call(0, "/api/cart")).body.data.itemCount, 0);
          const order = await raw.order.findUniqueOrThrow({ where: { code: own.code }, include: { items: true, payments: true, redemptions: true } });
          assert.equal(order.storeId, state.stores[0]); assert(order.items.every((item) => item.storeId === order.storeId));
          assert.equal(order.payments[0].method, "COD"); assert.equal(order.redemptions[0].codeId, "e06-A-discount");
        });
        await check("checkout B usa descuento B; pedidos distintos y APIs no revelan pedido ajeno", async () => {
          await fillCart(1, [["e06-B-main", 1]]); const beforeA = await storeSnapshot(state.stores[0]);
          other = (await call(1, "/api/checkout", 201, { ...checkoutBody, discountCode: "E06-SHARED" })).body.data;
          assert.equal(other.total, 80); assert.notEqual(own.code, other.code);
          assert.deepEqual(await storeSnapshot(state.stores[0]), beforeA);
          await call(0, `/api/orders/${other.code}`, 404); await call(1, `/api/orders/${own.code}`, 404);
          await call(0, `/api/orders/${other.code}/retry-payment`, 404, {});
          assert.deepEqual(shape((await call(0, `/api/orders/${own.code}`)).body), contracts.detail);
          // Las variantes y nulls cambian con los datos; conservar campos de cada fila.
          const list = (await call(0, "/api/orders")).body; assert(list.data.some((item) => item.code === own.code)); assert(!list.data.some((item) => item.code === other.code));
          assert.deepEqual(Object.keys(list.data[0]).sort(), Object.keys(JSON.parse(contracts.list.data.array[0])).sort());
        });
        await check("stock cero y fallo parcial revierten reserva, pedido, cupón y carrito", async () => {
          await fillCart(0, [["e06-A-rollback", 1], ["e06-A-zero", 1]]);
          const before = await storeSnapshot(state.stores[0]); const cart = (await call(0, "/api/cart")).body;
          await call(0, "/api/checkout", 409, { ...checkoutBody, discountCode: "E06-A-ONCE" });
          assert.deepEqual(await storeSnapshot(state.stores[0]), before); assert.deepEqual((await call(0, "/api/cart")).body, cart);
          await call(0, "/api/checkout", 400, { ...checkoutBody, discountCode: "E06-B-ONCE" });
          await call(0, "/api/checkout", 503, { ...checkoutBody, method: "WOMPI" });
          assert.deepEqual(await storeSnapshot(state.stores[0]), before);
        });
        await check("dos compradores compiten por última unidad sin sobreventa", async () => {
          for (const userId of state.userIds) await fillCart(0, [["e06-A-race", 1]], userId);
          const responses = await Promise.all(state.userIds.map((id) => request(port, state.hosts[0], "/api/checkout", { method: "POST", body: checkoutBody, headers: { cookie: `vlp_session=${tokens.get(id)}` } })));
          assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
          assert.equal((await raw.product.findUniqueOrThrow({ where: { id: "e06-A-race" } })).stock, 0);
        });
        await check("dos checkouts concurrentes del mismo carrito crean un único pedido", async () => {
          await fillCart(0, [["e06-A-main", 1]]); const before = await raw.order.count();
          const responses = await Promise.all([0, 1].map(() => request(port, state.hosts[0], "/api/checkout", { method: "POST", body: checkoutBody, headers: { cookie: `vlp_session=${tokens.get(state.adminId)}` } })));
          assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]); assert.equal(await raw.order.count(), before + 1);
        });
        await check("límite y saldo de cupón serializados entre compradores", async () => {
          for (const discountCode of ["E06-A-ONCE", "E06-A-GIFT"]) {
            for (const userId of state.userIds) await fillCart(0, [["e06-A-main", 1]], userId);
            const responses = await Promise.all(state.userIds.map((id) => request(port, state.hosts[0], "/api/checkout", { method: "POST", body: { ...checkoutBody, discountCode }, headers: { cookie: `vlp_session=${tokens.get(id)}` } })));
            assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
          }
          assert.equal((await raw.discountCode.findUniqueOrThrow({ where: { id: "e06-A-once" } })).usedCount, 1);
          assert.equal(Number((await raw.discountCode.findUniqueOrThrow({ where: { id: "e06-A-gift" } })).balance), 0);
        });
        await check("COD entregado completa solo su pago y no duplica evento", async () => {
          const order = await raw.order.findUniqueOrThrow({ where: { code: own.code } }); const beforeB = await storeSnapshot(state.stores[1]);
          for (const repeat of [0, 1]) { void repeat; await call(0, `/api/admin/orders/${order.id}`, 200, { status: "DELIVERED" }, "PATCH"); }
          assert.equal(await raw.payment.count({ where: { orderId: order.id, method: "COD", status: "COMPLETED" } }), 1);
          assert.equal(await raw.orderStatusEvent.count({ where: { orderId: order.id, status: "DELIVERED" } }), 1);
          assert.deepEqual(await storeSnapshot(state.stores[1]), beforeB);
        });
        await check("cancelación administrativa repone una vez y bloquea reactivación", async () => {
          const order = await raw.order.findUniqueOrThrow({ where: { code: other.code } }); const beforeA = await storeSnapshot(state.stores[0]);
          const stock = (await raw.product.findUniqueOrThrow({ where: { id: "e06-B-main" } })).stock;
          for (const repeat of [0, 1]) { void repeat; await call(1, `/api/admin/orders/${order.id}`, 200, { status: "CANCELLED" }, "PATCH"); }
          assert.equal((await raw.product.findUniqueOrThrow({ where: { id: "e06-B-main" } })).stock, stock + 1);
          assert.equal(await raw.orderStatusEvent.count({ where: { orderId: order.id, status: "CANCELLED" } }), 1);
          await call(1, `/api/admin/orders/${order.id}`, 409, { status: "PENDING" }, "PATCH");
          assert.deepEqual(await storeSnapshot(state.stores[0]), beforeA);
        });
        await check("webhook real rechaza firma inválida aunque Host sea desconocido", async () => {
          const response = await request(port, "unrecognized", "/api/webhooks/wompi", { method: "POST", body: {} }); assert.equal(response.status, 401);
          assert.equal((await request(port, "unrecognized", "/api/webhooks/wompi")).status, 404);
          assert.equal((await request(port, "unrecognized", "/api/checkout", { method: "POST", body: checkoutBody })).status, 404);
        });
        await check("páginas de pedido aceptan códigos nuevos y conservan separación A/B", async () => {
          const response = await request(port, state.hosts[0], `/orders/${own.code}`, { headers: { cookie: `vlp_session=${tokens.get(state.adminId)}` } }); assert.equal(response.status, 200);
          assert.equal((await request(port, state.hosts[1], `/orders/${own.code}`, { headers: { cookie: `vlp_session=${tokens.get(state.adminId)}` } })).status, 404);
        });
      }
    }
  }
  console.log(`E06 ${mode}: ${checks} grupos correctos; solo copias ${database}; sandbox real aplazado por el usuario.`);
} finally {
  if (server && server.exitCode === null) { const exited = new Promise((resolve) => server.once("exit", resolve)); server.kill(); await exited; }
  await applicationClient?.$disconnect(); await raw.$disconnect();
}
