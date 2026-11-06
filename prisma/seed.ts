import { ORIGINAL_STORE_ID, initialStores } from "./stores";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import type { OrderStatus as DbOrderStatus } from "../src/generated/prisma/enums";
import { categories } from "../src/data/categories";
import { products, productBySlug } from "./seed-data/products";
import {
  heroSlides,
  heroSide,
  promoBanners,
  promoStrip,
} from "./seed-data/banners";
import {
  adminUsers,
  discountCodes,
  orders as mockOrders,
  payments as mockPayments,
} from "./seed-data/admin";
import { initialWishlist } from "./seed-data/wishlist";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurada");
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function seedStores() {
  for (const store of initialStores) {
    await prisma.store.upsert({ where: { id: store.id }, update: {}, create: store });
    await prisma.storeSettings.upsert({
      where: { storeId: store.id }, update: {}, create: { storeId: store.id },
    });
  }
  console.log("Tiendas: Variedades Los Primos; Frutas del Valle (inactiva, sin dominio)");
}

// Mapeos mock (español) -> enums del esquema (inglés)
const discountTypeMap = {
  porcentaje: "PERCENT",
  fijo: "FIXED",
  envio: "FREE_SHIPPING",
  tarjeta: "GIFT_CARD",
} as const;

const discountStatusMap = {
  activo: "ACTIVE",
  programado: "SCHEDULED",
  expirado: "EXPIRED",
} as const;

const orderStatusMap = {
  pendiente: "PENDING",
  pagado: "PAID",
  empacando: "PACKING",
  enviado: "SHIPPED",
  en_camino: "IN_TRANSIT",
  entregado: "DELIVERED",
  cancelado: "CANCELLED",
} as const;

const paymentMethodMap = {
  Tarjeta: "CARD",
  PayPal: "PAYPAL",
  Efecty: "EFECTY",
  Transferencia: "TRANSFER",
  PSE: "PSE",
} as const;

const paymentStatusMap = {
  completado: "COMPLETED",
  pendiente: "PENDING",
  reembolsado: "REFUNDED",
  fallido: "FAILED",
} as const;

// Credenciales demo (documentadas en README).
const ADMIN_PASSWORD = "admin123";
const CUSTOMER_PASSWORD = "cliente123";

async function seedCategories() {
  console.log("Sembrando categorías…");
  for (const c of categories) {
    await prisma.category.upsert({
      where: { storeId_slug: { storeId: ORIGINAL_STORE_ID, slug: c.slug } },
      update: { name: c.name, icon: c.icon, gradient: c.gradient },
      create: { slug: c.slug, name: c.name, icon: c.icon, gradient: c.gradient },
    });
  }
}

async function seedProducts() {
  console.log("Sembrando productos…");
  for (const p of products) {
    // El mock guarda el precio vigente en `price` y el original en `oldPrice`.
    // En el esquema: `price` es el base y la oferta va en offerPrice/offerActive.
    const basePrice = p.oldPrice ?? p.price;
    const offerPrice = p.oldPrice ? p.price : null;

    const data = {
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      description: `${p.name} de ${p.brand}. Producto original con garantía oficial de 12 meses.`,
      sku: `${p.id.toUpperCase()}-${p.slug.slice(0, 4).toUpperCase()}`,
      status: "PUBLISHED" as const,
      featured: !!p.badge,
      shippingCost: p.shippingCost ?? null,
      badge: p.badge ?? null,
      price: basePrice,
      offerPrice,
      offerActive: offerPrice !== null,
      stock: (p.reviews % 90) + 2, // misma heurística que el mock del admin
      ratingAvg: p.rating,
      reviewCount: p.reviews,
      categorySlug: p.category,
    };

    await prisma.product.upsert({
      where: { id: p.id },
      update: data,
      create: { id: p.id, ...data },
    });

    // Especificaciones base (el editor del admin permite añadir más).
    await prisma.productSpec.deleteMany({ where: { productId: p.id } });
    await prisma.productSpec.createMany({
      data: [
        { productId: p.id, key: "Marca", value: p.brand, sortOrder: 0 },
        { productId: p.id, key: "Garantía", value: "12 meses", sortOrder: 1 },
      ],
    });
  }
}

