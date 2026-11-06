# Variedades Los Primos

Marketplace multi-categoría (electrónica, moda, hogar, belleza, supermercado y
más). Construido con **Next.js 16 (App Router)**, **Tailwind CSS v4**,
**shadcn/ui** (sobre Base UI), **Prisma + MariaDB** y una **API REST propia**
con autenticación por cookie.

Marca: **verde esmeralda** (primario) + **naranja** (ofertas/CTAs). Interfaz en
español. Dark mode incluido.

## Requisitos

- Node 18.18+ (probado con Node 24)
- Docker y la red externa `apps_mind_net` del Compose de servicios generales

## Puesta en marcha

Primero levanta el Compose de servicios generales (MariaDB, phpMyAdmin y Redis),
que crea el contenedor `general-services-mariadblts` conectado a
`apps_mind_net`. Después, desde este proyecto:

```bash
docker compose up -d --build
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

La tienda y sus rutas API quedan disponibles en `http://localhost:3000`. El
Compose monta el código para HMR y ejecuta frontend y backend Next.js en el
mismo contenedor. Para cambiar el puerto del host, ajusta
`HOST_MACHINE_APP_PORT` en `.env`.

El `.env` necesita `DATABASE_URL`, `DATABASE_URL_DOCKER`,
`USE_DATABASE="true"` y `SESSION_SECRET` (ver `.env.example`). La URL del host
usa `127.0.0.1`; la URL de Docker usa `database`, el alias DNS de MariaDB dentro
de `apps_mind_net`. Ambas apuntan a la base `project-variedadeslosprimos`.
`COOKIE_SECURE="true"` solo al desplegar detrás de HTTPS.

## Despliegue en producción

El servidor usa `docker-compose.prod.yml`, publica la aplicación únicamente en
`127.0.0.1:3004` y también la expone como
`variedades-los-primos-app:3000` dentro de `apps_mind_net`. Antes del primer
despliegue, crea en MariaDB la base `project-variedadeslosprimos` y un usuario
con permisos sobre ella.

