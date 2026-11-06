import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import mariadb from "mariadb";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { ORIGINAL_STORE_ID } from "./stores.ts";

// El runner de Node usa el mismo alias vacío que Next aplica en el servidor.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("../node_modules/next/dist/compiled/server-only/empty.js", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { legacyStoreClient } = await import("../src/lib/server/store-client.ts");
const { detachVariants, removeProduct, removeCategory } = await import("../src/lib/server/catalog-deletion.ts");

const [mode, outputDirectory, container] = process.argv.slice(2);
assert(["prepare", "run", "verify-client"].includes(mode), "Usar prepare, run o verify-client");
assert(outputDirectory && path.isAbsolute(outputDirectory), "Respaldo fuera del repositorio requerido");
const repo = process.cwd();
assert(!path.resolve(outputDirectory).startsWith(repo + path.sep), "No guardar respaldos en el repositorio");
assert(container, "Indicar explícitamente el contenedor local autorizado");
const url = new URL(process.env.DATABASE_URL);
const database = url.pathname.slice(1);
assert(["127.0.0.1", "localhost"].includes(url.hostname), "Solo MariaDB local");
assert(/^e02_rehearsal_[a-z0-9_]{1,27}$/.test(database), "Solo bases nuevas reservadas para E02");
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const connection = await mariadb.createConnection({
  host: url.hostname, port: Number(url.port || 3306), user, password,
  bigIntAsNumber: true, dateStrings: true, decimalAsNumber: false,
});
const backupFile = path.join(outputDirectory, `${database}-before.sql`);
const snapshotFile = path.join(outputDirectory, `${database}-before.json`);
const migration = "20261106000000_multistore_foundation";
const quote = (name) => "`" + name + "`";

function sql(databaseName, input) {
  const result = spawnSync("docker", ["exec", "-i", "-e", `MYSQL_PWD=${password}`,
    container, "mariadb", `-u${user}`, "--batch", databaseName], {
    input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 120_000,
  });
  if (result.error) throw result.error;
  return result;
}

