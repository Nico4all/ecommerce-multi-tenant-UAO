import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
const { resolveStoreContext, runWithStoreContext } = await import("../src/lib/server/store-context.ts");
const [mode, directory, container, ...extra] = process.argv.slice(2);
assert(["prepare", "baseline", "services", "http"].includes(mode));
assert(path.isAbsolute(directory) && !path.resolve(directory).startsWith(process.cwd() + path.sep));
const url = new URL(process.env.DATABASE_URL);
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const database = url.pathname.slice(1);
assert(/^e05_rehearsal_[a-z0-9_]{1,28}$/.test(database));
const stateFile = path.join(directory, `${database}.json`);
const contractFile = path.join(directory, `${database}-contracts.json`);
const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
let applicationClient;
let server;
let serverLog = "";
let checks = 0;
const check = async (label, callback) => { await callback(); checks++; console.log(`OK ${label}`); };
const cookieName = (id) => `vlp_cart_sid_${createHash("sha256").update(id).digest("hex").slice(0, 24)}`;
const shape = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return { array: [...new Set(value.map((item) => JSON.stringify(shape(item))))].sort() };
  if (typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  return typeof value;
};
function request(port, host, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: target, method: options.method ?? "GET", headers: { host, "content-type": "application/json", ...options.headers }, timeout: 30_000 }, (res) => {
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
const cookiesFrom = (response) => (response.headers["set-cookie"] ?? []).map((value) => value.split(";")[0]);
const headersFor = (...cookies) => ({ cookie: cookies.filter(Boolean).join("; ") });
const post = (body, ...cookies) => ({ method: "POST", body, headers: headersFor(...cookies) });
const cartState = (storeId) => raw.cart.findMany({ where: { storeId }, include: { items: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });

try {
  if (mode === "prepare") {
    const [source, first, second] = extra;
    assert(/^e04_rehearsal_[a-z0-9_]+$/.test(source));
    await fs.mkdir(directory, { recursive: true });
    const docker = ["exec", "-i", "-e", `MYSQL_PWD=${decodeURIComponent(url.password)}`, container];
    const dump = spawnSync("docker", [...docker, "mariadb-dump", `-u${decodeURIComponent(url.username)}`, "--single-transaction", "--routines", "--triggers", "--skip-comments", source], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(dump.status, 0, dump.stderr);
    await fs.writeFile(path.join(directory, `${database}-source.sql`), dump.stdout, { flag: "wx" });
    const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
    try { await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); }
    finally { await connection.end(); }
    const restored = spawnSync("docker", [...docker, "mariadb", `-u${decodeURIComponent(url.username)}`, database], { input: dump.stdout, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(restored.status, 0, restored.stderr);
    const contexts = await Promise.all([first, second].map((host) => resolveStoreContext(raw, new Headers({ host }), { environment: "production" })));
    const user = await raw.user.findUniqueOrThrow({ where: { email: "admin@variedadeslosprimos.com" } });
    // Identidad heredada coincidente en A/B: únicamente A podrá adoptarla.
    const legacySid = randomUUID();
    for (const [index, context] of contexts.entries()) {
      const tag = index ? "B" : "A"; const storeId = context.id;
      await raw.category.create({ data: { storeId, slug: "e05-shared", name: `E05 ${tag}`, icon: "Store", gradient: "bg-primary" } });
      for (const kind of ["plain", "variant"]) {
        await raw.product.create({ data: { id: `e05-${tag}-${kind}`, storeId, slug: `e05-${kind}`, name: `E05 ${tag} ${kind}`, brand: `E05 ${tag}`, categorySlug: "e05-shared", price: 100, stock: 99 } });
      }
      await raw.productVariant.create({ data: { id: `e05-${tag}-v`, storeId, productId: `e05-${tag}-variant`, name: `E05 ${tag} variante`, stock: 99 } });
      for (const [type, value] of [["PERCENT", 10 + index * 10], ["FIXED", 15 + index], ["GIFT_CARD", 80 + index], ["FREE_SHIPPING", 0]]) {
        await raw.discountCode.create({ data: { id: `e05-${tag}-${type}`, storeId, code: `E05-${type}`, type, value, ...(type === "GIFT_CARD" ? { balance: value } : {}) } });
      }
      await raw.discountCode.create({ data: { id: `e05-${tag}-only`, storeId, code: `E05-ONLY-${tag}`, type: "FIXED", value: 5 } });
      await raw.cart.create({ data: { id: `e05-legacy-${tag}`, storeId, sessionId: legacySid } });
      await raw.cartItem.create({ data: { storeId, cartId: `e05-legacy-${tag}`, productId: `e05-${tag}-plain`, qty: 1 } });
      await raw.cart.create({ data: { id: `e05-user-${tag}`, storeId, userId: user.id } });
      await raw.cartItem.create({ data: { storeId, cartId: `e05-user-${tag}`, productId: `e05-${tag}-plain`, qty: 1 } });
      await raw.wishlistItem.create({ data: { storeId, userId: user.id, productId: `e05-${tag}-plain` } });
      await raw.order.create({ data: { id: `e05-order-${tag}`, code: `E05-${tag}`, storeId, userId: user.id, email: user.email, phone: "", shippingName: user.name, street: "", city: "", state: "", zip: "", subtotal: 100, total: 100 } });
    }
    await fs.writeFile(stateFile, JSON.stringify({ database, source, backupSha256: createHash("sha256").update(dump.stdout).digest("hex"), hosts: [first, second], stores: contexts.map((context) => context.id), userId: user.id, legacySid }, null, 2), { flag: "wx" });
    console.log(`E05 copia nueva ${database}; respaldo externo SHA256 ${createHash("sha256").update(dump.stdout).digest("hex")}`);
  } else {
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    if (mode === "services") {
      const { validateDiscount, redeemDiscount } = await import("../src/lib/server/discounts.ts");
      applicationClient = (await import("../src/lib/prisma.ts")).prisma;
      const context = await resolveStoreContext(raw, new Headers({ host: state.hosts[0] }), { environment: "production" });
      await runWithStoreContext(context, async () => {
        await check("canje propio y saldo de gift card; tienda B intacta", async () => {
          const other = await raw.discountCode.findMany({ where: { storeId: state.stores[1] }, orderBy: { id: "asc" } });
          const discount = await validateDiscount("e05-gift_card", 30);
          await applicationClient.$transaction((tx) => redeemDiscount(tx, discount, { orderId: "e05-order-A", userId: state.userId, amount: discount.amount }));
          const code = await raw.discountCode.findUniqueOrThrow({ where: { id: discount.codeId } });
          assert.equal(code.usedCount, 1); assert.equal(Number(code.balance), 50);
          assert.deepEqual(await raw.discountCode.findMany({ where: { storeId: state.stores[1] }, orderBy: { id: "asc" } }), other);
        });
        await check("cupón o pedido ajeno no producen canje ni consumo de saldo", async () => {
          const before = await raw.discountRedemption.count();
          await assert.rejects(applicationClient.$transaction((tx) => redeemDiscount(tx, { codeId: "e05-B-FIXED" }, { orderId: "e05-order-A", userId: state.userId, amount: 1 })), { status: 400 });
          const discount = await validateDiscount("E05-FIXED", 100);
          await assert.rejects(applicationClient.$transaction((tx) => redeemDiscount(tx, discount, { orderId: "e05-order-B", userId: state.userId, amount: 1 })), { code: "P2003" });
          assert.equal(await raw.discountRedemption.count(), before);
          assert.equal((await raw.discountCode.findUniqueOrThrow({ where: { id: discount.codeId } })).usedCount, 0);
        });
      });
    } else {
      const port = Number(extra[0]); assert(port > 1024 && port < 65536);
      // Clave efímera autorizada, solo en memoria y en este servidor de ensayo.
      const secret = randomBytes(32);
      const sessionSecret = secret.toString("hex");
      server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, SESSION_SECRET: sessionSecret }, stdio: ["ignore", "pipe", "pipe"] });
      server.stdout.on("data", (data) => { serverLog = (serverLog + data).slice(-8000); });
      server.stderr.on("data", (data) => { serverLog = (serverLog + data).slice(-8000); });
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        try { ready = (await request(port, state.hosts[0], "/api/cart")).status === 200; } catch { /* Esperar únicamente el servidor creado por este ensayo. */ }
        if (ready || server.exitCode !== null) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert(ready, `No arrancó el servidor de ensayo: ${serverLog}`);
      const user = await raw.user.findUniqueOrThrow({ where: { id: state.userId } });
      const token = await new SignJWT({ name: user.name, email: user.email, role: user.role }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(sessionSecret));
      const session = `vlp_session=${token}`;
      const legacy = `vlp_cart_sid=${state.legacySid}`;
      const call = (index, target, status = 200, options) => api(port, state.hosts[index], target, status, options);
      if (mode === "baseline") {
        const contracts = {};
        for (const [index, host] of state.hosts.entries()) {
          const auth = { headers: headersFor(session) };
          const cart = await call(index, "/api/cart", 200, auth);
          const wishlist = await call(index, "/api/wishlist", 200, auth);
          const discount = await call(index, "/api/discounts/validate", 200, post({ code: "E05-PERCENT", subtotal: 100 }));
          contracts[host] = { cart: shape(cart.body), wishlist: shape(wishlist.body), discount: shape(discount.body) };
        }
        await fs.writeFile(contractFile, JSON.stringify(contracts, null, 2), { flag: "wx" });
        console.log("E05 contratos HTTP previos capturados sin mutaciones");
      } else {
        const contracts = JSON.parse(await fs.readFile(contractFile, "utf8"));
        await check("mismos contratos HTTP previos: carrito, favoritos y cupón A/B", async () => {
          for (const [index, host] of state.hosts.entries()) {
            assert.deepEqual(shape((await call(index, "/api/cart", 200, { headers: headersFor(session) })).body), contracts[host].cart);
            assert.deepEqual(shape((await call(index, "/api/wishlist", 200, { headers: headersFor(session) })).body), contracts[host].wishlist);
            assert.deepEqual(shape((await call(index, "/api/discounts/validate", 200, post({ code: "E05-PERCENT", subtotal: 100 }))).body), contracts[host].discount);
          }
        });
        await check("cookie histórica solo en original; rotación conserva artículos y no modifica B", async () => {
          const beforeB = await cartState(state.stores[1]);
          assert.equal((await call(0, "/api/cart", 200, { headers: headersFor(legacy) })).body.data.itemCount, 1);
          assert.equal((await call(1, "/api/cart", 200, { headers: headersFor(legacy) })).body.data.itemCount, 0);
          // Un identificador antiguo ligado a un usuario no sirve como invitado.
          assert.equal((await call(0, "/api/cart", 200, { headers: headersFor("vlp_cart_sid=e02-session") })).body.data.itemCount, 0);
          const rotated = await call(0, "/api/cart/items", 201, post({ slug: "e05-plain", qty: 1 }, legacy));
          assert.equal(rotated.body.data.itemCount, 2);
          assert(cookiesFrom(rotated).some((value) => value.startsWith(cookieName(state.stores[0]) + "=")));
          assert(cookiesFrom(rotated).includes("vlp_cart_sid="));
          assert.deepEqual(await cartState(state.stores[1]), beforeB);
        });
        const guest = [];
        await check("mismo navegador: cookies/valores/carritos A y B independientes", async () => {
          for (const index of [0, 1]) {
            const response = await call(index, "/api/cart/items", 201, post({ slug: "e05-plain", qty: 2, storeId: state.stores[1 - index] }, ...guest));
            assert.equal(response.body.data.itemCount, 2);
            guest[index] = cookiesFrom(response).find((value) => value.startsWith(cookieName(state.stores[index]) + "="));
            assert(guest[index]); assert.match(response.headers["set-cookie"][0], /HttpOnly/i);
            assert(!response.headers["set-cookie"][0].includes("Domain="));
          }
          assert.notEqual(guest[0].split("=")[1], guest[1].split("=")[1]);
          for (const index of [0, 1]) {
            const data = (await call(index, "/api/cart", 200, { headers: headersFor(...guest) })).body.data;
            assert.deepEqual(data.lines.map((line) => line.product.id), [`e05-${index ? "B" : "A"}-plain`]);
            const copied = `${cookieName(state.stores[index])}=${guest[1 - index].split("=")[1]}`;
            assert.equal((await call(index, "/api/cart", 200, { headers: headersFor(copied) })).body.data.itemCount, 0);
          }
        });
        await check("producto/variante/linea ajenos rechazados sin modificar carrito ni cookie", async () => {
          const foreignLine = (await call(1, "/api/cart", 200, { headers: headersFor(...guest) })).body.data.lines[0].id;
          const before = await cartState(state.stores[0]);
          for (const [body, status] of [[{ productId: "e05-B-plain", qty: 1 }, 404], [{ productId: "e05-A-variant", variantId: "e05-B-v", qty: 1 }, 400], [{ productId: "e05-A-plain", variantId: "e05-B-v", qty: 1 }, 400]]) {
            const response = await call(0, "/api/cart/items", status, post(body, ...guest));
            assert.equal(response.headers["set-cookie"], undefined);
          }
          for (const method of ["PATCH", "DELETE"]) await call(0, `/api/cart/items/${foreignLine}`, 404, { method, body: method === "PATCH" ? { qty: 4 } : undefined, headers: headersFor(...guest) });
          assert.deepEqual(await cartState(state.stores[0]), before);
          await call(0, "/api/cart/items", 201, post({ productId: "e05-A-variant", variantId: "e05-A-v", qty: 1 }, ...guest));
        });
        await check("login real: merge solo tienda actual, suma existentes, mueve variantes, no repite", async () => {
          const beforeB = await cartState(state.stores[1]);
          const login = () => call(0, "/api/auth/login", 200, post({ email: user.email, password: "admin123" }, ...guest));
          const logged = await login();
          assert(cookiesFrom(logged).some((value) => value.startsWith("vlp_session=")));
          assert(cookiesFrom(logged).includes(cookieName(state.stores[0]) + "="));
          assert(!cookiesFrom(logged).some((value) => value.startsWith(cookieName(state.stores[1]) + "=")));
          assert.deepEqual(await cartState(state.stores[1]), beforeB);
          await login();
          let cart = (await call(0, "/api/cart", 200, { headers: headersFor(session) })).body.data;
          assert.equal(cart.itemCount, 4); assert.equal(cart.lines.length, 2);
          assert.equal(cart.lines.find((line) => line.product.id === "e05-A-plain").qty, 3);
          assert.equal((await call(1, "/api/cart", 200, { headers: headersFor(session) })).body.data.itemCount, 1);
          await call(1, "/api/auth/login", 200, post({ email: user.email, password: "admin123" }, ...guest));
          cart = (await call(1, "/api/cart", 200, { headers: headersFor(session) })).body.data;
          assert.equal(cart.itemCount, 3); assert(cart.lines.every((line) => line.product.id === "e05-B-plain"));
          const carts = await raw.cart.findMany({ where: { userId: user.id } });
          assert.equal(carts.length, 2); assert.notEqual(carts[0].id, carts[1].id);
        });
        await check("dos logins concurrentes reclaman el mismo invitado una sola vez", async () => {
          const created = await call(0, "/api/cart/items", 201, post({ slug: "e05-plain", qty: 1 }));
          const cookie = cookiesFrom(created)[0];
          await Promise.all([0, 1].map(() => call(0, "/api/auth/login", 200, post({ email: user.email, password: "admin123" }, cookie))));
          assert.equal((await call(0, "/api/cart", 200, { headers: headersFor(session) })).body.data.itemCount, 5);
        });
        await check("PATCH/DELETE propios preservan respuesta y carrito de otra tienda", async () => {
          const beforeB = await cartState(state.stores[1]);
          const cart = (await call(0, "/api/cart", 200, { headers: headersFor(session) })).body.data;
          const line = cart.lines.find((line) => line.variantId);
          const updated = await call(0, `/api/cart/items/${line.id}`, 200, { method: "PATCH", body: { qty: 2 }, headers: headersFor(session) });
          assert.equal(updated.body.data.lines.find((item) => item.id === line.id).qty, 2);
          const removed = await call(0, `/api/cart/items/${line.id}`, 200, { method: "DELETE", headers: headersFor(session) });
          assert(!removed.body.data.lines.some((item) => item.id === line.id));
          assert.deepEqual(await cartState(state.stores[1]), beforeB);
        });
        await check("alta autenticada usa el carrito propio y deja intacta la otra tienda", async () => {
          const beforeB = await cartState(state.stores[1]);
          const added = await call(0, "/api/cart/items", 201, post({ productId: "e05-A-variant", variantId: "e05-A-v", qty: 2 }, session));
          assert.equal(added.body.data.lines.find((line) => line.product.id === "e05-A-variant").qty, 2);
          assert.equal(added.headers["set-cookie"], undefined);
          assert.deepEqual(await cartState(state.stores[1]), beforeB);
        });
        await check("favoritos del mismo usuario aislados; POST y DELETE ajenos no alteran B", async () => {
          const beforeB = await raw.wishlistItem.findMany({ where: { storeId: state.stores[1] } });
          await call(0, "/api/wishlist", 404, post({ productId: "e05-B-plain" }, session));
          await call(0, "/api/wishlist/e05-B-plain", 200, { method: "DELETE", headers: headersFor(session) });
          assert.equal((await call(0, "/api/wishlist", 200, post({ productId: "e05-A-variant" }, session))).body.data.added, true);
          assert.equal((await call(0, "/api/wishlist", 200, post({ productId: "e05-A-variant" }, session))).body.data.added, false);
          assert.deepEqual(await raw.wishlistItem.findMany({ where: { storeId: state.stores[1] } }), beforeB);
          for (const index of [0, 1]) {
            const list = (await call(index, "/api/wishlist", 200, { headers: headersFor(session) })).body.data;
            assert.deepEqual(list.map((product) => product.id), [`e05-${index ? "B" : "A"}-plain`]);
          }
          await call(0, "/api/wishlist", 401);
        });
        await check("cupones coincidentes por tienda, cuatro tipos y rechazo ajeno sin mutaciones", async () => {
          const before = await Promise.all(state.stores.map(cartState));
          for (const index of [0, 1]) {
            for (const type of ["PERCENT", "FIXED", "GIFT_CARD", "FREE_SHIPPING"]) {
              const discount = (await call(index, "/api/discounts/validate", 200, post({ code: ` e05-${type.toLowerCase()} `, subtotal: 100, storeId: state.stores[1 - index] }))).body.data;
              assert.equal(discount.codeId, `e05-${index ? "B" : "A"}-${type}`);
              assert.equal(discount.freeShipping, type === "FREE_SHIPPING");
              if (type === "PERCENT") assert.equal(discount.amount, index ? 20 : 10);
            }
            await call(index, "/api/discounts/validate", 400, post({ code: `E05-ONLY-${index ? "A" : "B"}`, subtotal: 100 }));
          }
          assert.deepEqual(await Promise.all(state.stores.map(cartState)), before);
        });
        await check("60 requests concurrentes de carrito/favoritos/cupón sin fuga ni tenant del cliente", async () => {
          await Promise.all(Array.from({ length: 60 }, async (_, index) => {
            const own = index % 2; const tag = own ? "B" : "A";
            const kind = Math.floor(index / 2) % 3;
            const target = kind === 0 ? "/api/cart" : kind === 1 ? "/api/wishlist" : "/api/discounts/validate";
            const response = await call(own, target, 200, kind === 2 ? post({ code: "E05-PERCENT", subtotal: 100 }, session) : { headers: { ...headersFor(session, ...guest), "x-store-id": state.stores[1 - own], "x-forwarded-host": state.hosts[1 - own] } });
            assert(!response.text.includes(`e05-${tag === "A" ? "B" : "A"}-`));
          }));
          const response = await api(port, "unrecognized", "/api/cart", 404);
          assert.equal(response.body.ok, false);
        });
        await check("páginas de carrito, favoritos y checkout renderizan A/B con sesión real", async () => {
          for (const index of [0, 1]) {
            for (const target of ["/cart", "/wishlist", "/checkout"]) {
              const response = await request(port, state.hosts[index], target, { headers: headersFor(session) });
              assert.equal(response.status, 200, `${state.hosts[index]}${target}`);
              assert(!response.text.includes(`E05 ${index ? "A" : "B"} plain`));
              assert(response.text.includes(`E05 ${index ? "B" : "A"} plain`));
              assert.match(response.headers["cache-control"], /no-store/);
            }
          }
        });
        await check("creación de carrito autenticado por API conserva el carrito de la otra tienda", async () => {
          const beforeA = await cartState(state.stores[0]);
          // Retirar solo este fixture creado por prepare, nunca carritos heredados.
          await raw.cart.delete({ where: { id: "e05-user-B", storeId: state.stores[1], userId: user.id } });
          assert.equal(await raw.cart.count({ where: { storeId: state.stores[1], userId: user.id } }), 0);
          const added = await call(1, "/api/cart/items", 201, post({ slug: "e05-plain", qty: 1 }, session, ...guest));
          assert.equal(added.body.data.itemCount, 1);
          assert.deepEqual(added.body.data.lines.map((line) => line.product.id), ["e05-B-plain"]);
          assert.equal(added.headers["set-cookie"], undefined);
          const carts = await raw.cart.findMany({ where: { userId: user.id, storeId: { in: state.stores } } });
          assert.equal(carts.length, 2); assert.notEqual(carts[0].id, carts[1].id);
          assert.deepEqual(await cartState(state.stores[0]), beforeA);
        });
      }
    }
    console.log(`E05 ${mode}: ${checks} grupos correctos; solo ${database}; sin pagos, correos ni cambios en bases preexistentes`);
  }
} finally {
  if (server && server.exitCode === null) { const exited = new Promise((resolve) => server.once("exit", resolve)); server.kill(); await exited; }
  await applicationClient?.$disconnect(); await raw.$disconnect();
}
