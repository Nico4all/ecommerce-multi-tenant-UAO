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
const { resolveStoreContext, runWithStoreContext } = await import("../src/lib/server/store-context.ts");
const [mode, directory, container, ...extra] = process.argv.slice(2);
assert(["prepare", "baseline", "services", "http"].includes(mode));
assert(path.isAbsolute(directory) && !path.resolve(directory).startsWith(process.cwd() + path.sep));
const url = new URL(process.env.DATABASE_URL);
assert(["127.0.0.1", "localhost"].includes(url.hostname));
const database = url.pathname.slice(1);
assert(/^e04_rehearsal_[a-z0-9_]{1,28}$/.test(database));
const stateFile = path.join(directory, `${database}.json`);
const contractFile = path.join(directory, `${database}-contracts.json`);
const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
let applicationClient;
const endpoints = ["/api/categories", "/api/products?search=E04", "/api/products/e04-shared", "/api/search/suggest?q=E04", "/api/home", "/api/banners"];
let checks = 0;
const check = async (label, callback) => { await callback(); checks++; console.log(`OK ${label}`); };

function shape(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return { array: [...new Set(value.map((item) => JSON.stringify(shape(item))))].sort() };
  if (typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key])]));
  return typeof value;
}
function contractFields(schema) {
  const fields = new Map();
  const record = (key, type) => fields.set(key, new Set([...(fields.get(key) ?? []), type]));
  const visit = (node, key) => {
    if (typeof node === "string") { record(key, node); return; }
    if ("array" in node) {
      record(key, "array");
      for (const item of node.array.map((value) => JSON.parse(value))) {
        // Conservar cada forma de sección del home, independientemente de sus productos.
        const variant = item && typeof item === "object" && "kind" in item
          ? `[${Object.keys(item).sort().join(",")}]` : "[]";
        visit(item, key + variant);
      }
      return;
    }
    record(key, "object");
    for (const [field, value] of Object.entries(node)) visit(value, `${key}.${field}`);
  };
  visit(schema, "$");
  return Object.fromEntries([...fields].sort(([a], [b]) => a.localeCompare(b)).map(([key, types]) => [key, [...types].sort()]));
}
function request(port, host, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: target, method: options.method ?? "GET", headers: { host, ...options.headers }, timeout: 40_000 }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("HTTP timeout")));
    req.end(options.body);
  });
}
const json = async (port, host, target, options) => {
  const response = await request(port, host, target, options);
  assert.equal(response.status, 200, `${host}${target}: ${response.status} ${response.text}`);
  assert.match(response.headers["cache-control"], /private.*no-store/);
  return JSON.parse(response.text);
};