/**
 * Siembra la composición por defecto de la home (la misma que ya se veía) y
 * devuelve los ids de las secciones de banners para enlazar los banners.
 * Idempotente: usa ids fijos.
 */
async function seedHomeSections() {
  console.log("Sembrando secciones de la home…");
  const sections = [
    { id: "hs-hero", kind: "HERO" as const, sortOrder: 0 },
    { id: "hs-categories", kind: "CATEGORIES" as const, sortOrder: 1 },
    {
      id: "hs-offers",
      kind: "PRODUCTS" as const,
      title: "Mejores ofertas de hoy",
      source: "OFFERS" as const,
      maxItems: 5,
      href: "/deals",
      sortOrder: 2,
    },
    {
      id: "hs-promos",
      kind: "BANNERS" as const,
      bannerLayout: "GRID" as const,
      sortOrder: 3,
    },
    {
      id: "hs-moda",
      kind: "PRODUCTS" as const,
      title: "60% de descuento o más en Moda",
      source: "CATEGORY" as const,
      categorySlug: "moda",
      maxItems: 5,
      sortOrder: 4,
    },
    {
      id: "hs-strip",
      kind: "BANNERS" as const,
      bannerLayout: "WIDE" as const,
      sortOrder: 5,
    },
    {
      id: "hs-electronica",
      kind: "PRODUCTS" as const,
      title: "Lo mejor en Electrónica",
      source: "CATEGORY" as const,
      categorySlug: "electronica",
      maxItems: 5,
      sortOrder: 6,
    },
    {
      id: "hs-belleza",
      kind: "PRODUCTS" as const,
      title: "Más vendidos en Belleza y Salud",
      source: "CATEGORY" as const,
      categorySlug: "belleza",
      maxItems: 5,
      sortOrder: 7,
    },
  ];

  for (const s of sections) {
    const { id, ...data } = s;
    await prisma.homeSection.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }
}

async function seedBanners() {
  console.log("Sembrando banners…");
  const all = [
    ...heroSlides.map((b, i) => ({
      ...b,
      placement: "HERO" as const,
      sortOrder: i,
      sectionId: null as string | null,
    })),
    { ...heroSide, placement: "HERO_SIDE" as const, sortOrder: 0, sectionId: null },
    ...promoBanners.map((b, i) => ({
      ...b,
      placement: "PROMO" as const,
      sortOrder: i,
      sectionId: "hs-promos" as string | null,
    })),
    { ...promoStrip, placement: "STRIP" as const, sortOrder: 0, sectionId: "hs-strip" },
  ];
  for (const b of all) {
    const data = {
      placement: b.placement,
      title: b.title,
      subtitle: b.subtitle ?? null,
      highlight: b.highlight ?? null,
      ctaText: b.cta,
      href: b.href,
      bgClass: b.className,
      sortOrder: b.sortOrder,
      active: true,
      sectionId: b.sectionId,
    };
    await prisma.banner.upsert({
      where: { id: b.id },
      update: data,
      create: { id: b.id, ...data },
    });
  }
}

async function seedDiscounts() {
  console.log("Sembrando códigos de descuento…");
  for (const d of discountCodes) {
    const data = {
      code: d.code,
      type: discountTypeMap[d.type],
      value: d.value,
      usageLimit: d.limit,
      usedCount: d.used,
      balance: d.type === "tarjeta" ? d.value : null,
      status: discountStatusMap[d.status],
      expiresAt: d.expires === "—" ? null : new Date(d.expires),
    };
    await prisma.discountCode.upsert({
      where: { id: d.id },
      update: data,
      create: { id: d.id, ...data },
    });
  }
}

