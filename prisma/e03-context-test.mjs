import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { registerHooks } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import mariadb from "mariadb";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const core = await import("../src/lib/server/store-context.ts");
const { storeScopedClient } = await import("../src/lib/server/store-client.ts");
const { saveUpload, readUpload, listUploads, deleteUpload, resolveUploadPath } = await import("../src/lib/server/storage.ts");

const [mode, directory, container, ...extra] = process.argv.slice(2);
assert(["prepare", "unit", "http"].includes(mode));
assert(path.isAbsolute(directory) && !path.resolve(directory).startsWith(process.cwd() + path.sep));
const url = new URL(process.env.DATABASE_URL);
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const database = url.pathname.slice(1);
assert(/^e03_rehearsal_[a-z0-9_]{1,28}$/.test(database));
const stateFile = path.join(directory, `${database}.json`);
const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
const scoped = storeScopedClient(raw, async () => core.requireStoreContext());
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let checks = 0;
const check = async (label, callback) => { await callback(); checks++; console.log(`OK ${label}`); };
const resolve = (host, headers = {}, options = {}) => core.resolveStoreContext(raw, new Headers({ host, ...headers }), { environment: "production", ...options });

function localRequest(port, host, target, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: target, headers: { host, ...headers }, timeout: 30_000 }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("HTTP timeout"))); req.end();
  });
}