async function createDatabase(name) {
  // CREATE sin IF NOT EXISTS: jamás reutilizar ni borrar bases preexistentes.
  await connection.query(`CREATE DATABASE ${quote(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

async function snapshot(name, stripStoreId = false) {
  await connection.query(`USE ${quote(name)}`);
  const tables = await connection.query("SHOW TABLES");
  const result = {};
  for (const row of tables) {
    const table = Object.values(row)[0];
    if (table === "_prisma_migrations" || table.startsWith("store")) continue;
    result[table] = (await connection.query(`SELECT * FROM ${quote(table)}`)).map((record) => {
      const clean = { ...record };
      if (stripStoreId) delete clean.storeId;
      return clean;
    }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return result;
}

function runNode(args, targetDatabase) {
  const target = new URL(url);
  target.pathname = `/${targetDatabase}`;
  const result = spawnSync(process.execPath, args, {
    cwd: repo, env: { ...process.env, DATABASE_URL: target.href, SEED_DEMO: "false" },
    encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 120_000,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || String(result.error));
  console.log(result.stdout.trim());
}

try {
  if (mode === "prepare") {
    fs.mkdirSync(outputDirectory, { recursive: true });
    assert(!fs.existsSync(backupFile), "No sobrescribir un respaldo");
    await createDatabase(database);
    const legacyMigrations = fs.readdirSync("prisma/migrations")
      .filter((name) => name < migration && fs.existsSync(`prisma/migrations/${name}/migration.sql`)).sort();
    for (const name of legacyMigrations) {
      const result = sql(database, fs.readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
      assert.equal(result.status, 0, result.stderr);
    }
    const fixtures = `
      INSERT INTO users (id,name,email,role,updatedAt) VALUES ('e02-user','E02 prueba','','ADMIN',NOW(3));
      INSERT INTO categories (slug,name,icon,gradient) VALUES ('e02-only-original','E02','',''),('e02-shared','E02','','');
      INSERT INTO products (id,slug,name,brand,sku,price,stock,categorySlug,updatedAt) VALUES
        ('e02-p1','e02-shared','E02','','E02-SKU',100,10,'e02-only-original',NOW(3)),
        ('e02-p2','e02-second','E02','','E02-SKU-2',100,10,'e02-shared',NOW(3));
      INSERT INTO product_images (id,productId,url) VALUES ('e02-image','e02-p1','');
      INSERT INTO product_specs (id,productId,\`key\`,value) VALUES ('e02-spec','e02-p1','E02','E02');
      INSERT INTO product_variants (id,productId,name,sku,stock) VALUES ('e02-v1','e02-p1','E02','E02-V-SKU',10),('e02-v2','e02-p2','E02',NULL,10);
      INSERT INTO reviews (id,productId,userId,rating,body) VALUES ('e02-review','e02-p1','e02-user',5,'E02');
      INSERT INTO carts (id,userId,sessionId,updatedAt) VALUES ('e02-cart','e02-user','e02-session',NOW(3));
      INSERT INTO cart_items (id,cartId,productId,variantId) VALUES ('e02-cart-item','e02-cart','e02-p1','e02-v1');
      INSERT INTO wishlist_items (userId,productId) VALUES ('e02-user','e02-p1');
      INSERT INTO orders (id,code,userId,email,phone,shippingName,street,city,state,zip,subtotal,total,updatedAt)
        VALUES ('e02-order','E02-1','e02-user','','','E02','','','','',100,100,NOW(3));
      INSERT INTO order_items (id,orderId,productId,variantId,name,brand,variantName,unitPrice,qty)
        VALUES ('e02-order-item','e02-order','e02-p1','e02-v1','Snapshot E02','','Variante E02',100,1);
      INSERT INTO order_status_events (id,orderId,status) VALUES ('e02-event','e02-order','PENDING');
      INSERT INTO payments (id,orderId,method,amount) VALUES ('e02-payment','e02-order','COD',100);
      INSERT INTO discount_codes (id,code,type,value) VALUES ('e02-discount','E02-SHARED','FIXED',1);
      INSERT INTO discount_redemptions (id,codeId,orderId,userId,amount) VALUES ('e02-redemption','e02-discount','e02-order','e02-user',1);
      INSERT INTO home_sections (id,kind,categorySlug,updatedAt) VALUES ('e02-section','PRODUCTS','e02-only-original',NOW(3));
      INSERT INTO banners (id,placement,href,sectionId) VALUES ('e02-banner','PROMO','/','e02-section');
      INSERT INTO email_logs (id,orderId,userId,\`to\`,type) VALUES ('e02-email','e02-order','e02-user','','ORDER_CONFIRMATION');
      INSERT INTO notifications (id,type,title,entityId) VALUES ('e02-notification','ORDER_CREATED','E02','e02-order');
      INSERT INTO support_messages (id,radicado,kind,name,email,subject,message,userId,orderCode,updatedAt)
        VALUES ('e02-support','E02-PQR','CONTACTO','E02','','E02','E02','e02-user','E02-1',NOW(3));
    `;
    const result = sql(database, fixtures);
    assert.equal(result.status, 0, result.stderr);
    const before = await snapshot(database);
    fs.writeFileSync(snapshotFile, JSON.stringify(before, null, 2));
    const dump = spawnSync("docker", ["exec", "-e", `MYSQL_PWD=${password}`, container,
      "mariadb-dump", `-u${user}`, "--single-transaction", "--routines", "--triggers",
      "--skip-comments", "--skip-dump-date", database], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    assert.equal(dump.status, 0, dump.stderr);
    fs.writeFileSync(backupFile, dump.stdout);
    console.log(`PREPARADO: ${database}; ${Object.keys(before).length} tablas; respaldo ${backupFile}`);
    console.log(`SHA256 respaldo: ${createHash("sha256").update(dump.stdout).digest("hex")}`);
    console.log(`SIMULACIÓN: restaurar en ${database}_copy; aplicar únicamente ${migration}; verificar filas y FKs; restaurar respaldo en ${database}_rollback.`);
    console.log("No se modificaron bases preexistentes. El modo run requiere confirmación humana previa.");
  } else if (mode === "verify-client") {
    const raw = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
    const scoped = legacyStoreClient(raw);
    try {
      const global = await raw.user.findUniqueOrThrow({ where: { id: "e02-user" }, include: { orders: true } });
      assert.equal(global.orders.length, 2);
      const filtered = await scoped.user.findUniqueOrThrow({
        where: { id: "e02-user" }, include: { orders: true, _count: { select: { orders: true } } },
      });
      assert.equal(filtered.orders.length, 1);
      assert.equal(filtered._count.orders, 1);
      assert(filtered.orders.every((order) => order.storeId === ORIGINAL_STORE_ID));
      const selected = await scoped.user.findUniqueOrThrow({ where: { id: "e02-user" }, select: { orders: true, _count: true } });
      assert.equal(selected.orders.length, 1); assert.equal(selected._count.orders, 1);
      await assert.rejects(scoped.user.update({ where: { id: "e02-user" }, data: { orders: { deleteMany: {} } } }), /escrituras comerciales/);
      const [rows, total] = await scoped.$transaction([scoped.product.findMany(), scoped.product.count()]);
      assert.equal(rows.length, total);
      assert(rows.every((row) => row.storeId === ORIGINAL_STORE_ID));
      console.log("OK relaciones y conteos comerciales de usuarios globales aislados; escritura anidada sin contexto rechazada; transacción batch aislada");
    } finally { await raw.$disconnect(); }
  } else {
    const before = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    const dump = fs.readFileSync(backupFile, "utf8");
    const migrationSql = fs.readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8");
    const copy = `${database}_copy`;
    const bad = `${database}_bad`;
    const rollback = `${database}_rollback`;
    const deploy = `${database}_deploy`;
    for (const name of [copy, bad, rollback, deploy]) await createDatabase(name);
    for (const name of [copy, bad, rollback]) {
      const restored = sql(name, dump);
      assert.equal(restored.status, 0, restored.stderr);
      assert.deepEqual(await snapshot(name), before, `Restauración exacta: ${name}`);
    }
    assert.equal(sql(bad, "UPDATE cart_items SET productId='e02-p2' WHERE id='e02-cart-item'").status, 0);
    const invalidBefore = await snapshot(bad);
    assert.notEqual(sql(bad, migrationSql).status, 0, "El preflight debe rechazar una variante de otro producto");
    assert.deepEqual(await snapshot(bad), invalidBefore);
    await connection.query(`USE ${quote(bad)}`);
    assert.equal((await connection.query("SHOW TABLES LIKE 'stores'")).length, 0);
    console.log("OK preflight rechaza relaciones inválidas sin alterar tablas persistentes");
    const migrated = sql(copy, migrationSql);
    assert.equal(migrated.status, 0, migrated.stderr);
    assert.deepEqual(await snapshot(copy, true), before, "Cada fila histórica conserva todos sus campos");
    for (const table of Object.keys(before)) {
      if (["users", "addresses", "password_reset_tokens"].includes(table)) continue;
      const rows = await connection.query(`SELECT COUNT(*) AS n FROM ${quote(table)} WHERE storeId <> ? OR storeId IS NULL`, [ORIGINAL_STORE_ID]);
      assert.equal(rows[0].n, 0, table);
    }
    console.log("OK copia migrada: todas las filas históricas intactas y asignadas a store-original");
    runNode(["node_modules/prisma/build/index.js", "migrate", "deploy"], deploy);
    runNode(["--import", "tsx", "prisma/seed.ts"], copy);
    runNode(["--import", "tsx", "prisma/seed.ts"], copy);
    const target = new URL(url); target.pathname = `/${copy}`;
    const raw = new PrismaClient({ adapter: new PrismaMariaDb(target.href) });
    const scoped = legacyStoreClient(raw);
    try {
      const stores = await raw.store.findMany({ orderBy: { slug: "asc" } });
      assert.equal(stores.length, 2);
      assert.equal(stores.find((store) => store.name === "Frutas del Valle").active, false);
      assert.equal(await raw.storeDomain.count(), 0);
      assert.equal(await raw.storeSettings.count(), 2);
      assert.equal((await raw.storeMembership.findUniqueOrThrow({ where: { storeId_userId: { storeId: ORIGINAL_STORE_ID, userId: "e02-user" } } })).role, "ADMIN");
      console.log("OK dos tiendas semilla, settings y membresía histórica; sin dominios inventados");
      const beforeDemo = await snapshot(copy);
      const blockedDemo = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
        env: { ...process.env, DATABASE_URL: target.href, NODE_ENV: "production", SEED_DEMO: "true" },
        encoding: "utf8", timeout: 30_000,
      });
      assert.notEqual(blockedDemo.status, 0);
      assert.match(blockedDemo.stderr, /SEED_DEMO no está permitido/);
      assert.deepEqual(await snapshot(copy), beforeDemo);
      console.log("OK seed de demostración bloqueado en producción sin alterar filas");
      const other = "store-frutas-del-valle";
      await raw.category.createMany({ data: [
        { storeId: other, slug: "e02-only-other", name: "E02", icon: "", gradient: "" },
        { storeId: other, slug: "e02-shared", name: "E02", icon: "", gradient: "" },
      ] });
      const originalProduct = await raw.product.findUniqueOrThrow({ where: { id: "e02-p1" } });
      await raw.product.create({ data: { ...originalProduct, id: "e02-other-p", storeId: other, categorySlug: "e02-only-other" } });
      await raw.productVariant.create({ data: { id: "e02-other-v", storeId: other, productId: "e02-other-p", name: "E02 otra", sku: "E02-V-SKU" } });
      await raw.cart.create({ data: { id: "e02-other-cart", storeId: other, userId: "e02-user", sessionId: "e02-session" } });
      const originalOrder = await raw.order.findUniqueOrThrow({ where: { id: "e02-order" } });
      await raw.order.create({ data: { ...originalOrder, id: "e02-other-order", storeId: other, code: "E02-OTHER" } });
      await raw.discountCode.create({ data: { id: "e02-other-code", storeId: other, code: "E02-SHARED", type: "FIXED", value: 1 } });
      await raw.homeSection.create({ data: { id: "e02-other-section", storeId: other, kind: "HERO" } });
      await assert.rejects(raw.category.create({ data: { storeId: other, slug: "e02-shared", name: "E02", icon: "", gradient: "" } }), { code: "P2002" });
      await assert.rejects(raw.product.create({ data: { ...originalProduct, id: "e02-duplicate" } }), { code: "P2002" });
      console.log("OK slugs, SKU, descuentos, usuario y sesión se pueden repetir entre tiendas; duplicados internos rechazados");
      const crosses = [
        ["products", "categorySlug", "e02-only-other", "id", "e02-p1"],
        ["product_images", "productId", "e02-other-p", "id", "e02-image"],
        ["product_specs", "productId", "e02-other-p", "id", "e02-spec"],
        ["product_variants", "productId", "e02-other-p", "id", "e02-v1"],
        ["reviews", "productId", "e02-other-p", "id", "e02-review"],
        ["cart_items", "cartId", "e02-other-cart", "id", "e02-cart-item"],
        ["cart_items", "productId", "e02-other-p", "id", "e02-cart-item"],
        ["cart_items", "variantId", "e02-other-v", "id", "e02-cart-item"],
        ["wishlist_items", "productId", "e02-other-p", "userId", "e02-user"],
        ["order_items", "orderId", "e02-other-order", "id", "e02-order-item"],
        ["order_items", "productId", "e02-other-p", "id", "e02-order-item"],
        ["order_items", "variantId", "e02-other-v", "id", "e02-order-item"],
        ["order_status_events", "orderId", "e02-other-order", "id", "e02-event"],
        ["payments", "orderId", "e02-other-order", "id", "e02-payment"],
        ["discount_redemptions", "codeId", "e02-other-code", "id", "e02-redemption"],
        ["discount_redemptions", "orderId", "e02-other-order", "id", "e02-redemption"],
        ["banners", "sectionId", "e02-other-section", "id", "e02-banner"],
        ["home_sections", "categorySlug", "e02-only-other", "id", "e02-section"],
        ["email_logs", "orderId", "e02-other-order", "id", "e02-email"],
      ];
      await connection.query(`USE ${quote(copy)}`);
      for (const [table, column, value, pk, id] of crosses) {
        await assert.rejects(connection.query(`UPDATE ${quote(table)} SET ${quote(column)}=? WHERE ${quote(pk)}=?`, [value, id]), (error) => [1451, 1452].includes(error.errno));
      }
      await assert.rejects(connection.query("UPDATE cart_items SET variantId='e02-v2' WHERE id='e02-cart-item'"), (error) => error.errno === 1452);
      await assert.rejects(connection.query("UPDATE order_items SET productId=NULL WHERE id='e02-order-item'"), (error) => error.errno === 4025);
      console.log(`OK ${crosses.length} referencias cruzadas rechazadas por MariaDB; variante de otro producto y bypass NULL rechazados`);
      assert((await scoped.product.findMany()).every((product) => product.storeId === ORIGINAL_STORE_ID));
      assert.equal(await scoped.product.findUnique({ where: { id: "e02-other-p" } }), null);
      assert.equal((await scoped.product.deleteMany({ where: { id: "e02-other-p" } })).count, 0);
      await assert.rejects(scoped.product.update({ where: { id: "e02-other-p" }, data: { stock: 0 } }), { code: "P2025" });
      await assert.rejects(scoped.product.findMany({ where: { storeId: other } }), /contexto de tienda/);
      await raw.store.update({ where: { id: other }, data: { active: true } });
      await assert.rejects(scoped.product.count(), /única tienda activa/);
      await raw.store.update({ where: { id: other }, data: { active: false } });
      await raw.store.update({ where: { id: ORIGINAL_STORE_ID }, data: { active: false } });
      await assert.rejects(scoped.product.count(), /única tienda activa/);
      await raw.store.update({ where: { id: ORIGINAL_STORE_ID }, data: { active: true } });
      console.log("OK adaptador original: lecturas y escrituras aisladas; contexto ausente o activación prematura fallan cerrados");
      await raw.cartItem.create({ data: { id: "e02-cart-item-2", cartId: "e02-cart", productId: "e02-p2", variantId: "e02-v2", qty: 2 } });
      await scoped.$transaction(async (tx) => {
        await detachVariants(tx, "e02-p2");
        await tx.productVariant.deleteMany({ where: { productId: "e02-p2" } });
      });
      const detached = await raw.cartItem.findUniqueOrThrow({ where: { id: "e02-cart-item-2" } });
      assert.equal(detached.variantId, null); assert.equal(detached.qty, 2);
      const item = await raw.orderItem.findUniqueOrThrow({ where: { id: "e02-order-item" } });
      await scoped.$transaction((tx) => removeProduct(tx, "e02-p1"));
      const after = await raw.orderItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(after.productId, null); assert.equal(after.variantId, null);
      assert.equal(after.name, item.name); assert.equal(after.variantName, item.variantName);
      assert.equal(after.unitPrice.toString(), item.unitPrice.toString());
      assert.equal(await raw.cartItem.count({ where: { productId: "e02-p1" } }), 0);
      assert(await raw.product.findUnique({ where: { id: "e02-other-p" } }));
      await scoped.$transaction((tx) => removeCategory(tx, "e02-only-original"));
      assert.equal((await raw.homeSection.findUniqueOrThrow({ where: { id: "e02-section" } })).categorySlug, null);
      console.log("OK borrado compatible: snapshots y pedidos conservados; ningún producto de otra tienda modificado");
    } finally { await raw.$disconnect(); }
    assert.deepEqual(await snapshot(rollback), before);
    console.log(`OK ROLLBACK ENSAYADO: respaldo restaurado exactamente en ${rollback}`);
    console.log(`ROLLBACK OPERATIVO: detener escrituras, restaurar ${backupFile} en una base nueva, verificar las filas y desplegar la revisión anterior apuntando a esa restauración. No revertir con DROP de tablas comerciales.`);
    console.log(`Base de validación: ${copy}. Bases de ensayo conservadas para revisión; ninguna base preexistente modificada.`);
  }
} finally { await connection.end(); }