try {
  if (mode === "prepare") {
    const [source, first, second] = extra;
    assert(/^e03_rehearsal_[a-z0-9_]+$/.test(source));
    const connection = await mariadb.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
    try { await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); }
    finally { await connection.end(); }
    await fs.mkdir(directory, { recursive: true });
    const docker = ["exec", "-i", "-e", `MYSQL_PWD=${decodeURIComponent(url.password)}`, container];
    const dump = spawnSync("docker", [...docker, "mariadb-dump", `-u${decodeURIComponent(url.username)}`, "--single-transaction", "--routines", "--triggers", "--skip-comments", source], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(dump.status, 0, dump.stderr);
    await fs.writeFile(path.join(directory, `${database}-source.sql`), dump.stdout);
    const restored = spawnSync("docker", [...docker, "mariadb", `-u${decodeURIComponent(url.username)}`, database], { input: dump.stdout, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(restored.status, 0, restored.stderr);
    const contexts = await Promise.all([first, second].map((host) => resolveStoreContext(raw, new Headers({ host }), { environment: "production" })));
    for (const [index, context] of contexts.entries()) {
      const tag = index ? "B" : "A";
      const storeId = context.id;
      const category = { storeId, slug: "e04-shared", name: `E04 ${tag} categoría`, icon: "Store", gradient: "bg-primary", description: `E04 ${tag} descripción`, imageUrl: `/email-logo.png?e04=${tag}` };
      await raw.category.create({ data: category });
      await raw.category.create({ data: { ...category, slug: `e04-only-${tag.toLowerCase()}`, name: `E04 ${tag} exclusiva` } });
      const base = { storeId, name: `E04 ${tag} producto`, brand: `E04 ${tag} marca`, categorySlug: "e04-shared", price: 100 + index * 100, offerActive: true, offerPrice: 80 + index * 70, featured: true, stock: 8, ratingAvg: index ? 2.5 : 4.5, reviewCount: 2, cost: 15, shippingCost: 0, badge: `E04 ${tag} oferta`, description: `E04 ${tag} ficha` };
      await raw.product.create({ data: { ...base, id: `e04-${tag}-shared`, slug: "e04-shared", sku: "E04-SAME-SKU" } });
      await raw.product.create({ data: { ...base, id: `e04-${tag}-related`, slug: "e04-related", offerActive: false, featured: false, name: `E04 ${tag} relacionado`, createdAt: new Date("2026-11-01T00:00:00Z") } });
      await raw.product.create({ data: { ...base, id: `e04-${tag}-only`, slug: `e04-only-${tag.toLowerCase()}`, categorySlug: `e04-only-${tag.toLowerCase()}`, name: `E04 ${tag} exclusivo` } });
      for (const status of ["DRAFT", "ARCHIVED"]) {
        await raw.product.create({ data: { ...base, id: `e04-${tag}-${status}`, slug: `e04-${status.toLowerCase()}`, status, name: `E04 ${tag} PRIVADO ${status}` } });
      }
      await raw.productImage.createMany({ data: [0, 1].map((position) => ({ storeId, productId: `e04-${tag}-shared`, url: `/email-logo.png?e04=${tag}-${position}`, sortOrder: position, isPrimary: position === 0 })) });
      await raw.productSpec.create({ data: { storeId, productId: `e04-${tag}-shared`, key: "E04", value: `E04 ${tag} especificación` } });
      await raw.productVariant.create({ data: { storeId, productId: `e04-${tag}-shared`, name: `E04 ${tag} variante`, sku: "E04-SAME-VARIANT-SKU", stock: index + 7, colorHex: index ? "#654321" : "#123456", priceDelta: index + 5 } });
      const users = await raw.user.findMany({ orderBy: { id: "asc" }, take: 2, select: { id: true } });
      assert.equal(users.length, 2);
      await raw.review.createMany({ data: users.map((user, position) => ({ storeId, userId: user.id, productId: `e04-${tag}-shared`, rating: index ? position + 2 : position + 4, body: `E04 ${tag} reseña ${position}`, createdAt: new Date(`2026-11-0${position + 1}T00:00:00Z`) })) });
      const section = async (id, data) => raw.homeSection.create({ data: { id: `e04-${tag}-${id}`, storeId, title: `E04 ${tag} ${id}`, sortOrder: 100, ...data } });
      await section("hero", { kind: "HERO" }); await section("categories", { kind: "CATEGORIES" });
      await section("banners", { kind: "BANNERS", bannerLayout: "GRID" });
      for (const source of ["OFFERS", "CATEGORY", "FEATURED", "NEWEST", "TOP_RATED"]) {
        await section(source, { kind: "PRODUCTS", source, categorySlug: source === "CATEGORY" ? "e04-shared" : null, maxItems: 20, bannerPosition: source === "FEATURED" ? "LEFT" : null });
      }
      await section("uncategorized", { kind: "PRODUCTS", source: "CATEGORY", categorySlug: null });
      await section("disabled", { kind: "PRODUCTS", source: "NEWEST", active: false });
      for (const placement of ["HERO", "HERO_SIDE", "PROMO", "STRIP"]) {
        await raw.banner.create({ data: { id: `e04-${tag}-${placement}`, storeId, placement, title: `E04 ${tag} ${placement}`, subtitle: `E04 ${tag}`, highlight: "E04", ctaText: "Ver", href: "/deals", bgClass: "bg-primary", imageUrl: `/email-logo.png?e04=${tag}-${placement}`, sectionId: ["PROMO", "STRIP"].includes(placement) ? `e04-${tag}-banners` : null } });
      }
      await raw.banner.create({ data: { id: `e04-${tag}-featured-banner`, storeId, placement: "PROMO", title: `E04 ${tag} destacado`, href: "/deals", sectionId: `e04-${tag}-FEATURED` } });
      await raw.banner.create({ data: { id: `e04-${tag}-inactive-banner`, storeId, placement: "HERO", title: `E04 ${tag} INACTIVO`, href: "/", active: false } });
    }
    await fs.writeFile(stateFile, JSON.stringify({ hosts: [first, second], stores: contexts.map((context) => context.id) }, null, 2));
    console.log(`PREPARADO ${database}: copia nueva, slugs/SKU coincidentes, contenido A/B, variantes/reseñas y todos los tipos de home; sin cambios en ${source}`);
  } else {
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    if (mode === "services") {
      const { getProductDetail } = await import("../src/lib/server/catalog.ts");
      const { getHomeBanners } = await import("../src/lib/server/banners.ts");
      applicationClient = (await import("../src/lib/prisma.ts")).prisma;
      await check("detalle y relaciones A/B con el mismo slug; privados y slugs ajenos ausentes", async () => {
        for (const [index, host] of state.hosts.entries()) {
          const tag = index ? "B" : "A"; const other = index ? "A" : "B";
          const context = await resolveStoreContext(raw, new Headers({ host }), { environment: "production" });
          await runWithStoreContext(context, async () => {
            const detail = await getProductDetail("e04-shared");
            assert.equal(detail.product.id, `e04-${tag}-shared`);
            assert(detail.variants.every((variant) => variant.name.includes(`E04 ${tag}`)));
            assert(detail.specs.every((spec) => spec.value.includes(`E04 ${tag}`)));
            assert.equal(detail.images.length, 2); assert(detail.images.every((image) => image.includes(`e04=${tag}`)));
            assert.equal(detail.reviews.length, 2); assert(detail.reviews.every((review) => review.body.includes(`E04 ${tag}`)));
            assert.equal(await getProductDetail(`e04-only-${other.toLowerCase()}`), null);
            assert.equal(await getProductDetail("e04-draft"), null); assert.equal(await getProductDetail("e04-archived"), null);
            const banners = await getHomeBanners();
            assert(!JSON.stringify(banners).includes(`E04 ${other}`)); assert(!JSON.stringify(banners).includes("INACTIVO"));
          });
        }
      });
      await check("unicidad local conservada y relaciones SQL entre tiendas rechazadas", async () => {
        const first = await raw.product.findUniqueOrThrow({ where: { id: "e04-A-shared" } });
        await assert.rejects(raw.product.create({ data: { ...first, id: "e04-duplicate" } }), { code: "P2002" });
        await assert.rejects(raw.productVariant.create({ data: { storeId: state.stores[1], productId: "e04-A-shared", name: "E04 foreign" } }), { code: "P2003" });
        assert.equal(await raw.product.count({ where: { slug: "e04-shared" } }), 2);
      });
    } else {
      const port = Number(extra[0]); assert(port > 0 && port < 65536);
      const contracts = {};
      for (const host of state.hosts) {
        contracts[host] = {};
        for (const target of endpoints) contracts[host][target] = shape(await json(port, host, target));
      }
      if (mode === "baseline") {
        await fs.writeFile(contractFile, JSON.stringify(contracts, null, 2));
        for (const host of state.hosts) {
          const draft = await request(port, host, "/api/products/e04-draft");
          const home = (await json(port, host, "/api/home")).data;
          console.log(`BASELINE ${host}: detalle draft=${draft.status}, home sin categoría=${home.some((section) => section.id.endsWith("-uncategorized"))}`);
        }
        console.log(`CONTRATOS previos capturados en ${contractFile}`);
      } else {
        await check("campos y tipos de los DTO de E03 conservados en las seis APIs y ambas tiendas", async () => {
          const previous = JSON.parse(await fs.readFile(contractFile, "utf8"));
          for (const host of state.hosts) {
            for (const target of endpoints) assert.deepEqual(contractFields(contracts[host][target]), contractFields(previous[host][target]), `${host}${target}`);
          }
        });
        const products = await raw.product.findMany({ select: { id: true, storeId: true, status: true } });
        const sections = await raw.homeSection.findMany({ select: { id: true, storeId: true } });
        const banners = await raw.banner.findMany({ select: { id: true, storeId: true, active: true } });
        const assertProducts = (rows, storeId) => rows.forEach((row) => {
          const stored = products.find((product) => product.id === row.id);
          assert(stored && stored.storeId === storeId && stored.status === "PUBLISHED", row.id);
          for (const secret of ["cost", "unitCost", "storeId", "sku", "status"]) assert(!(secret in row));
        });
        const assertBanners = (rows, storeId) => rows.forEach((row) => assert(banners.some((banner) => banner.id === row.id && banner.storeId === storeId && banner.active)));
        await check("listados, filtros, búsqueda, sugerencias y marcas nunca devuelven contenido ajeno o privado", async () => {
          for (const [index, host] of state.hosts.entries()) {
            const storeId = state.stores[index]; const tag = index ? "B" : "A";
            for (const target of ["/api/products", "/api/products?category=e04-shared", `/api/products?brand=${encodeURIComponent(`E04 ${tag} marca`)}`, "/api/products?onlyDeals=true&sort=discount", "/api/products?minRating=4", "/api/products?search=E04&sort=price-asc", "/api/products?search=E04&sort=rating", `/api/products?storeId=${state.stores[1 - index]}&tenantId=${state.stores[1 - index]}`]) {
              assertProducts((await json(port, host, target)).data, storeId);
            }
            const ownBrand = (await json(port, host, `/api/products?brand=${encodeURIComponent(`E04 ${tag} marca`)}`)).data;
            assert(ownBrand.length); assert(ownBrand.every((product) => product.brand === `E04 ${tag} marca`));
            assert.equal((await json(port, host, `/api/products?brand=${encodeURIComponent(`E04 ${index ? "A" : "B"} marca`)}`)).data.length, 0);
            const prices = (await json(port, host, "/api/products?search=E04&sort=price-asc")).data.map((product) => product.price);
            assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
            const categories = (await json(port, host, "/api/categories")).data;
            assert(categories.every((category) => category.storeId === storeId));
            const suggestions = (await json(port, host, "/api/search/suggest?q=E04")).data;
            assert(suggestions.products.length); assert(suggestions.products.every((product) => product.name.includes(`E04 ${tag}`)));
            assert(suggestions.categories.every((category) => category.name.includes(`E04 ${tag}`)));
          }
        });
        await check("todos los tipos y fuentes de home, banners y categorías permanecen en su tienda", async () => {
          for (const [index, host] of state.hosts.entries()) {
            const storeId = state.stores[index]; const tag = index ? "B" : "A";
            const home = (await json(port, host, "/api/home")).data;
            for (const section of home) {
              assert(sections.some((stored) => stored.id === section.id && stored.storeId === storeId));
              if (section.kind === "PRODUCTS") { assertProducts(section.products, storeId); if (section.banner) assertBanners([section.banner], storeId); }
              if (section.kind === "CATEGORIES") assert(section.categories.every((category) => category.storeId === storeId));
              if (section.kind === "HERO") { assertBanners(section.slides, storeId); assertBanners(section.sides, storeId); }
              if (section.kind === "BANNERS") assertBanners(section.banners, storeId);
            }
            for (const kind of ["HERO", "CATEGORIES", "PRODUCTS", "BANNERS"]) assert(home.some((section) => section.kind === kind));
            for (const source of ["OFFERS", "CATEGORY", "FEATURED", "NEWEST", "TOP_RATED"]) assert(home.some((section) => section.id === `e04-${tag}-${source}`));
            assert(!home.some((section) => section.id === `e04-${tag}-uncategorized` || section.id === `e04-${tag}-disabled`));
            for (const rows of Object.values((await json(port, host, "/api/banners")).data)) assertBanners(rows, storeId);
          }
        });
        await check("slug ajeno y productos privados devuelven 404; detalle A/B conserva variantes y reseñas propias", async () => {
          for (const [index, host] of state.hosts.entries()) {
            const tag = index ? "B" : "A"; const other = index ? "A" : "B";
            const detail = (await json(port, host, "/api/products/e04-shared")).data;
            assertProducts([detail.product], state.stores[index]); assert.equal(detail.product.id, `e04-${tag}-shared`);
            assert(detail.variants.every((variant) => variant.name.includes(`E04 ${tag}`)));
            assert(detail.reviews.every((review) => review.body.includes(`E04 ${tag}`)));
            for (const slug of [`e04-only-${other.toLowerCase()}`, "e04-draft", "e04-archived"]) {
              const response = await request(port, host, `/api/products/${slug}`); assert.equal(response.status, 404); assert.equal(JSON.parse(response.text).ok, false);
              assert.equal((await request(port, host, `/product/${slug}`)).status, 404);
            }
            const unauthorized = await request(port, host, "/api/products/e04-shared/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: 5, body: "E04 reseña sin sesión" }) });
            assert.equal(unauthorized.status, 401);
          }
        });
        await check("60 requests concurrentes de home, detalle, búsqueda, categorías y banners sin mezcla A/B", async () => {
          await Promise.all(Array.from({ length: 60 }, async (_, index) => {
            const own = index % 2; const host = state.hosts[own];
            const response = await json(port, host, endpoints[Math.floor(index / 2) % endpoints.length]);
            assert(!JSON.stringify(response).includes(`E04 ${own ? "A" : "B"}`));
          }));
        });
        await check("páginas actuales de tienda original y secundaria renderizan sin modificar frontend", async () => {
          for (const [index, host] of state.hosts.entries()) {
            for (const target of ["/", "/categories", "/category/e04-shared", "/product/e04-shared", "/search?q=E04", "/deals"]) {
              const response = await request(port, host, target);
              assert.equal(response.status, 200, `${host}${target}: ${response.text.slice(0, 300)}`);
              assert(!response.text.includes(`E04 ${index ? "A" : "B"}`));
              if (target === "/product/e04-shared") assert(response.text.includes(`E04 ${index ? "B" : "A"} relacionado`));
              assert.match(response.headers["cache-control"], /no-store/);
            }
          }
        });
      }
    }
    if (mode !== "baseline") console.log(`E04: ${checks} grupos correctos; solo ${database}; sin cambios en bases preexistentes`);
  }
} finally { await applicationClient?.$disconnect(); await raw.$disconnect(); }
