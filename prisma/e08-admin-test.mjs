import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { SignJWT } from "jose";
import mariadb from "mariadb";
import ts from "typescript";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { imageRefSchema } from "../src/lib/image-limits.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const [mode, directory, container, ...extra] = process.argv.slice(2);
assert(["prepare", "baseline", "http", "pages", "gc"].includes(mode));
const repo = process.cwd(); assert(path.isAbsolute(directory) && !path.resolve(directory).startsWith(repo + path.sep));
const url = new URL(process.env.DATABASE_URL); assert(["127.0.0.1", "localhost"].includes(url.hostname));
const database = url.pathname.slice(1); assert(/^e08_rehearsal_[a-z0-9_]{1,24}$/.test(database));
const stateFile = path.join(directory, `${database}.json`), contractsFile = path.join(directory, `${database}-contracts.json`);
const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const prefix = (id) => `stores/${hash(id)}/2026-11/`;
let server, serverLog = "", checks = 0;
const check = async (label, callback) => { await callback(); checks++; console.log(`OK ${label}`); };
const shape = (value) => value === null ? "null" : Array.isArray(value) ? { array: [...new Set(value.map((item) => JSON.stringify(shape(item))))].sort() } : typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])])) : typeof value;

async function walk(directoryName, skip = []) {
  const output = [];
  for (const entry of await fs.readdir(directoryName, { withFileTypes: true })) {
    const full = path.join(directoryName, entry.name);
    if (skip.includes(entry.name)) continue;
    if (entry.isDirectory()) output.push(...await walk(full, skip)); else output.push(full);
  }
  return output;
}
async function inventory() {
  const cases = [];
  for (const file of await walk(path.join(repo, "src/app/api/admin"))) {
    if (!file.endsWith("route.ts")) continue;
    const source = await fs.readFile(file, "utf8");
    assert(source.includes("withErrorHandling"), file);
    assert(!/\$(?:queryRaw|executeRaw)|new PrismaClient|generated\/prisma/.test(source), file);
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const statement of parsed.statements) {
      if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const method = declaration.name.getText(parsed);
        if (["GET", "POST", "PATCH", "DELETE", "PUT"].includes(method)) cases.push({ method, route: "/api/admin/" + path.relative(path.join(repo, "src/app/api/admin"), path.dirname(file)).split(path.sep).join("/") });
      }
    }
  }
  for (const file of await walk(path.join(repo, "src/lib/server/admin"))) assert(!/\$(?:queryRaw|executeRaw)|new PrismaClient|generated\/prisma/.test(await fs.readFile(file, "utf8")), file);
  return cases;
}
function request(port, host, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: target, method: options.method ?? "GET", headers: { host, "content-type": "application/json", ...options.headers }, timeout: 40_000 }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks), text: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("HTTP timeout")));
    req.end(options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)));
  });
}
const snapshot = async (storeId) => {
  const models = ["category", "product", "productImage", "productSpec", "productVariant", "banner", "homeSection", "order", "orderItem", "payment", "orderStatusEvent", "emailLog", "discountCode", "discountRedemption", "supportMessage", "notification", "storeMembership"];
  const output = {};
  for (const model of models) output[model] = (await raw[model].findMany({ where: { storeId } })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  output.users = await raw.user.findMany({ where: { memberships: { some: { storeId } } }, orderBy: { id: "asc" } });
  return output;
};
async function fileManifest(root) {
  const output = {};
  const visit = async (directoryName) => {
    for (const entry of await fs.readdir(directoryName, { withFileTypes: true })) {
      const full = path.join(directoryName, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(full); else if (entry.isFile()) output[path.relative(root, full).split(path.sep).join("/")] = hash(await fs.readFile(full));
    }
  };
  try { await visit(root); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return output;
}
async function makeRuntime(state, label) {
  const source = path.join(repo, ".next/standalone"), target = path.join(directory, `${database}-${label}-${randomBytes(4).toString("hex")}`);
  await assert.rejects(fs.stat(target), { code: "ENOENT" });
  const entries = (await walk(source, ["node_modules", ".next"])).filter((file) => path.basename(file) === "server.js"); assert.equal(entries.length, 1);
  const project = path.dirname(entries[0]);
  await fs.cp(source, target, { recursive: true, dereference: true, filter: (file) => file !== path.join(project, "uploads") && !file.startsWith(path.join(project, "uploads") + path.sep) });
  const entry = path.join(target, path.relative(source, entries[0])), runtime = path.dirname(entry);
  await fs.cp(path.join(repo, ".next/static"), path.join(runtime, ".next/static"), { recursive: true });
  await fs.cp(path.join(repo, "public"), path.join(runtime, "public"), { recursive: true });
  const uploadRoot = path.join(runtime, "uploads"), image = await fs.readFile(path.join(repo, "public/email-logo.png"));
  for (const [index, storeId] of state.stores.entries()) {
    const tag = index ? "B" : "A";
    for (const name of ["referenced.png", `orphan-${tag}.png`]) {
      const file = path.join(uploadRoot, prefix(storeId), name); await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, image, { flag: "wx" });
    }
  }
  await fs.mkdir(path.join(uploadRoot, "2026-11"), { recursive: true });
  await fs.writeFile(path.join(uploadRoot, "2026-11/e08-legacy.png"), image, { flag: "wx" });
  await fs.symlink(path.join(uploadRoot, prefix(state.stores[1])), path.join(uploadRoot, prefix(state.stores[0]), "link-to-b"), "junction");
  return { entry, runtime, uploadRoot };
}
const bodies = (tag) => ({
  products: { name: `E08 ${tag} producto`, slug: "e08-shared", brand: `E08 ${tag}`, categorySlug: "e08-shared", price: 100, stock: 9 },
  categories: { slug: `e08-new-${tag.toLowerCase()}`, name: `E08 ${tag}`, icon: "Store", gradient: "bg-primary" },
  banners: { placement: "PROMO", title: `E08 ${tag}`, href: "/", sectionId: `e08-${tag}-section` },
  discounts: { code: "E08-SHARED", type: "FIXED", value: 10 },
  "home-sections": { kind: "PRODUCTS", title: `E08 ${tag}`, source: "CATEGORY", categorySlug: "e08-shared" },
  orders: { status: "PACKING" }, users: { name: `E08 ${tag} usuario`, email: `e08-user-${tag.toLowerCase()}@variedadeslosprimos.com`, status: "ACTIVE" },
  support: { status: "EN_PROCESO" }, notifications: {},
});

try {
  if (mode === "prepare") {
    const [source, first, second] = extra; assert(/^e07_rehearsal_[a-z0-9_]+$/.test(source));
    await fs.mkdir(directory, { recursive: true });
    const docker = ["exec", "-i", "-e", `MYSQL_PWD=${decodeURIComponent(url.password)}`, container];
    const backup = spawnSync("docker", [...docker, "mariadb-dump", `-u${decodeURIComponent(url.username)}`, "--single-transaction", "--routines", "--triggers", "--skip-comments", source], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(backup.status, 0, backup.stderr); await fs.writeFile(path.join(directory, `${database}-source.sql`), backup.stdout, { flag: "wx" });
    const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
    try { await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } finally { await connection.end(); }
    const restored = spawnSync("docker", [...docker, "mariadb", `-u${decodeURIComponent(url.username)}`, database], { input: backup.stdout, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }); assert.equal(restored.status, 0, restored.stderr);
    const stores = (await raw.storeDomain.findMany({ where: { hostname: { in: [first, second] } } })).sort((a, b) => [first, second].indexOf(a.hostname) - [first, second].indexOf(b.hostname)).map((domain) => domain.storeId); assert.equal(stores.length, 2);
    for (const [index, storeId] of stores.entries()) {
      const tag = index ? "B" : "A";
      const adminId = `e08-admin-${tag}`, userId = `e08-user-${tag}`;
      for (const [id, name] of [[adminId, `E08 ${tag} administrador`], [userId, `E08 ${tag} usuario`]]) await raw.user.create({ data: { id, name, email: `${id.toLowerCase()}@variedadeslosprimos.com`, role: "CUSTOMER" } });
      await raw.storeMembership.createMany({ data: [{ storeId, userId: adminId, role: index ? "OWNER" : "ADMIN" }, { storeId: stores[1 - index], userId: adminId, role: "CUSTOMER" }, { storeId, userId, role: "CUSTOMER" }] });
      for (const slug of ["e08-shared", `e08-only-${tag.toLowerCase()}`]) await raw.category.create({ data: { storeId, slug, name: `E08 ${tag} categoría`, icon: "Store", gradient: "bg-primary", imageUrl: `https://${index ? second : first}/api/uploads/${prefix(storeId)}referenced.png` } });
      await raw.product.create({ data: { id: `e08-${tag}-product`, storeId, slug: "e08-shared", sku: "E08-SAME-SKU", name: `E08 ${tag} producto`, brand: `E08 ${tag}`, categorySlug: "e08-shared", price: 100, stock: 9, cost: 20 } });
      await raw.productVariant.create({ data: { id: `e08-${tag}-variant`, storeId, productId: `e08-${tag}-product`, name: `E08 ${tag} variante`, stock: 8 } });
      await raw.productSpec.create({ data: { storeId, productId: `e08-${tag}-product`, key: "E08", value: tag } });
      await raw.productImage.create({ data: { storeId, productId: `e08-${tag}-product`, url: `/api/uploads/${prefix(storeId)}referenced.png`, isPrimary: true } });
      await raw.homeSection.create({ data: { id: `e08-${tag}-section`, storeId, kind: "BANNERS", sortOrder: 500 } });
      await raw.homeSection.create({ data: { id: `e08-${tag}-products-section`, storeId, kind: "PRODUCTS", title: `E08 ${tag}`, categorySlug: "e08-shared", source: "CATEGORY", bgImageUrl: `/api/uploads/${prefix(storeId)}referenced.png`, sortOrder: 501 } });
      await raw.banner.create({ data: { id: `e08-${tag}-banner`, storeId, placement: "PROMO", title: `E08 ${tag} banner`, href: "/", sectionId: `e08-${tag}-section` } });
      await raw.discountCode.create({ data: { id: `e08-${tag}-discount`, storeId, code: "E08-SHARED", type: "FIXED", value: 10 } });
      await raw.order.create({ data: { id: `e08-${tag}-order`, storeId, code: `E08-${tag}`, userId, shippingName: `E08 ${tag}`, email: `e08-user-${tag.toLowerCase()}@variedadeslosprimos.com`, phone: "", street: "E08", city: "E08", state: "E08", zip: "000", subtotal: 100, total: 100 } });
      await raw.orderItem.create({ data: { storeId, orderId: `e08-${tag}-order`, productId: `e08-${tag}-product`, variantId: `e08-${tag}-variant`, name: `E08 ${tag}`, brand: "E08", qty: 1, unitPrice: 100 } });
      await raw.orderStatusEvent.create({ data: { storeId, orderId: `e08-${tag}-order`, status: "PENDING" } });
      await raw.payment.create({ data: { id: `e08-${tag}-payment`, storeId, orderId: `e08-${tag}-order`, method: "COD", amount: 100 } });
      await raw.supportMessage.create({ data: { id: `e08-${tag}-message`, storeId, userId, radicado: `E08-${tag}`, kind: "CONTACTO", name: `E08 ${tag}`, email: `e08-user-${tag.toLowerCase()}@variedadeslosprimos.com`, subject: `E08 ${tag}`, message: `E08 ${tag} mensaje` } });
      await raw.notification.create({ data: { id: `e08-${tag}-notification`, storeId, type: "ORDER_CREATED", title: `E08 ${tag} aviso`, entityId: `e08-${tag}-order` } });
    }
    await fs.writeFile(stateFile, JSON.stringify({ stores, hosts: [first, second], backupSha256: hash(backup.stdout) }, null, 2), { flag: "wx" });
    console.log(`E08 copia nueva ${database}; respaldo externo SHA256 ${hash(backup.stdout)}; sin modificar bases preexistentes.`);
  } else {
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const runtime = ["gc", "pages"].includes(mode) ? state.runtime : await makeRuntime(state, mode === "baseline" ? "baseline" : "runtime");
    assert(runtime.runtime.startsWith(path.resolve(directory) + path.sep) && runtime.runtime !== repo);
    const port = Number(extra[0]); assert(port > 1024 && port < 65536);
    const secret = randomBytes(32).toString("hex"), environment = { ...process.env, SESSION_SECRET: secret, PORT: String(port), HOSTNAME: "127.0.0.1" };
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "STORE_EMAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "WOMPI_PUBLIC_KEY", "WOMPI_PRIVATE_KEY", "WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET"]) environment[key] = "";
    server = spawn(process.execPath, [runtime.entry], { cwd: runtime.runtime, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.on("data", (data) => { serverLog = (serverLog + data).slice(-8000); }); server.stderr.on("data", (data) => { serverLog = (serverLog + data).slice(-8000); });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) { try { ready = (await request(port, state.hosts[0], "/api/cart")).status === 200; } catch { /* Solo este servidor. */ } if (ready || server.exitCode !== null) break; await new Promise((resolve) => setTimeout(resolve, 500)); }
    assert(ready, serverLog);
    const cookies = await Promise.all(["A", "B"].map(async (tag) => {
      const user = await raw.user.findUniqueOrThrow({ where: { id: `e08-admin-${tag}` } });
      const token = await new SignJWT({ role: "ADMIN", sv: user.sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("20m").sign(new TextEncoder().encode(secret)); return `vlp_session=${token}`;
    }));
    const call = async (index, target, expected = 200, body, method = body === undefined ? "GET" : "POST", cookie = cookies[index], headers = {}) => {
      const result = await request(port, state.hosts[index], target, { method, body, headers: { cookie, ...headers } });
      assert.equal(result.status, expected, `${method} ${target}: ${result.status} ${result.text}`); assert.match(result.headers["cache-control"], /private.*no-store/);
      return { ...result, body: JSON.parse(result.text) };
    };
    const upload = async (index, preset = "product", cookie = cookies[index]) => {
      const boundary = `E08${randomBytes(12).toString("hex")}`, image = await fs.readFile(path.join(repo, "public/email-logo.png"));
      const rawBody = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="preset"\r\n\r\n${preset}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="e08.png"\r\nContent-Type: image/png\r\n\r\n`), image, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      return request(port, state.hosts[index], "/api/admin/uploads", { method: "POST", rawBody, headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(rawBody.length) } });
    };
    const resolveRoute = (route, tag) => {
      const resource = route.split("/")[3];
      const ids = { products: `e08-${tag}-product`, categories: `e08-only-${tag.toLowerCase()}`, banners: `e08-${tag}-banner`, discounts: `e08-${tag}-discount`, "home-sections": `e08-${tag}-section`, orders: `e08-${tag}-order`, users: `e08-user-${tag}`, support: `e08-${tag}-message`, notifications: `e08-${tag}-notification` };
      return route.replace(/\[(?:id|slug)\]/g, ids[resource]);
    };
    const payloadFor = (route, tag) => route.endsWith("/password") ? { password: "admin123" } : route.endsWith("/offer") ? { offerActive: true, offerPrice: 50 } : route.endsWith("/move") ? { direction: "up" } : route.endsWith("/email") ? { includeTracking: false } : bodies(tag)[route.split("/")[3]] ?? {};
    const readEndpoints = ["products", "categories", "banners", "discounts", "home-sections", "orders", "payments", "users", "support", "notifications", "stats", "search?q=E08", "products/e08-A-product", "orders/e08-A-order", "users/e08-user-A"];
    if (mode === "baseline") {
      const contracts = {};
      for (const target of readEndpoints) contracts[target] = shape((await call(0, `/api/admin/${target}`)).body);
      const uploaded = await upload(0); assert.equal(uploaded.status, 201, uploaded.text); contracts.upload = shape(JSON.parse(uploaded.text));
      const alias = await request(port, state.hosts[0], `/api/uploads/${prefix(state.stores[0])}link-to-b/referenced.png`);
      console.log(`E08 baseline: alias físico hacia B respondió ${alias.status}; se exige 404 tras el cambio.`);
      await fs.writeFile(contractsFile, JSON.stringify(contracts, null, 2), { flag: "wx" });
    } else if (mode === "http") {
      const contracts = JSON.parse(await fs.readFile(contractsFile, "utf8")), routes = await inventory();
      await check("inventario completo de handlers administrativos, sin clientes/raw SQL de plataforma", async () => { assert(routes.length > 45); console.log(`${routes.length} combinaciones de ruta y método inventariadas`); });
      await check("contratos previos de listados, detalles, métricas y búsqueda conservados", async () => {
        for (const target of readEndpoints) assert.deepEqual(shape((await call(0, `/api/admin/${target}`)).body), contracts[target], target);
      });
      await check("cada método rechaza admin A en Host B antes de efectos", async () => {
        const before = await snapshot(state.stores[1]);
        for (const item of routes) {
          let target = resolveRoute(item.route, "B"); if (target.endsWith("/gc")) target += "?dryRun=1";
          if (item.route === "/api/admin/uploads") { const result = await upload(1, "product", cookies[0]); assert.equal(result.status, 403); }
          else await call(1, target, 403, item.method === "GET" || item.method === "DELETE" ? undefined : payloadFor(item.route, "B"), item.method, cookies[0]);
        }
        assert.deepEqual(await snapshot(state.stores[1]), before);
      });
      await check("GET/POST/PATCH/DELETE con IDs de B en Host A devuelven 404 sin cambiar B", async () => {
        const before = await snapshot(state.stores[1]);
        for (const item of routes.filter((item) => item.route.includes("["))) await call(0, resolveRoute(item.route, "B"), 404, item.method === "GET" || item.method === "DELETE" ? undefined : payloadFor(item.route, "A"), item.method);
        assert.deepEqual(await snapshot(state.stores[1]), before);
      });
      await check("referencias ajenas en POST/PATCH se rechazan antes de crear o modificar", async () => {
        const beforeA = await snapshot(state.stores[0]), beforeB = await snapshot(state.stores[1]);
        const foreignImage = `https://${state.hosts[1]}/api/uploads/${prefix(state.stores[1])}referenced.png`;
        for (const [resource, body] of [["products", { ...bodies("A").products, slug: "e08-bad", categorySlug: "e08-only-b" }], ["banners", { ...bodies("A").banners, sectionId: "e08-B-section" }], ["home-sections", { ...bodies("A")["home-sections"], categorySlug: "e08-only-b" }]]) await call(0, `/api/admin/${resource}`, 404, body);
        for (const [resource, id, body] of [["products", "e08-A-product", { ...bodies("A").products, images: [foreignImage] }], ["categories", "e08-only-a", { ...bodies("A").categories, imageUrl: foreignImage }], ["banners", "e08-A-banner", { ...bodies("A").banners, imageUrl: foreignImage }], ["home-sections", "e08-A-products-section", { ...bodies("A")["home-sections"], bgImageUrl: foreignImage }]]) await call(0, `/api/admin/${resource}/${id}`, 403, body, "PATCH");
        assert.deepEqual(await snapshot(state.stores[0]), beforeA); assert.deepEqual(await snapshot(state.stores[1]), beforeB);
      });
      await check("exportaciones propias mantienen CSV; IDs o tienda ajenos fallan cerrados", async () => {
        for (const [resource, id, foreign] of [["orders", "e08-A-order", "e08-B-order"], ["payments", "e08-A-payment", "e08-B-payment"]]) {
          const exported = await request(port, state.hosts[0], `/api/admin/${resource}/export?id=${id}`, { headers: { cookie: cookies[0] } });
          assert.equal(exported.status, 200); assert.match(exported.headers["content-type"], /text\/csv/); assert(exported.text.includes("E08-A")); assert(!exported.text.includes("E08-B"));
          await call(0, `/api/admin/${resource}/export?id=${foreign}`, 404); await call(0, `/api/admin/${resource}/export?storeId=${state.stores[1]}`, 403);
        }
        await call(0, "/api/admin/payments/export?orderId=e08-B-order", 404);
      });
      const uploadedUrls = [];
      await check("subida real y asignación compatibles; namespaces A/B distintos; preset heredado rechazado", async () => {
        for (const index of [0, 1]) {
          const result = await upload(index); assert.equal(result.status, 201, result.text);
          const body = JSON.parse(result.text); assert.deepEqual(shape(body), contracts.upload);
          const value = body.data.url; uploadedUrls.push(value); assert(imageRefSchema.safeParse(value).success); assert.equal(new URL(value).origin, `https://${state.hosts[index]}`); assert(new URL(value).pathname.includes(`/stores/${hash(state.stores[index])}/`));
          await call(index, "/api/admin/categories", 201, { ...bodies(index ? "B" : "A").categories, slug: `e08-upload-${index}`, imageUrl: value, storeId: state.stores[1 - index] });
        }
        assert.equal((await upload(0, "__proto__")).status, 400);
        const copied = new URL(uploadedUrls[1]); await call(0, "/api/admin/categories", 403, { ...bodies("A").categories, slug: "e08-copied-image", imageUrl: `https://${state.hosts[0]}${copied.pathname}` });
      });
      await check("lectura pública y symlink no atraviesan namespaces; caché privada", async () => {
        const own = await request(port, state.hosts[0], `/api/uploads/${prefix(state.stores[0])}referenced.png`); assert.equal(own.status, 200);
        assert.equal((await request(port, state.hosts[0], `/api/uploads/${prefix(state.stores[1])}referenced.png`)).status, 404);
        assert.equal((await request(port, state.hosts[0], `/api/uploads/${prefix(state.stores[0])}link-to-b/referenced.png`)).status, 404);
      });
      await check("CRUD propio de catálogo/descuento/home/banner conserva respuestas y B", async () => {
        const beforeB = await snapshot(state.stores[1]);
        const category = { ...bodies("A").categories, slug: "e08-crud", imageUrl: uploadedUrls[0] }; await call(0, "/api/admin/categories", 201, category);
        await call(0, "/api/admin/categories/e08-crud", 200, { ...category, name: "E08 actualizada" }, "PATCH");
        const productBody = { ...bodies("A").products, slug: "e08-crud", categorySlug: "e08-crud", sku: "E08-CRUD", images: [uploadedUrls[0]], specs: [{ key: "E08", value: "propio" }], variants: [{ name: "E08", stock: 3 }] };
        const created = (await call(0, "/api/admin/products", 201, productBody)).body.data;
        await call(0, `/api/admin/products/${created.id}`, 200, { ...productBody, name: "E08 actualizado" }, "PATCH");
        const detail = (await call(0, `/api/admin/products/${created.id}`)).body.data; assert.equal(detail.images[0], uploadedUrls[0]); assert.equal(detail.variants.length, 1);
        await call(0, `/api/admin/products/${created.id}/offer`, 200, { offerActive: true, offerPrice: 50 }, "PATCH");
        const section = (await call(0, "/api/admin/home-sections", 201, { kind: "BANNERS" })).body.data;
        const bannerBody = { ...bodies("A").banners, sectionId: section.id, imageUrl: uploadedUrls[0] }, banner = (await call(0, "/api/admin/banners", 201, bannerBody)).body.data;
        await call(0, `/api/admin/banners/${banner.id}`, 200, { ...bannerBody, title: "E08 actualizado" }, "PATCH");
        await call(0, `/api/admin/home-sections/${section.id}`, 200, { kind: "BANNERS", active: true }, "PATCH");
        await call(0, `/api/admin/home-sections/${section.id}/move`, 200, { direction: "up" }, "PATCH");
        await call(0, `/api/admin/banners/${banner.id}`, 200, undefined, "DELETE"); await call(0, `/api/admin/home-sections/${section.id}`, 200, undefined, "DELETE");
        const discount = (await call(0, "/api/admin/discounts", 201, { ...bodies("A").discounts, code: "E08-CRUD" })).body.data;
        await call(0, `/api/admin/discounts/${discount.id}`, 200, { ...bodies("A").discounts, code: "E08-CRUD", value: 15 }, "PATCH"); await call(0, `/api/admin/discounts/${discount.id}`, 200, undefined, "DELETE");
        await call(0, `/api/admin/products/${created.id}`, 200, undefined, "DELETE"); await call(0, "/api/admin/categories/e08-crud", 200, undefined, "DELETE");
        assert.deepEqual(await snapshot(state.stores[1]), beforeB);
      });
      await check("fallo en extras revierte producto y relaciones completos", async () => {
        const before = await snapshot(state.stores[0]);
        const body = { ...bodies("A").products, name: "E08 no guardar", specs: [{ key: "duplicada", value: "1" }, { key: "duplicada", value: "2" }] };
        await call(0, "/api/admin/products/e08-A-product", 409, body, "PATCH"); assert.deepEqual(await snapshot(state.stores[0]), before);
        await call(0, "/api/admin/products", 409, { ...body, slug: "e08-rollback" }); assert.equal(await raw.product.count({ where: { storeId: state.stores[0], slug: "e08-rollback" } }), 0);
      });
      await check("usuarios por membresía, pedidos, soporte y avisos propios no afectan B", async () => {
        const beforeB = await snapshot(state.stores[1]);
        const input = { name: "E08 cliente nuevo", email: "e08-crud@variedadeslosprimos.com", status: "ACTIVE" }, user = (await call(0, "/api/admin/users", 201, input)).body.data;
        await call(0, `/api/admin/users/${user.id}`, 200, { ...input, status: "INACTIVE" }, "PATCH"); await call(0, `/api/admin/users/${user.id}`, 200, undefined, "DELETE"); assert(await raw.user.findUnique({ where: { id: user.id } }));
        await call(0, "/api/admin/orders/e08-A-order", 200, { status: "PACKING" }, "PATCH");
        await call(0, "/api/admin/support/e08-A-message", 200, { status: "EN_PROCESO", response: "E08 respuesta" }, "PATCH");
        await call(0, "/api/admin/notifications/e08-A-notification", 200, {}, "PATCH"); await call(0, "/api/admin/notifications/read-all", 200, {});
        assert.deepEqual(await snapshot(state.stores[1]), beforeB);
      });
      await check("60 lecturas concurrentes de catálogo/pedidos/usuarios/estadísticas sin mezcla", async () => {
        await Promise.all(Array.from({ length: 60 }, async (_, index) => {
          const own = index % 2, tag = own ? "B" : "A";
          const result = await call(own, ["/api/admin/products", "/api/admin/orders", "/api/admin/users", "/api/admin/stats", "/api/admin/support"][Math.floor(index / 2) % 5]);
          if (Array.isArray(result.body.data)) {
            for (const row of result.body.data.filter((row) => row.id?.startsWith("e08-"))) {
              if (row.id.startsWith("e08-admin-")) continue;
              assert(!row.id.includes(`-${tag === "A" ? "B" : "A"}-`));
              assert.notEqual(row.id, `e08-user-${tag === "A" ? "B" : "A"}`);
            }
          }
        }));
      });
      const plans = [];
      await check("GC dry-run reconoce referencias absolutas/relativas, omite B/symlinks y no borra", async () => {
        const before = await fileManifest(runtime.uploadRoot);
        for (const index of [0, 1]) {
          const report = (await call(index, "/api/admin/uploads/gc?dryRun=1", 200, {})).body.data;
          assert.equal(report.deleted, 0); assert(report.referenced >= 2); assert(report.sample.every((key) => key.startsWith(`stores/${hash(state.stores[index])}/`) || (index === 0 && key === "2026-11/e08-legacy.png")));
          assert(!report.sample.some((key) => key.includes("link-to-b") || key.endsWith("referenced.png"))); plans.push(report);
        }
        assert.deepEqual(await fileManifest(runtime.uploadRoot), before);
        const backupRoot = path.join(directory, `${database}-uploads-backup`); await fs.cp(runtime.uploadRoot, backupRoot, { recursive: true, filter: async (file) => !(await fs.lstat(file)).isSymbolicLink() });
        assert.deepEqual(await fileManifest(backupRoot), before);
        state.runtime = runtime; state.gcPlans = plans; state.fileHashes = before;
        await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
        console.log(`GC pendiente de confirmación humana: ${plans.map((plan) => plan.sample.join(", ")).join(" | ")}; copia ${backupRoot}`);
      });
    } else if (mode === "pages") {
      await check("panel SSR propio renderiza en A/B y rechaza IDs ajenos y membresía insuficiente", async () => {
        const beforeA = await snapshot(state.stores[0]), beforeB = await snapshot(state.stores[1]);
        const pages = ["", "/products", "/categories", "/banners", "/home", "/discounts", "/orders", "/payments", "/users", "/mensajes", "/almacenamiento"];
        for (const index of [0, 1]) {
          const tag = index ? "B" : "A", foreign = index ? "A" : "B";
          for (const suffix of pages.concat([`/products/e08-${tag}-product`, `/orders/e08-${tag}-order`, `/users/e08-user-${tag}`, `/home/e08-${tag}-products-section/edit`])) {
            const response = await request(port, state.hosts[index], `/admin${suffix}`, { headers: { cookie: cookies[index] } });
            assert.equal(response.status, 200, `${state.hosts[index]} /admin${suffix}`);
            assert(!response.text.includes(`e08-${foreign}-product`)); assert(!response.text.includes(`e08-${foreign}-order`));
          }
          const missing = await request(port, state.hosts[index], `/admin/products/e08-${foreign}-product`, { headers: { cookie: cookies[index] } }); assert.equal(missing.status, 404);
        }
        const denied = await request(port, state.hosts[1], "/admin/products", { headers: { cookie: cookies[0] } }); assert([302, 303, 307, 308, 403].includes(denied.status));
        assert.deepEqual(await snapshot(state.stores[0]), beforeA); assert.deepEqual(await snapshot(state.stores[1]), beforeB);
      });
    } else {
      assert.equal(extra[1], "--delete-confirmed", "GC requiere confirmación humana después de revisión, respaldo y dry-run");
      await check("GC confirmado elimina solo huérfanos del ensayo, sin tocar archivos referenciados ni otra tienda", async () => {
        for (const index of [0, 1]) {
          const preview = (await call(index, "/api/admin/uploads/gc?dryRun=1", 200, {})).body.data;
          assert.deepEqual(preview.sample.sort(), [...state.gcPlans[index].sample].sort()); assert.equal(preview.orphans, preview.sample.length);
          const before = await fileManifest(runtime.uploadRoot);
          for (const key of preview.sample) assert.equal(before[key], state.fileHashes[key]);
          const report = (await call(index, "/api/admin/uploads/gc", 200, {})).body.data; assert.equal(report.deleted, preview.orphans);
          const after = await fileManifest(runtime.uploadRoot);
          for (const [key, digest] of Object.entries(before)) if (preview.sample.includes(key)) assert.equal(after[key], undefined); else assert.equal(after[key], digest);
        }
      });
    }
  }
  console.log(`E08 ${mode}: ${checks} grupos correctos; solo ${database} y runtime externo; uploads del workspace intactos.`);
} catch (error) {
  console.error(serverLog);
  throw error;
} finally {
  if (server && server.exitCode === null) { const exited = new Promise((resolve) => server.once("exit", resolve)); server.kill(); await exited; }
  await raw.$disconnect();
}
