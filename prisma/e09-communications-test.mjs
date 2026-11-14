import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import mariadb from "mariadb";
import nodemailer from "nodemailer";
import { SignJWT } from "jose";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const [mode, directory, container, ...extra] = process.argv.slice(2);
assert(["prepare", "services", "http"].includes(mode));
const repo = process.cwd(), url = new URL(process.env.DATABASE_URL), database = url.pathname.slice(1);
assert(path.isAbsolute(directory) && !path.resolve(directory).startsWith(repo + path.sep));
assert(["127.0.0.1", "localhost"].includes(url.hostname)); assert(/^e09_rehearsal_[a-z0-9_]{1,24}$/.test(database));
const stateFile = path.join(directory, `${database}.json`);
const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
const hash = (value) => createHash("sha256").update(value).digest("hex");
let applicationClient, server, serverLog = "", checks = 0;
const check = async (label, callback) => { await callback(); checks++; console.log(`OK ${label}`); };
const prisma = (...args) => {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { env: process.env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr + result.stdout); return result.stdout;
};
async function snapshot() {
  const result = {};
  const tables = await raw.$queryRawUnsafe("SHOW TABLES");
  for (const row of tables) {
    const table = Object.values(row)[0]; if (table === "_prisma_migrations") continue;
    assert(/^[a-z_]+$/.test(table));
    const rows = await raw.$queryRawUnsafe(`SELECT * FROM \`${table}\``);
    if (table === "store_settings") for (const item of rows) for (const field of ["senderEmail", "notificationEmail", "contactEmail", "emailLogoUrl", "seoDescription"]) delete item[field];
    result[table] = rows.map((item) => JSON.stringify(item, (_, value) => typeof value === "bigint" ? value.toString() : value)).sort();
  }
  return result;
}
function request(port, host, target, { method = "GET", body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: target, method, headers: { host, "content-type": "application/json", ...(cookie ? { cookie } : {}) }, timeout: 40000 }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("HTTP timeout"))); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function walk(root) {
  const out = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
    const file = path.join(root, entry.name); if (entry.isDirectory()) out.push(...await walk(file)); else out.push(file);
  }
  return out;
}
try {
  if (mode === "prepare") {
    const [source] = extra; assert(/^e08_rehearsal_[a-z0-9_]+$/.test(source));
    await fs.mkdir(directory, { recursive: true });
    const args = ["exec", "-i", "-e", `MYSQL_PWD=${decodeURIComponent(url.password)}`, container];
    const dump = spawnSync("docker", [...args, "mariadb-dump", `-u${decodeURIComponent(url.username)}`, "--single-transaction", "--routines", "--triggers", "--skip-comments", source], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); assert.equal(dump.status, 0, dump.stderr);
    await fs.writeFile(path.join(directory, `${database}-backup.sql`), dump.stdout, { flag: "wx" });
    const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
    try { await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } finally { await connection.end(); }
    const restored = spawnSync("docker", [...args, "mariadb", `-u${decodeURIComponent(url.username)}`, database], { input: dump.stdout, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); assert.equal(restored.status, 0, restored.stderr);
    const before = await snapshot();
    await check("dry-run solo agrega cinco columnas anulables", async () => {
      const sql = prisma("migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script");
      assert(!/\b(?:DROP|DELETE|TRUNCATE|UPDATE|MODIFY)\b/i.test(sql)); assert.equal((sql.match(/ADD COLUMN/g) ?? []).length, 5);
      await fs.writeFile(path.join(directory, `${database}-dry-run.sql`), sql, { flag: "wx" });
    });
    await check("migración sobre copia preserva todas las filas históricas y deja diff vacío", async () => {
      // Los ensayos previos aplicaron SQL sin registrar _prisma_migrations.
      // El dry-run ya probó que la única diferencia son las cinco columnas E09.
      const tables = await raw.$queryRawUnsafe("SHOW TABLES LIKE '_prisma_migrations'");
      const recorded = tables.length ? await raw.$queryRawUnsafe("SELECT id FROM _prisma_migrations") : [];
      if (!recorded.length) {
        const previous = (await fs.readdir(path.join(repo, "prisma/migrations"), { withFileTypes: true })).filter((entry) => entry.isDirectory() && entry.name !== "20261114000000_store_communications").map((entry) => entry.name).sort(); assert.equal(previous.length, 5);
        for (const migration of previous) prisma("migrate", "resolve", "--applied", migration);
        console.log("Baseline de cinco migraciones previas registrado solo en la copia E09; fuente intacta.");
      }
      prisma("migrate", "deploy"); assert.deepEqual(await snapshot(), before);
      assert(!prisma("migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code").includes("[*]"));
      const settings = await raw.storeSettings.findMany(); assert(settings.every((row) => row.senderEmail === null && row.notificationEmail === null && row.contactEmail === null && row.emailLogoUrl === null && row.seoDescription === null));
    });
    const stores = ["store-original", "store-frutas-del-valle"], hosts = ["losprimos", "fruvalle"];
    const accounts = await Promise.all(["A", "B"].map((tag) => raw.user.findUniqueOrThrow({ where: { id: `e08-admin-${tag}` } })));
    for (const [index, storeId] of stores.entries()) {
      const tag = index ? "B" : "A", name = (await raw.store.findUniqueOrThrow({ where: { id: storeId } })).name;
      const data = { notificationEmail: accounts[index].email, contactEmail: accounts[index].email, senderEmail: accounts[index].email, seoDescription: `Tienda ${name}`, emailLogoUrl: null };
      await raw.storeSettings.upsert({ where: { storeId }, create: { storeId, ...data }, update: data });
      await raw.product.create({ data: { id: `e09-${tag}-product`, storeId, slug: `e09-only-${tag.toLowerCase()}`, name: `E09 ${tag} inventario`, brand: name, categorySlug: "e08-shared", price: 100, stock: 4 } });
    }
    await fs.writeFile(stateFile, JSON.stringify({ stores, hosts, accounts: accounts.map((user) => user.email), backupSha256: hash(dump.stdout) }, null, 2), { flag: "wx" });
    console.log(`Respaldo SHA256 ${hash(dump.stdout)}; base ${database}. Rollback: conservar respaldo, volver al código anterior (columnas nuevas anulables compatibles); para recuperar datos usar otra base nueva restaurada del SQL, sin borrar columnas ni bases preexistentes.`);
  } else {
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    process.env.NODE_ENV = "production";
    // Solo buzones de fixtures ya existentes; no hay credenciales ni conexión SMTP real.
    process.env.EMAIL_FROM = state.accounts[0]; process.env.SMTP_USER = state.accounts[1]; process.env.STORE_EMAIL = state.accounts[0];
    for (const key of ["SMTP_HOST", "SMTP_PASS", "WOMPI_PUBLIC_KEY", "WOMPI_PRIVATE_KEY", "WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) process.env[key] = "";
    if (mode === "services") {
      const { resolveStoreContext, runWithStoreContext } = await import("../src/lib/server/store-context.ts");
      const contexts = await Promise.all(state.hosts.map((host) => resolveStoreContext(raw, new Headers({ host }), { environment: "production" })));
      const within = (index, callback) => runWithStoreContext(contexts[index], callback);
      const { getCommercialSettings, mailbox } = await import("../src/lib/server/commercial-settings.ts");
      const { createEmailSender, sendEmail } = await import("../src/lib/server/email.ts");
      const { createManualOrderEmailSender, sendOrderConfirmationEmail } = await import("../src/lib/server/order-emails.ts");
      const { buildOrderEmail } = await import("../src/lib/server/order-email.ts");
      const { buildPasswordResetEmail } = await import("../src/lib/server/auth-email.ts");
      const { buildSupportReplyEmail } = await import("../src/lib/server/support-email.ts");
      const { buildSupportAlertEmail, buildOrderAlertEmail, buildLowStockAlertEmail } = await import("../src/lib/server/store-alert-email.ts");
      const { getStoreSeo, getStoreMetadata } = await import("../src/lib/seo.ts");
      const notification = await import("../src/lib/server/notifications.ts");
      const alerts = await import("../src/lib/server/store-alerts.ts");
      applicationClient = (await import("../src/lib/prisma.ts")).prisma;
      const sent = [], tx = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
      const sender = createEmailSender(() => ({ sendMail: async (options) => { const result = await tx.sendMail(options); sent.push({ options, mime: result.message.toString() }); return result; } }));
      await check("configuración y metadata concurrentes derivan solo del contexto validado", async () => {
        await assert.rejects(getCommercialSettings());
        await Promise.all(Array.from({ length: 60 }, (_, position) => within(position % 2, async () => {
          const index = position % 2, config = await getCommercialSettings(), site = await getStoreSeo(), metadata = await getStoreMetadata();
          assert.equal(config.branding.storeId, state.stores[index]); assert.equal(config.notificationEmail, state.accounts[index]); assert.equal(config.sender, state.accounts[index]);
          assert.equal(metadata.applicationName, contexts[index].name); assert.equal(site.origin, `https://${state.hosts[index]}`);
          assert(!JSON.stringify({ site, metadata }).match(/senderEmail|notificationEmail|SMTP_|contactEmail/));
        })));
      });
      await check("fallback de buzón/logo no hereda datos de A en B; remitentes no autorizados se sustituyen", async () => {
        const original = await raw.storeSettings.findUniqueOrThrow({ where: { storeId: state.stores[1] } });
        const unauthorized = (await raw.user.findUniqueOrThrow({ where: { id: "e08-user-A" } })).email;
        await raw.storeSettings.update({ where: { storeId: state.stores[1] }, data: { notificationEmail: null, senderEmail: unauthorized, emailLogoUrl: `/api/uploads/stores/${hash(state.stores[0])}/2026-11/referenced.png` } });
        await within(1, async () => { const config = await getCommercialSettings(); assert.equal(config.notificationEmail, null); assert.equal(config.branding.logoUrl, null); assert.equal(config.sender, state.accounts[0]); assert.equal(config.branding.name, contexts[1].name); });
        await raw.storeSettings.update({ where: { storeId: state.stores[1] }, data: { notificationEmail: original.notificationEmail, senderEmail: original.senderEmail, emailLogoUrl: original.emailLogoUrl } });
        assert.equal(mailbox(`${state.accounts[0]}\r\nBcc: ${state.accounts[1]}`), null); assert.equal(mailbox(`${state.accounts[0]},${state.accounts[1]}`), null);
      });
      await check("seis plantillas A/B y MIME Nodemailer conservan marca, enlaces, destinatario y remitente propios", async () => {
        for (const index of [0, 1]) await within(index, async () => {
          const { branding } = await getCommercialSettings(), base = { appUrl: branding.origin, branding }, tag = index ? "B" : "A";
          const messages = [
            buildPasswordResetEmail({ ...base, nombre: "E09", link: `${branding.origin}/restablecer?token=private-reset-token` }),
            buildSupportReplyEmail({ ...base, name: "E09", radicado: `E09-${tag}`, kind: "CONTACTO", subject: `E09 ${tag}`, originalMessage: "Privado", response: "Respuesta" }),
            buildSupportAlertEmail({ ...base, id: `e08-${tag}-message`, name: "E09", email: state.accounts[index], radicado: `E09-${tag}`, kind: "CONTACTO", subject: `E09 ${tag}`, message: "Privado" }),
            buildOrderAlertEmail({ ...base, orderId: `e08-${tag}-order`, code: `E09-${tag}`, total: 100, paid: false, method: "COD", customerName: "E09", customerEmail: state.accounts[index] }),
            buildLowStockAlertEmail({ ...base, productId: `e09-${tag}-product`, label: `E09 ${tag}`, stock: 1 }),
            buildOrderEmail({ ...base, code: `E09-${tag}`, shippingName: "<script>Cliente</script>", street: "Calle E09", city: "E09", state: "E09", zip: "000", country: "Colombia", items: [{ name: "<img onerror=alert(1)>", brand: "E09", qty: 1, unitPrice: 100, variantName: null, imageUrl: null }], total: 100, kind: "confirmation", trackingUrl: null }),
          ];
          for (const mail of messages) {
            assert(mail.html.includes(branding.name)); assert(!mail.html.includes(contexts[1 - index].name)); assert(!mail.html.includes(`<script>`));
            assert(!JSON.stringify(mail).includes(`https://${state.hosts[1 - index]}/`)); assert(!JSON.stringify(mail).includes(state.accounts[1 - index]));
            assert((await sender({ ...mail, to: state.accounts[index] })).sent);
            const captured = sent.at(-1); assert.equal(captured.options.to, state.accounts[index]); assert.equal(captured.options.from.address, state.accounts[index]); assert.equal(captured.options.from.name, branding.name); assert.equal(captured.options.envelope.to.length, 1); assert(captured.mime.includes("MIME-Version"));
          }
        });
      });
      await check("envío de pedido propio registra EmailLog; pedido ajeno no produce envío ni log", async () => {
        const manual = createManualOrderEmailSender(sender);
        for (const index of [0, 1]) await within(index, async () => {
          const tag = index ? "B" : "A", previous = sent.length, before = await raw.emailLog.count({ where: { storeId: state.stores[index] } });
          assert.equal(await manual(`e08-${index ? "A" : "B"}-order`, false), "not_found"); assert.equal(sent.length, previous);
          assert(await manual(`e08-${tag}-order`, false));
          assert.equal(await raw.emailLog.count({ where: { storeId: state.stores[index] } }), before + 1);
          const log = await raw.emailLog.findFirst({ where: { storeId: state.stores[index], orderId: `e08-${tag}-order` }, orderBy: { sentAt: "desc" } });
          assert(log); assert.equal(log.to, (await raw.order.findUniqueOrThrow({ where: { id: `e08-${tag}-order` } })).email);
        });
      });
      await check("imágenes absolutas propias se conservan; uploads ajenos y tracking inválido se omiten", async () => {
        const image = await raw.productImage.findFirstOrThrow({ where: { productId: "e08-A-product", storeId: state.stores[0] } });
        const order = await raw.order.findUniqueOrThrow({ where: { id: "e08-A-order" } });
        const own = `https://${state.hosts[0]}/api/uploads/stores/${hash(state.stores[0])}/2026-11/referenced.png`;
        const foreign = `https://${state.hosts[1]}/api/uploads/stores/${hash(state.stores[1])}/2026-11/referenced.png`;
        const manual = createManualOrderEmailSender(sender);
        try {
          await raw.productImage.update({ where: { id: image.id }, data: { url: own } });
          await within(0, async () => { assert(await manual(order.id, false)); assert(sent.at(-1).options.html.includes(`src="${own}"`)); });
          await raw.productImage.update({ where: { id: image.id }, data: { url: foreign } });
          await raw.order.update({ where: { id: order.id }, data: { trackingUrl: "javascript:alert(1)" } });
          await within(0, async () => { assert(await manual(order.id, true)); assert(!sent.at(-1).options.html.includes(foreign)); assert(!sent.at(-1).options.html.includes("javascript:")); });
        } finally {
          await raw.productImage.update({ where: { id: image.id }, data: { url: image.url } });
          await raw.order.update({ where: { id: order.id }, data: { trackingUrl: order.trackingUrl } });
        }
      });
      await check("SMTP ausente/fallido y cabeceras inválidas no lanzan ni filtran secretos en consola", async () => {
        const warnings = [], previous = console.warn; console.warn = (...args) => warnings.push(args.join(" "));
        try {
          await within(0, async () => {
            const mail = { to: state.accounts[0], subject: "Privado", html: "private-reset-token", text: "private-reset-token" };
            assert.equal((await sendEmail(mail)).sent, false);
            assert.equal((await createEmailSender(() => ({ sendMail: async () => { throw new Error("private-reset-token"); } }))(mail)).sent, false);
            assert.equal((await sender({ ...mail, to: `${mail.to}\r\nBcc: ${state.accounts[1]}` })).sent, false);
            await sendOrderConfirmationEmail("e08-A-order");
            const { requestPasswordReset } = await import("../src/lib/server/password-reset.ts");
            await requestPasswordReset(state.accounts[0], contexts[0].origin);
          });
        } finally { console.warn = previous; }
        assert(!warnings.join(" ").includes("private-reset-token")); assert(!warnings.join(" ").includes(state.accounts[0])); assert(!warnings.join(" ").includes("restablecer?token="));
      });
      await check("avisos y alertas con IDs ajenos no se crean; inventario bajo propio no se duplica al repetir", async () => {
        const before = await raw.notification.count({ where: { storeId: state.stores[0] } });
        await within(0, async () => {
          await notification.notifyOrderCreated({ orderId: "e08-B-order", code: "E09-B", total: 1, paid: false, method: "COD", customerName: "B" });
          await notification.notifySupportMessage({ id: "e08-B-message", radicado: "E09-B", kind: "CONTACTO", name: "B", subject: "B" });
          await notification.notifyReviewCreated({ productId: "e09-B-product", productName: "B", userName: "B", rating: 5 });
          await notification.notifyLowStockAfterSale([{ productId: "e09-B-product", variantId: null }]);
          await alerts.alertStoreLowStock("e09-B-product", false);
        });
        assert.equal(await raw.notification.count({ where: { storeId: state.stores[0] } }), before);
        for (const index of [0, 1]) await within(index, async () => {
          const entityId = `e09-${index ? "B" : "A"}-product`;
          await notification.notifyLowStockAfterSale([{ productId: entityId, variantId: null }]); await notification.notifyLowStockAfterSale([{ productId: entityId, variantId: null }]);
          assert.equal(await raw.notification.count({ where: { storeId: state.stores[index], entityId, type: "LOW_STOCK" } }), 1);
        });
      });
    } else {
      const port = Number(extra[0]); assert(port > 1024 && port < 65536);
      const source = path.join(repo, ".next/standalone"), target = path.join(directory, `${database}-runtime-${randomBytes(4).toString("hex")}`);
      const entries = (await walk(source)).filter((file) => path.basename(file) === "server.js"); assert.equal(entries.length, 1);
      const project = path.dirname(entries[0]);
      await fs.cp(source, target, { recursive: true, dereference: true, filter: (file) => file !== path.join(project, "uploads") && !file.startsWith(path.join(project, "uploads") + path.sep) });
      const entry = path.join(target, path.relative(source, entries[0])), runtime = path.dirname(entry);
      await fs.cp(path.join(repo, ".next/static"), path.join(runtime, ".next/static"), { recursive: true }); await fs.cp(path.join(repo, "public"), path.join(runtime, "public"), { recursive: true });
      const secret = randomBytes(32).toString("hex");
      server = spawn(process.execPath, [entry], { cwd: runtime, env: { ...process.env, SESSION_SECRET: secret, PORT: String(port), HOSTNAME: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe"] });
      server.stdout.on("data", (data) => { serverLog = (serverLog + data).slice(-6000); }); server.stderr.on("data", (data) => { serverLog = (serverLog + data).slice(-6000); });
      let ready = false;
      for (let attempt = 0; attempt < 80; attempt++) { try { ready = (await request(port, state.hosts[0], "/api/cart")).status === 200; } catch { /* Este servidor aún inicia. */ } if (ready || server.exitCode !== null) break; await new Promise((resolve) => setTimeout(resolve, 500)); }
      assert(ready, serverLog);
      await check("sitemap/robots HTTP segregados y host desconocido cerrado", async () => {
        for (const index of [0, 1]) {
          const sitemap = await request(port, state.hosts[index], "/sitemap.xml"), robots = await request(port, state.hosts[index], "/robots.txt"); assert.equal(sitemap.status, 200); assert.equal(robots.status, 200);
          assert(sitemap.text.includes(`https://${state.hosts[index]}/product/e09-only-${index ? "b" : "a"}`)); assert(!sitemap.text.includes(`/product/e09-only-${index ? "a" : "b"}`));
          assert(!sitemap.text.includes(`https://${state.hosts[1 - index]}/`)); assert(robots.text.includes(`https://${state.hosts[index]}/sitemap.xml`)); assert(!robots.text.includes(state.hosts[1 - index]));
        }
        for (const target of ["/sitemap.xml", "/robots.txt"]) assert.equal((await request(port, "unknown.invalid", target)).status, 404);
      });
      await check("checkout COD A/B sin SMTP conserva contrato, pedido y stock aislados", async () => {
        for (const index of [0, 1]) {
          const tag = index ? "B" : "A", beforeOther = (await raw.product.findUniqueOrThrow({ where: { id: `e09-${index ? "A" : "B"}-product` } })).stock;
          const user = await raw.user.findUniqueOrThrow({ where: { id: `e08-admin-${tag}` } });
          const token = await new SignJWT({ role: "CUSTOMER", sv: user.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));
          let cookie = `vlp_session=${token}`;
          const added = await request(port, state.hosts[index], "/api/cart/items", { method: "POST", cookie, body: { productId: `e09-${tag}-product`, qty: 1 } }); assert.equal(added.status, 201, added.text);
          cookie += (added.headers["set-cookie"] ?? []).map((value) => `; ${value.split(";")[0]}`).join("");
          const response = await request(port, state.hosts[index], "/api/checkout", { method: "POST", cookie, body: { method: "COD", contact: { name: `E09 ${tag}`, email: state.accounts[index], phone: "0000000" }, shipping: { street: "E09 ensayo", city: "E09", state: "E09", zip: "000", country: "Colombia" } } });
          assert.equal(response.status, 201, response.text); const body = JSON.parse(response.text); assert.deepEqual(Object.keys(body.data).sort(), ["code", "paymentStatus", "status", "total"].sort());
          const order = await raw.order.findUniqueOrThrow({ where: { code: body.data.code } }); assert.equal(order.storeId, state.stores[index]); assert.equal(order.email, state.accounts[index]);
          assert.equal((await raw.product.findUniqueOrThrow({ where: { id: `e09-${index ? "A" : "B"}-product` } })).stock, beforeOther);
          assert.equal(await raw.emailLog.count({ where: { orderId: order.id } }), 0);
        }
      });
      await check("APIs públicas no exponen ajustes de destinatarios/remitentes ni secretos SMTP", async () => {
        for (const host of state.hosts) for (const target of ["/api/home", "/api/products", "/api/categories"]) {
          const response = await request(port, host, target); assert.equal(response.status, 200); assert(!/SMTP_|senderEmail|notificationEmail|contactEmail|emailLogoUrl/.test(response.text));
        }
        assert(!serverLog.includes(state.accounts[0])); assert(!serverLog.includes(state.accounts[1]));
      });
      await check("contacto, respuesta administrativa y recuperación sin SMTP conservan respuestas y pertenencia", async () => {
        for (const index of [0, 1]) {
          const host = state.hosts[index], tag = index ? "B" : "A";
          const body = { kind: "CONTACTO", name: `E09 ${tag}`, email: state.accounts[index], subject: `E09 ${tag} contacto`, message: `Mensaje privado de ensayo E09 ${tag}` };
          const previous = await raw.supportMessage.count();
          const rejected = await request(port, host, "/api/support", { method: "POST", body: { ...body, orderCode: `E08-${index ? "A" : "B"}` } }); assert.equal(rejected.status, 404, rejected.text); assert.equal(await raw.supportMessage.count(), previous);
          const created = await request(port, host, "/api/support", { method: "POST", body }); assert.equal(created.status, 201, created.text);
          const message = await raw.supportMessage.findFirstOrThrow({ where: { storeId: state.stores[index], radicado: JSON.parse(created.text).data.radicado } }); assert.equal(message.email, state.accounts[index]);
          const user = await raw.user.findUniqueOrThrow({ where: { id: `e08-admin-${tag}` } });
          const token = await new SignJWT({ sv: user.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));
          const reply = await request(port, host, `/api/admin/support/${message.id}`, { method: "PATCH", cookie: `vlp_session=${token}`, body: { status: "EN_PROCESO", response: `E09 ${tag} respuesta` } }); assert.equal(reply.status, 200, reply.text);
          const forgot = await request(port, host, "/api/auth/password/forgot", { method: "POST", body: { email: state.accounts[index] } }); assert.equal(forgot.status, 200, forgot.text);
          assert(!serverLog.includes(state.accounts[index])); assert(!serverLog.includes("restablecer?token="));
        }
      });
      await check("contactos concurrentes A/B obtienen radicados globales distintos sin contadores compartidos", async () => {
        const codes = await Promise.all(Array.from({ length: 10 }, async (_, number) => {
          const index = number % 2;
          const response = await request(port, state.hosts[index], "/api/support", { method: "POST", body: { kind: "CONTACTO", name: "E09 ensayo", email: state.accounts[index], subject: `E09 concurrente ${number}`, message: "Mensaje de ensayo E09 concurrente por tienda" } });
          assert.equal(response.status, 201, response.text); const code = JSON.parse(response.text).data.radicado;
          const row = await raw.supportMessage.findUniqueOrThrow({ where: { radicado: code } }); assert.equal(row.storeId, state.stores[index]); return code;
        }));
        assert.equal(new Set(codes).size, 10);
      });
    }
  }
  console.log(`E09 ${mode}: ${checks} grupos correctos; solo copia ${database}; sin SMTP externo, pagos ni datos reales.`);
} finally {
  if (server && server.exitCode === null) { const exited = new Promise((resolve) => server.once("exit", resolve)); server.kill(); await exited; }
  await applicationClient?.$disconnect(); await raw.$disconnect();
}