```bash
cp .env.production.example .env.production
# Edita .env.production: DATABASE_URL_DOCKER, SESSION_SECRET, APP_URL y secretos.

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

El servicio efímero `migrate` ejecuta `prisma migrate deploy`; la aplicación
solo arranca cuando la migración termina correctamente. Los archivos subidos y
la caché de Next.js quedan en volúmenes persistentes.

Como Nginx comparte `apps_mind_net`, el upstream recomendado es:

```nginx
proxy_pass http://variedades-los-primos-app:3000;
proxy_buffering off;
```

### Credenciales demo (seed)

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Admin | `admin@variedadeslosprimos.com` | `admin123` |
| Cliente | `maria.gonzalez@email.com` (y demás del seed) | `cliente123` |

El panel `/admin` exige sesión con rol **ADMIN** (lo protege `src/proxy.ts`).

## API

Route handlers en `src/app/api/**`. Formato de respuesta:
`{ ok: true, data }` o `{ ok: false, error, details? }`. Validación con zod.
La sesión viaja en la cookie httpOnly `vlp_session` (JWT firmado con
`SESSION_SECRET`); el carrito de invitado usa la cookie `vlp_cart_sid`.

### Pública / tienda

| Método y ruta | Descripción |
| --- | --- |
| `POST /api/auth/register` · `login` · `logout` · `GET /api/auth/me` | Autenticación; el login fusiona el carrito de invitado |
| `GET /api/products` (`?category&search&brand&minRating&onlyDeals&sort`) | Catálogo con filtros |
| `GET /api/products/[slug]` | Detalle con specs, reseñas y variantes |
| `GET /api/categories` · `GET /api/banners` | Categorías y banners del landing |
| `GET /api/home` | Composición de la home (secciones resueltas, en orden) |
| `GET /api/cart` · `POST /api/cart/items` · `PATCH/DELETE /api/cart/items/[id]` | Carrito en DB (usuario o invitado) |
| `GET/POST /api/wishlist` · `DELETE /api/wishlist/[productId]` | Favoritos (requiere sesión; POST es toggle) |
| `POST /api/discounts/validate` | Valida un cupón contra el subtotal |
| `POST /api/checkout` | Transacción: orden + ítems (snapshot) + pago simulado + eventos + canje + stock |
| `GET /api/orders` · `GET /api/orders/[code]` | Pedidos del usuario (timeline + rastreo) |

### Admin (rol ADMIN)

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/admin/stats` | KPIs, serie de pedidos, top categorías |
| CRUD `/api/admin/products` (+`/[id]/offer`) | Productos, specs, imagen por URL y toggle de oferta |
| CRUD `/api/admin/categories` | Bloquea eliminar categorías con productos |
| CRUD `/api/admin/discounts` | Códigos y tarjetas de regalo |
| CRUD `/api/admin/banners` | Banners del landing (hero o sección concreta) |
| CRUD `/api/admin/home-sections` (+`/[id]/move`) | Composición de la home: orden, títulos y fuente de productos |
| `GET/PATCH /api/admin/orders(/[id])` · `POST /…/email` | Estados + rastreo + correo al cliente (EmailLog) |
| CRUD `/api/admin/users` | Clientes con dirección de envío |
| `GET /api/admin/payments` | Transacciones |

**Pagos simulados:** tarjeta/PayPal quedan `COMPLETED`; Efecty/transferencia
`PENDING`. El correo al cliente se registra en `EmailLog` (SMTP real pendiente).

### Scripts de base de datos

| Script | Acción |
| --- | --- |
| `npm run db:generate` | Regenera el cliente Prisma |
| `npm run db:migrate` | Crea/aplica migraciones (`prisma migrate dev`) |
| `npm run db:push` | Sincroniza el esquema sin migración |
| `npm run db:seed` | Siembra datos demo (idempotente) |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:reset` | Reinicia la base de datos y re-siembra |

## Estructura

```
src/
  proxy.ts             # protección de /admin y /api/admin (antes "middleware")
  app/
    (store)/           # home, category, product, deals, search, cart, checkout,
                       # wishlist, orders (tienda)
    (auth)/            # login, register
    admin/             # panel de administración
    api/               # route handlers (REST)
  components/          # layout, home, product, catalog, cart, checkout,
                       # wishlist, admin, ui (shadcn/Base UI)
  data/                # datos mock (fallback de lectura)
  lib/
    server/            # servicios: auth, carts, orders, wishlist, discounts,
                       # catalog, banners, admin/* (Prisma; los usan API y RSC)
    api-client.ts      # wrapper fetch para componentes cliente
    queries.ts         # catálogo con fallback a mock
prisma/                # schema.prisma, seed.ts, migrations/
```

## Modelo de datos

El esquema completo (usuarios con roles, catálogo con variantes, pedidos con
snapshot y rastreo, pagos, descuentos, banners, reseñas) está en
[`prisma/schema.prisma`](prisma/schema.prisma) y documentado en
[`docs/modelo-de-datos.md`](docs/modelo-de-datos.md).

## Notas técnicas

- **shadcn/ui usa Base UI** (no Radix): composición con la prop `render`, no
  `asChild`. Para enlaces se usan las clases `buttonVariants` sobre `<Link>`.
- **Prisma 7** usa driver adapters: cliente generado en `src/generated/prisma`,
  conexión vía `@prisma/adapter-mariadb`.
- **Arquitectura**: los RSC llaman a los servicios de `src/lib/server/*`
  directamente; los componentes cliente mutan vía `fetch` a `/api/**` y
  refrescan con `router.refresh()`. Ambos comparten los mismos servicios.
- Las páginas de tienda/admin son dinámicas (`force-dynamic` o cookies), así los
  cambios del panel se reflejan al instante.

## Estado

Tienda y panel **funcionando contra MariaDB end-to-end**: auth real con roles,
carrito persistente (invitado + usuario con fusión), checkout transaccional con
cupones y stock, "Mis pedidos" con rastreo, y CRUD completo del admin (productos,
categorías, ofertas, descuentos, banners, pedidos con correo, usuarios, pagos).

Pendiente para siguientes fases: subida real de imágenes, envío SMTP real,
pasarelas de pago reales, recuperación de contraseña y OAuth.