/** Solo el administrador: lo mínimo para poder entrar al panel. */
async function seedAdmin() {
  console.log("Sembrando administrador…");
  const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: "admin@variedadeslosprimos.com" },
    update: { role: "ADMIN", passwordHash: adminHash },
    create: {
      name: "Admin Variedades Los Primos",
      email: "admin@variedadeslosprimos.com",
      role: "ADMIN",
      passwordHash: adminHash,
    },
  });
}

/** Clientes de ejemplo con su dirección (solo demo). */
async function seedDemoCustomers() {
  console.log("Sembrando clientes de ejemplo…");
  const customerHash = bcrypt.hashSync(CUSTOMER_PASSWORD, 10);

  for (const u of adminUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        phone: u.phone,
        status: u.status === "activo" ? "ACTIVE" : "INACTIVE",
        passwordHash: customerHash,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: "CUSTOMER",
        status: u.status === "activo" ? "ACTIVE" : "INACTIVE",
        createdAt: new Date(u.joinedAt),
        passwordHash: customerHash,
      },
    });

    await prisma.address.deleteMany({ where: { userId: user.id } });
    await prisma.address.create({
      data: {
        userId: user.id,
        street: u.address.street,
        city: u.address.city,
        state: u.address.state,
        zip: u.address.zip,
        country: u.address.country,
        phone: u.phone,
        isDefault: true,
      },
    });
  }
}

/** Cadena de eventos hasta el estado actual (alimenta el stepper del admin). */
function eventChain(status: DbOrderStatus): DbOrderStatus[] {
  if (status === "CANCELLED") return ["PENDING", "CANCELLED"];
  const path: DbOrderStatus[] = [
    "PENDING",
    "PAID",
    "PACKING",
    "SHIPPED",
    "IN_TRANSIT",
    "DELIVERED",
  ];
  return path.slice(0, path.indexOf(status) + 1);
}

async function seedOrders() {
  console.log("Sembrando pedidos, pagos y eventos…");
  for (const o of mockOrders) {
    const customer = adminUsers.find((u) => u.id === o.userId);
    if (!customer) continue;
    const status = orderStatusMap[o.status];

    const data = {
      code: o.code,
      userId: o.userId,
      status,
      email: customer.email,
      phone: customer.phone,
      shippingName: customer.name,
      street: customer.address.street,
      city: customer.address.city,
      state: customer.address.state,
      zip: customer.address.zip,
      country: customer.address.country,
      subtotal: o.total,
      shippingCost: 0,
      total: o.total,
      carrier: o.carrier ?? null,
      trackingNumber: o.trackingNumber ?? null,
      trackingUrl: o.trackingUrl ?? null,
      createdAt: new Date(o.date),
    };
    await prisma.order.upsert({
      where: { id: o.id },
      update: data,
      create: { id: o.id, ...data },
    });

    // Ítems (snapshot desde el catálogo mock)
    await prisma.orderItem.deleteMany({ where: { orderId: o.id } });
    await prisma.orderItem.createMany({
      data: o.lines.map((l) => {
        const p = productBySlug[l.slug];
        return {
          orderId: o.id,
          productId: p?.id ?? null,
          name: p?.name ?? l.slug,
          brand: p?.brand ?? "—",
          unitPrice: p?.price ?? 0,
          qty: l.qty,
        };
      }),
    });

    // Línea de tiempo de estados
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: o.id } });
    const base = new Date(o.date).getTime();
    await prisma.orderStatusEvent.createMany({
      data: eventChain(status).map((s, i) => ({
        orderId: o.id,
        status: s,
        createdAt: new Date(base + i * 3 * 60 * 60 * 1000), // +3h por paso
      })),
    });
  }

  for (const p of mockPayments) {
    const order = mockOrders.find((o) => o.code === p.orderCode);
    if (!order) continue; // pago huérfano del mock (VLP-10234): se omite
    const data = {
      orderId: order.id,
      method: paymentMethodMap[p.method],
      status: paymentStatusMap[p.status],
      amount: p.amount,
      createdAt: new Date(p.date),
    };
    await prisma.payment.upsert({
      where: { id: p.id },
      update: data,
      create: { id: p.id, ...data },
    });
  }
}

