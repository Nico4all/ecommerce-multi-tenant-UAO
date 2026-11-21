import "dotenv/config";
import { createHash } from "node:crypto";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { initialStores } from "./stores";
import { demoStoreAdmins, provisionDemoAccounts } from "./demo-accounts";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!process.argv.includes("--local-demo") || process.env.NODE_ENV === "production" ||
  !["database", "localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^(multitienda_demo|integration_rehearsal_[a-z0-9_]+)$/.test(url.pathname.slice(1))) {
  throw new Error("La semilla de muestra solo funciona en la base local de pruebas explícita");
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url.href) });
async function main() {
const data = [
  {
    ...initialStores[0], hostname: "losprimos.localhost", admin: demoStoreAdmins[0].email,
    tagline: "Pequeños detalles. Grandes días.", description: "Diseño práctico para disfrutar tu casa: cocina, organización y objetos que acompañan tu día a día.",
    categories: ["vida-diaria", "cocina", "organizacion"], categoryNames: ["Vida diaria", "Cocina y mesa", "Organización"],
    products: [
      { asset: "termo", name: "Termo Brisa 600 ml", slug: "seleccion-del-dia", price: 89900, offer: 79900, description: "Acero inoxidable, tapa práctica y un verde bosque que combina con tu rutina. Capacidad de 600 ml.", category: 0 },
      { asset: "vajilla", name: "Bowls Arena · juego de 4", slug: "bowls-arena", price: 99900, offer: 84900, description: "Cuatro bowls de cerámica en tono marfil con acabado moteado. Una mesa sencilla y cálida para compartir.", category: 1 },
      { asset: "organizador", name: "Organizador Bambú Dúo", slug: "organizador-bambu", price: 149900, offer: 129900, description: "Dos niveles de bambú natural con estructura metálica. Un espacio claro para tus esenciales de cocina o escritorio.", category: 2 },
    ],
  },
  {
    ...initialStores[1], hostname: "fruvalle.localhost", admin: demoStoreAdmins[1].email,
    tagline: "Del campo a tus mejores momentos.", description: "Frutas frescas, canastas para compartir y sabores de temporada. Elige tu selección favorita y disfruta la frescura del Valle.",
    categories: ["frutas", "temporada", "canastas"], categoryNames: ["Fruta fresca", "De temporada", "Canastas"],
    products: [
      { asset: "aguacate", name: "Aguacate Hass · malla 500 g", slug: "seleccion-del-dia", price: 11900, offer: 9900, description: "Aguacates Hass seleccionados en una malla de 500 g. Textura cremosa para ensaladas, tostadas y tus recetas favoritas.", category: 0 },
      { asset: "mango", name: "Mango de temporada · 1 kg", slug: "mango-temporada", price: 10900, offer: 8900, description: "Un kilo de mango de temporada, jugoso y aromático. Selección ideal para disfrutar al natural o preparar jugos.", category: 1 },
      { asset: "canasta", name: "Canasta Encuentro · 3 kg", slug: "canasta-encuentro", price: 45900, offer: 38900, description: "Canasta de tres kilos con una selección variada de frutas tropicales para compartir durante la semana.", category: 2 },
    ],
  },
];

try {
  for (const [index, store] of data.entries()) {
    const prefix = `stores/${createHash("sha256").update(store.id).digest("hex")}/demo`;
    const directory = path.resolve("uploads", prefix);
    if (!directory.startsWith(path.resolve("uploads") + path.sep)) throw new Error("Ruta de muestra inválida");
    await mkdir(directory, { recursive: true });
    for (const product of store.products) {
      await copyFile(path.resolve("prisma/seed-data/demo-images", `${product.asset}.png`), path.join(directory, `${product.asset}.png`));
    }
    await prisma.$transaction(async (tx) => {
      await tx.store.upsert({ where: { id: store.id }, create: { id: store.id, slug: store.slug, name: store.name, active: true, legacyKey: store.legacyKey }, update: { name: store.name, active: true } });
      await tx.storeSettings.upsert({
        where: { storeId: store.id },
        create: { storeId: store.id, tagline: store.tagline, city: "Cali", canonicalOrigin: `http://${store.hostname}:3100`, seoDescription: store.description, contactEmail: process.env.STORE_EMAIL || null, notificationEmail: store.admin },
        update: { tagline: store.tagline, city: "Cali", canonicalOrigin: `http://${store.hostname}:3100`, seoDescription: store.description, contactEmail: process.env.STORE_EMAIL || null, notificationEmail: store.admin, emailLogoUrl: null },
      });
      const existingDomain = await tx.storeDomain.findUnique({ where: { hostname: store.hostname } });
      if (existingDomain && existingDomain.storeId !== store.id) throw new Error("El alias de muestra pertenece a otra tienda");
      await tx.storeDomain.upsert({ where: { hostname: store.hostname }, create: { storeId: store.id, hostname: store.hostname, verifiedAt: new Date() }, update: { verifiedAt: new Date() } });
      for (const [position, slug] of store.categories.entries()) {
        const product = store.products[position];
        const category = { name: store.categoryNames[position], icon: index ? "shopping-basket" : "sofa", gradient: "from-primary/10 to-primary/5 text-primary", imageUrl: `/api/uploads/${prefix}/${product.asset}.png`, description: `${store.categoryNames[position]}: una selección de ${store.name}.` };
        await tx.category.upsert({ where: { storeId_slug: { storeId: store.id, slug } }, create: { storeId: store.id, slug, ...category }, update: category });
      }
      for (const [position, product] of store.products.entries()) {
        const id = `demo-${index}-${product.asset}`;
        const fields = { name: product.name, slug: product.slug, brand: index ? "Selección Fruvalle" : "Primos Casa", description: product.description, categorySlug: store.categories[product.category], price: product.price, offerPrice: product.offer, offerActive: true, featured: true, badge: "Selección de la tienda", cost: Math.round(product.offer * 0.6), stock: position ? 40 : 0 };
        const { stock, ...update } = fields;
        await tx.product.upsert({ where: { id }, create: { storeId: store.id, id, sku: `DEMO-${index}-${position}`, ...update, stock }, update });
        await tx.productImage.upsert({ where: { id: `${id}-image` }, create: { id: `${id}-image`, storeId: store.id, productId: id, url: `/api/uploads/${prefix}/${product.asset}.png`, alt: product.name, isPrimary: true }, update: { url: `/api/uploads/${prefix}/${product.asset}.png` } });
        if (!position) await tx.productVariant.upsert({ where: { id: `${id}-variant` }, create: { id: `${id}-variant`, storeId: store.id, productId: id, name: index ? "Malla 500 g" : "Verde bosque", colorHex: index ? null : "#1F6D62", stock: 60 }, update: {} });
      }
      for (const [position, kind] of ["HERO", "CATEGORIES", "PRODUCTS", "BANNERS"].entries()) {
        const id = `demo-${index}-section-${position}`;
        const fields = { kind: kind as "HERO" | "CATEGORIES" | "PRODUCTS" | "BANNERS", sortOrder: position, ...(kind === "PRODUCTS" ? { title: index ? "Frescura de temporada" : "Favoritos para tu casa", source: "FEATURED" as const, maxItems: 6 } : {}), ...(kind === "BANNERS" ? { bannerLayout: "WIDE" as const } : {}) };
        await tx.homeSection.upsert({ where: { id }, create: { storeId: store.id, id, ...fields }, update: fields });
      }
      const banners = [
        { placement: "HERO" as const, title: index ? "Sabor que alegra tus días" : "Tu casa, a tu manera", subtitle: store.tagline, ctaText: "Explorar selección", href: "/deals", imageUrl: `/api/uploads/${prefix}/${store.products[0].asset}.png`, sectionId: `demo-${index}-section-0` },
        { placement: "HERO_SIDE" as const, title: store.categoryNames[1], subtitle: index ? "Lo mejor de la temporada" : "Una mesa para disfrutar", ctaText: "Descubrir", href: `/category/${store.categories[1]}`, imageUrl: `/api/uploads/${prefix}/${store.products[1].asset}.png`, sectionId: `demo-${index}-section-0` },
        { placement: "HERO_SIDE" as const, title: store.categoryNames[2], subtitle: index ? "Para compartir en casa" : "Dale lugar a lo importante", ctaText: "Ver más", href: `/category/${store.categories[2]}`, imageUrl: `/api/uploads/${prefix}/${store.products[2].asset}.png`, sectionId: `demo-${index}-section-0` },
        { placement: "STRIP" as const, title: "Tu primera selección tiene un beneficio", subtitle: "Usa BIENVENIDA y recibe 10% de descuento en tu pedido.", highlight: "10%", ctaText: "Elegir productos", href: "/deals", imageUrl: null, sectionId: `demo-${index}-section-3` },
      ];
      for (const [position, banner] of banners.entries()) await tx.banner.upsert({ where: { id: `demo-${index}-banner-${position}` }, create: { storeId: store.id, id: `demo-${index}-banner-${position}`, ...banner, sortOrder: position, bgClass: "from-primary to-primary/80" }, update: banner });
      await tx.discountCode.upsert({ where: { storeId_code: { storeId: store.id, code: "BIENVENIDA" } }, create: { storeId: store.id, code: "BIENVENIDA", type: "PERCENT", value: 10 }, update: {} });
    }, { timeout: 30000 });
  }
  await provisionDemoAccounts(prisma);
  const admins = await prisma.user.findMany({ where: { email: { in: data.map((store) => store.admin) } } });
  for (const admin of admins) for (const store of data) {
    if (admin.email !== store.admin) await prisma.storeMembership.upsert({ where: { storeId_userId: { storeId: store.id, userId: admin.id } }, create: { storeId: store.id, userId: admin.id, role: "CUSTOMER" }, update: {} });
  }
  console.log("Muestra local preparada: dos comercios, seis productos con fotos, seis categorías, ocho banners y cupones por tienda.");
} finally { await prisma.$disconnect(); }

}
main().catch((error) => { console.error(error); process.exitCode = 1; });