try {
  if (mode === "prepare") {
    const [source, firstHost, secondHost] = extra;
    assert(/^e02_rehearsal_[a-z0-9_]+$/.test(source));
    const hostA = core.normalizeAuthority(firstHost).hostname;
    const hostB = core.normalizeAuthority(secondHost).hostname;
    assert.notEqual(hostA, hostB);
    await fs.mkdir(directory, { recursive: true });
    const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
    try {
      // Sin IF NOT EXISTS: nunca reutilizar ni borrar una base preexistente.
      await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally { await connection.end(); }
    const args = ["exec", "-i", "-e", `MYSQL_PWD=${decodeURIComponent(url.password)}`, container];
    const dump = spawnSync("docker", [...args, "mariadb-dump", `-u${decodeURIComponent(url.username)}`, "--single-transaction", "--routines", "--triggers", "--skip-comments", source], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(dump.status, 0, dump.stderr);
    await fs.writeFile(path.join(directory, `${database}-source.sql`), dump.stdout);
    const restored = spawnSync("docker", [...args, "mariadb", `-u${decodeURIComponent(url.username)}`, database], { input: dump.stdout, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(restored.status, 0, restored.stderr);
    const stores = await Promise.all([
      raw.store.findUniqueOrThrow({ where: { legacyKey: "original" } }),
      raw.store.findUniqueOrThrow({ where: { slug: "frutas-del-valle" } }),
    ]);
    for (const [index, store] of stores.entries()) {
      await raw.store.update({ where: { id: store.id }, data: { active: true } });
      await raw.storeDomain.create({ data: { hostname: index === 0 ? hostA : hostB, storeId: store.id, verifiedAt: new Date() } });
      await raw.category.create({ data: { storeId: store.id, slug: "e03-shared", name: `E03 ${store.name}`, icon: "", gradient: "" } });
      await raw.product.create({ data: { id: `e03-product-${index}`, storeId: store.id, slug: "e03-shared", name: `E03 ${store.name}`, brand: store.name, categorySlug: "e03-shared", price: 100, stock: 5 } });
      await raw.cart.create({ data: { id: `e03-cart-${index}`, storeId: store.id, sessionId: "e03-shared-session" } });
      await raw.cartItem.create({ data: { storeId: store.id, cartId: `e03-cart-${index}`, productId: `e03-product-${index}`, qty: index + 1 } });
    }
    await fs.writeFile(stateFile, JSON.stringify({ hostA, hostB, storeA: stores[0].id, storeB: stores[1].id, names: stores.map((store) => store.name) }, null, 2));
    console.log(`PREPARADO ${database}: copia de ${source}, hosts ${hostA} y ${hostB}; ninguna base preexistente modificada`);
  } else {
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    const { hostA, hostB, storeA, storeB } = state;
    const [a, b] = await Promise.all([resolve(hostA), resolve(hostB)]);
    if (mode === "unit") {
      await check("dos hosts activos distintos y normalización de mayúsculas, punto final y puerto", async () => {
        assert.equal(a.id, storeA); assert.equal(b.id, storeB);
        assert.equal((await resolve(`${hostA.toUpperCase()}.:03103`)).id, storeA);
        assert.equal(core.normalizeAuthority(`${hostA}.:03103`).authority, `${hostA}:3103`);
      });
      await check("hosts desconocidos, inválidos y contexto arbitrario rechazados", async () => {
        await assert.rejects(resolve(`unknown-${hostA}`), { status: 404 });
        for (const invalid of ["", " ", `${hostA}/bad`, `${hostA},${hostB}`, `x@${hostA}`, `${hostA}:0`, `${hostA}:65536`, `${hostA}:abc`, `${hostA}..`, `${hostA}%2e`, "127.1", "2130706433"]) {
          assert.throws(() => core.normalizeAuthority(invalid), { status: 400 });
        }
        assert.throws(() => core.runWithStoreContext({ id: storeB }, () => null), { status: 400 });
        assert.throws(() => core.requireStoreContext(), { status: 503 });
        assert.throws(() => core.runWithStoreContext(a, () => core.runWithStoreContext(b, () => null)), { status: 400 });
      });
      await check("localhost e IPs de loopback únicamente en desarrollo", async () => {
        for (const host of ["localhost:3103", "localhost.", "127.0.0.1:3103", "[::1]:3103", "[::ffff:127.0.0.1]"]) {
          await assert.rejects(resolve(host), { status: 404 });
          assert.equal((await resolve(host, {}, { environment: "development" })).id, storeA);
        }
      });
      await check("cabeceras reenviadas y tenantId de cliente sin autoridad; proxy solo con peer confiable", async () => {
        const spoof = { "x-forwarded-host": hostB, forwarded: `host=${hostB}`, "x-forwarded-for": "127.0.0.1", "x-tenant-id": storeB, "x-store-id": storeB };
        assert.equal((await resolve(hostA, spoof)).id, storeA);
        await assert.rejects(resolve(`unknown-${hostA}`, spoof), { status: 404 });
        assert.equal((await resolve(hostA, spoof, { connection: { peerAddress: "127.0.0.2", allowedPeers: ["127.0.0.1"] } })).id, storeA);
        const connection = { peerAddress: "127.0.0.1", allowedPeers: ["127.0.0.1"] };
        assert.equal((await resolve(hostA, spoof, { connection })).id, storeB);
        await assert.rejects(resolve(hostA, { "x-forwarded-host": `${hostA},${hostB}` }, { connection }), { status: 400 });
        await assert.rejects(resolve(hostA, { forwarded: `host=${hostA}`, "x-forwarded-host": hostB }, { connection }), { status: 400 });
      });
      await check("dominios sin verificar o tiendas inactivas fallan cerrados", async () => {
        await raw.store.update({ where: { id: storeB }, data: { active: false } });
        try { await assert.rejects(resolve(hostB), { status: 404 }); }
        finally { await raw.store.update({ where: { id: storeB }, data: { active: true } }); }
        await raw.storeDomain.update({ where: { hostname: hostA }, data: { verifiedAt: null } });
        try { await assert.rejects(resolve(hostA), { status: 404 }); }
        finally { await raw.storeDomain.update({ where: { hostname: hostA }, data: { verifiedAt: new Date() } }); }
      });
      await check("80 requests SQL concurrentes, includes compartidos inmutables y conteos por tienda", async () => {
        const sharedProducts = Object.freeze({ where: Object.freeze({ slug: "e03-shared" }), include: Object.freeze({ category: true }) });
        const sharedUsers = Object.freeze({ where: Object.freeze({ id: "e02-user" }), include: Object.freeze({ orders: true, _count: Object.freeze({ select: Object.freeze({ orders: true }) }) }) });
        await Promise.all(Array.from({ length: 80 }, (_, index) => core.runWithStoreContext(index % 2 ? a : b, async () => {
          const expected = index % 2 ? storeA : storeB;
          await delay(index % 5);
          const [products, user] = await Promise.all([scoped.product.findMany(sharedProducts), scoped.user.findUniqueOrThrow(sharedUsers)]);
          assert.equal(products.length, 1); assert.equal(products[0].storeId, expected); assert.equal(products[0].category.storeId, expected);
          assert(user.orders.every((order) => order.storeId === expected)); assert.equal(user.orders.length, user._count.orders);
          assert.equal(core.requireStoreContext().id, expected);
        })));
        assert.equal(core.currentStoreContext(), undefined);
      });
      await check("escrituras y transacciones usan la tienda validada; IDs ajenos y SQL directo bloqueados", async () => {
        await core.runWithStoreContext(b, async () => {
          const created = await scoped.product.create({ data: { id: "e03-created-b", slug: "e03-created-b", name: "E03", brand: "E03", price: 1, categorySlug: "e03-shared" } });
          assert.equal(created.storeId, storeB);
          const [rows, count] = await scoped.$transaction([scoped.product.findMany({ where: { slug: "e03-shared" } }), scoped.product.count({ where: { slug: "e03-shared" } })]);
          assert.equal(count, 1); assert.equal(rows[0].storeId, storeB);
        });
        await core.runWithStoreContext(a, async () => {
          assert.equal(await scoped.product.findUnique({ where: { id: "e03-product-1" } }), null);
          await assert.rejects(scoped.product.update({ where: { id: "e03-product-1" }, data: { stock: 0 } }), { code: "P2025" });
          assert.equal((await scoped.product.deleteMany({ where: { id: "e03-product-1" } })).count, 0);
          await assert.rejects(scoped.product.findMany({ where: { storeId: storeB } }), /contexto de tienda/);
          await assert.rejects(scoped.$queryRawUnsafe("SELECT 1"), { status: 403 });
          await assert.rejects(scoped.user.update({ where: { id: "e02-user" }, data: { orders: { deleteMany: {} } } }), /escrituras comerciales/);
        });
      });
      await check("lectura, listado y borrado de imágenes no cruzan tiendas", async () => {
        const keys = [];
        for (const [index, context] of [a, b].entries()) {
          keys.push(await core.runWithStoreContext(context, () => saveUpload(Buffer.from(`E03-${index}`), "webp")));
        }
        for (const [index, context] of [a, b].entries()) {
          await core.runWithStoreContext(context, async () => {
            assert.equal((await readUpload(keys[index].key)).toString(), `E03-${index}`);
            assert.equal(await readUpload(keys[1 - index].key), null);
            assert.equal(await deleteUpload(keys[1 - index].key), false);
            assert(!(await listUploads()).some((entry) => entry.key === keys[1 - index].key));
          });
        }
        state.uploads = keys; await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
      });
    } else {
      const port = Number(extra[0]); assert(port > 0 && port < 65536);
      await check("60 requests HTTP concurrentes de catálogo, detalle y carrito con una cookie compartida", async () => {
        await Promise.all(Array.from({ length: 60 }, async (_, index) => {
          const own = index % 2; const host = `${own ? hostB : hostA}:${port}`;
          const target = ["/api/products?search=E03", "/api/products/e03-shared", "/api/cart"][index % 3];
          const response = await localRequest(port, host, target, { cookie: "vlp_cart_sid=e03-shared-session" });
          assert.equal(response.status, 200, response.body.toString());
          assert.match(response.headers["cache-control"], /private.*no-store/);
          assert.match(response.headers.vary, /Host/);
          const text = response.body.toString();
          assert(text.includes(state.names[own]), text); assert(!text.includes(state.names[1 - own]), text);
        }));
      });
      await check("HTTP: unknown/localhost rechazados también en login, robots, sitemap y APIs", async () => {
        for (const host of [`unknown-${hostA}`, "localhost", "127.0.0.1"]) {
          for (const target of ["/login", "/api/categories", "/api/auth/me", "/robots.txt", "/sitemap.xml"]) {
            const response = await localRequest(port, host, target);
            assert.equal(response.status, 404, `${host}${target}: ${response.body}`);
            assert.match(response.headers["cache-control"], /no-store/);
          }
        }
      });
      await check("20 renders RSC concurrentes mantienen su propio contexto; guardia administrativa conservada", async () => {
        await Promise.all(Array.from({ length: 20 }, async (_, index) => {
          const own = index % 2;
          const response = await localRequest(port, own ? hostB : hostA, "/product/e03-shared");
          assert.equal(response.status, 200, response.body.toString());
          const text = response.body.toString();
          assert(text.includes(`E03 ${state.names[own]}`));
          assert(!text.includes(`E03 ${state.names[1 - own]}`));
          assert.match(response.headers["cache-control"], /no-store/);
        }));
        for (const host of [hostA, hostB]) {
          assert.equal((await localRequest(port, host, "/api/admin/products")).status, 401);
          const admin = await localRequest(port, host, "/admin");
          assert.equal(admin.status, 307); assert(admin.headers.location.startsWith(`https://${host}/login`));
        }
      });
      await check("HTTP: Host manda sobre cabeceras, parámetros y requests alternados sin caché cruzado", async () => {
        for (let i = 0; i < 8; i++) {
          const own = i % 2;
          const response = await localRequest(port, `${own ? hostB.toUpperCase() : hostA.toUpperCase()}.:${port}`, `/api/categories?storeId=${own ? storeA : storeB}&tenantId=${own ? storeA : storeB}`, {
            "x-forwarded-host": own ? hostA : hostB, forwarded: `host=${own ? hostA : hostB}`, "x-tenant-id": own ? storeA : storeB,
          });
          assert.equal(response.status, 200, response.body.toString());
          const rows = JSON.parse(response.body).data;
          assert(rows.every((row) => row.storeId === (own ? storeB : storeA)));
        }
      });
      await check("HTTP: sitemap/robots por dominio e imágenes originales/optimizadas aisladas", async () => {
        for (const [index, host] of [hostA, hostB].entries()) {
          for (const target of ["/sitemap.xml", "/robots.txt"]) {
            const response = await localRequest(port, host, target);
            assert.equal(response.status, 200, response.body.toString());
            assert(response.body.toString().includes(`https://${host}/`));
            assert(!response.body.toString().includes(`https://${index ? hostA : hostB}/`));
          }
          const own = state.uploads[index].url; const other = state.uploads[1 - index].url;
          const defaultPort = await localRequest(port, `${host}:443`, `/_next/image?url=${encodeURIComponent(own)}&w=64&q=75`);
          assert.equal(defaultPort.status, 200); assert.equal(defaultPort.body.toString(), `E03-${index}`);
          const encodedOwn = own.replace("/api/uploads/", "/%61pi/%75ploads/");
          const encodedOther = other.replace("/api/uploads/", "/%61pi/%75ploads/");
          for (const target of [own, `/_next/image?url=${encodeURIComponent(own)}&w=64&q=75`, `/_next/image?url=${encodeURIComponent(encodedOwn)}&w=64&q=75`]) {
            const response = await localRequest(port, host, target);
            assert.equal(response.status, 200, `${target}: ${response.body}`); assert.equal(response.body.toString(), `E03-${index}`);
            assert.match(response.headers["cache-control"], /no-store/);
          }
          for (const target of [other, `/_next/image?url=${encodeURIComponent(other)}&w=64&q=75`, `/_next/image?url=${encodeURIComponent(encodedOther)}&w=64&q=75`]) {
            assert.equal((await localRequest(port, host, target)).status, 404);
          }
        }
      });
      for (const [index, upload] of state.uploads.entries()) {
        const absolute = resolveUploadPath(upload.key);
        assert(absolute.startsWith(path.resolve("uploads") + path.sep));
        assert.equal((await fs.readFile(absolute)).toString(), `E03-${index}`);
        await fs.unlink(absolute); // Solo los dos archivos temporales creados y verificados por este ensayo.
      }
      console.log("Limpieza: únicamente los dos archivos temporales del ensayo; sin barridos ni datos reales");
    }
    console.log(`E03: ${checks} grupos de comprobaciones correctos; ${database}; sin cambios en bases preexistentes`);
  }
} finally { await raw.$disconnect(); }