async function seedReviews() {
  console.log("Sembrando reseñas…");
  const samples = [
    { userId: "u1", slug: "samsung-galaxy-s24-ultra", rating: 5, body: "Excelente producto, llegó antes de lo esperado y tal cual la descripción." },
    { userId: "u2", slug: "samsung-galaxy-s24-ultra", rating: 4, body: "Muy buena relación calidad-precio. Repetiría la compra sin dudarlo." },
    { userId: "u3", slug: "anua-heartleaf-cleansing-oil", rating: 5, body: "Mi piel mejoró muchísimo, es mi segunda compra." },
    { userId: "u5", slug: "nike-invincible-3-premium", rating: 4, body: "Muy cómodos para correr, la talla es exacta." },
  ];
  for (const r of samples) {
    const product = productBySlug[r.slug];
    if (!product) continue;
    await prisma.review.upsert({
      where: {
        productId_userId: { productId: product.id, userId: r.userId },
      },
      update: { rating: r.rating, body: r.body },
      create: {
        productId: product.id,
        userId: r.userId,
        rating: r.rating,
        body: r.body,
      },
    });
  }
}

async function seedWishlist() {
  console.log("Sembrando favoritos (María)…");
  for (const slug of initialWishlist) {
    const product = productBySlug[slug];
    if (!product) continue;
    await prisma.wishlistItem.upsert({
      where: {
        storeId_userId_productId: { storeId: ORIGINAL_STORE_ID, userId: "u1", productId: product.id },
      },
      update: {},
      create: { userId: "u1", productId: product.id },
    });
  }
}

/**
 * Por defecto el seed solo crea lo IMPRESCINDIBLE para arrancar una instalación
 * nueva: categorías, la estructura de la home y el usuario admin. NO inserta
 * catálogo ni pedidos de mentira, porque en una tienda con datos reales eso
 * mezclaría productos inventados con los del dueño.
 *
 * Para levantar un entorno de demo desde cero (o repoblar tras un reset), correr
 * con la demo activada:
 *   SEED_DEMO=true npm run db:seed
 */
const SEED_DEMO = process.env.SEED_DEMO === "true";

async function main() {
  if (process.env.NODE_ENV === "production" && SEED_DEMO) {
    throw new Error("SEED_DEMO no está permitido en producción");
  }
  // --- Imprescindible ---
  await seedStores();
  await seedCategories();
  await seedHomeSections();
  await seedAdmin();

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@variedadeslosprimos.com" } });
  await prisma.storeMembership.upsert({
    where: { storeId_userId: { storeId: ORIGINAL_STORE_ID, userId: admin.id } },
    update: {},
    create: { storeId: ORIGINAL_STORE_ID, userId: admin.id, role: "ADMIN" },
  });

  // --- Demo (opt-in) ---
  if (SEED_DEMO) {
    console.log("SEED_DEMO=true → sembrando catálogo y pedidos de ejemplo…");
    await seedDemoCustomers();
    await seedProducts();
    await seedBanners(); // después de las secciones (los enlaza por sectionId)
    await seedDiscounts();
    await seedOrders();
    await seedReviews();
    await seedWishlist();
  } else {
    console.log(
      "Modo esencial: solo categorías, secciones de home y admin. " +
        "Usa SEED_DEMO=true para sembrar también datos de ejemplo.",
    );
  }

  const [cats, prods, banners, sections, codes, users, orders, payments, reviews] =
    await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.banner.count(),
      prisma.homeSection.count(),
      prisma.discountCode.count(),
      prisma.user.count(),
      prisma.order.count(),
      prisma.payment.count(),
      prisma.review.count(),
    ]);
  console.log(
    `✔ Seed completo: ${cats} categorías, ${prods} productos, ${banners} banners, ` +
      `${sections} secciones de home, ${codes} descuentos, ${users} usuarios, ` +
      `${orders} pedidos, ${payments} pagos, ${reviews} reseñas.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
