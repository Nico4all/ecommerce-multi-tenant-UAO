# Handoff — Variedades Los Primos (ecommerce)

> Documento para continuar el proyecto en una sesión nueva. Última actualización: sesión que terminó en el commit `813cc77` (rama `test`).

---

## 1. Contexto base del proyecto

- **Ruta local:** `C:\ecommerce-TodoMercado`
- **Repo GitHub:** `MunozA05/Ecommerce-Variedades`
- **Stack:** Next.js **16.2.10** (App Router, **Turbopack**), React 19, Tailwind **v4**, shadcn/ui **sobre Base UI (NO Radix)**, Prisma **7** + PostgreSQL (local, DB `todomercado`), Zustand, nodemailer, Wompi.
- **Marca:** "Variedades Los Primos" (verde + naranja), UI en español, dark mode. Códigos de pedido `VLP-####`. La infraestructura conserva el nombre viejo "todomercado" a propósito (carpeta, DB, contenedor).
- **Credenciales demo:** admin `admin@variedadeslosprimos.com` / `admin123`; clientes `cliente123`.

### Reglas del proyecto (en `CLAUDE.md` / `AGENTS.md`) — OBLIGATORIAS
- **Leer** `node_modules/next/dist/docs/` antes de escribir código Next (esta versión tiene breaking changes; middleware se llama `proxy` ahora).
- **No** server actions → usar **route handlers** (`src/app/api/**`, formato `{ ok, data|error }` + zod).
- Estado global con **Zustand**. Formularios con **react-hook-form + zod**.
- **Páginas dedicadas, NO modales**, para crear datos.

---

## 2. Flujo de trabajo Git (IMPORTANTE)

- **Se trabaja en la rama `test`.** Todo se comitea ahí.
- **`main`** solo recibe lo validado, vía Pull Request `test → main`.
- Hay `gh` CLI instalado y autenticado (usuario MunozA05). Se puede crear PR con `gh pr create`.
- PRs #1–#4 ya mergeados a main. **`test` está bastante por delante de `main`** con todo lo de las últimas sesiones → **falta abrir el PR `test → main`** cuando el usuario valide.

---

## 3. Lo que YA está hecho y verificado

### Cuentas y contraseñas
- Perfil admin `/admin/perfil`, cuenta cliente completa `/cuenta` (editar datos + cambiar contraseña).
- Recuperación self-service por correo: `/forgot` → `/restablecer`. Tokens sha-256, 1 uso, 1h, sin enumeración de correos, rate limit en memoria (`src/lib/server/rate-limit.ts`).
- Alta de admins en `/admin/users/nuevo` (rol + contraseña). Reset de contraseña por admin desde el detalle del usuario.
- Modelo `PasswordResetToken`. Endpoints en `src/app/api/auth/password/*` y `src/app/api/account/*`.
- **Login con Google: RETIRADO** (decisión del usuario). Se borraron `src/app/api/auth/google/*` y `src/lib/server/google-oauth.ts`; el botón ya no está en `/login` ni `/register`. La columna `User.googleId` se dejó en el esquema (quitarla exige migración y hay 2 cuentas enlazadas). Las cuentas creadas por Google que quedaron sin contraseña entran con "¿Olvidaste tu contraseña?" o con el reset del admin.

### Correo (nodemailer + SMTP Gmail)
- `src/lib/server/email.ts` (solo SMTP; Resend se probó y se descartó por ser de pago). Sin SMTP configurado → en dev el correo se imprime en consola.
- Plantillas de marca compartidas: `src/lib/server/email-layout.ts` (`emailShell`, `emailButton`, logo). Logo PNG en `public/email-logo.png` (los correos NO renderizan SVG; se generó con sharp desde el SVG del usuario).
- Reset de contraseña: `src/lib/server/auth-email.ts`. Correos de pedido: `src/lib/server/order-email.ts` + `order-emails.ts`.
- **Correos de pedido automáticos:** confirmación (al aprobarse pago Wompi, o al crear si es contra entrega) y aviso de "Enviado" (1ª vez, idempotente por `shippedAt`). Los demás cambios de estado NO mandan correo (el cliente los ve en `/orders/[code]`).
- **Avisos al buzón del equipo** (`STORE_EMAIL`, por defecto `SMTP_USER`): Contáctanos, PQR y pedido nuevo llegan por correo además de la campana del panel. `src/lib/server/store-alert-email.ts` (plantillas puras) + `store-alerts.ts` (envío best-effort, nunca lanza). Llevan `Reply-To` del cliente — ojo: responder desde Gmail NO queda registrado en `/admin/mensajes`.

### Actualización automática (sin WebSocket, a propósito)
- `src/components/auto-refresh.tsx` → `<AutoRefresh seconds={n} />`: llama `router.refresh()` en intervalo. Refresco **suave** (no recarga): los componentes de servidor vuelven a correr y bajan datos nuevos por props sin perder estado de cliente (filtros, pestaña, scroll). Se pausa con la pestaña oculta y refresca al volver.
- Montado en: `/admin/orders` (20s), `/admin/mensajes` (20s), `/orders/[code]` (30s, solo si el pedido sigue en curso), `/product/[slug]` (60s). Campana de avisos: `notification-bell.tsx` con su propio poll de 15s.
- **No se usó WebSocket** por decisión: exigiría servidor Node con conexiones permanentes (no funciona en serverless) y añade superficie de fallo en producción, sin ganancia real para una tienda.

### Pagos — Wompi (PROBADO end-to-end con dinero de prueba)
- **Web Checkout** (datos de tarjeta nunca tocan el servidor). Lógica en `src/lib/server/wompi.ts`.
- Toda orden nace **PENDING**. Confirmación por 2 vías idempotentes: webhook firmado `POST /api/webhooks/wompi` (fuente de verdad) + página de retorno `/checkout/confirmacion` (reconsulta la API de Wompi, nunca confía en la URL).
- Aprobado → PAID + correo; rechazado → CANCELLED + **stock repuesto**; monto alterado → rechazado y logueado.
- Ambiente sandbox/producción se autodetecta por el prefijo de la llave (`pub_test_`/`pub_prod_`).
- Métodos del checkout: **`WOMPI`** (en línea) y **`COD`** (contra entrega; al marcar Entregado el pago se completa solo). Se eliminaron los métodos simulados viejos (CARD/PSE/etc. quedan en el enum de Prisma por compatibilidad histórica de pedidos).
- Reposición de stock al cancelar: `src/lib/server/stock.ts` (`restockOrderOnce`, idempotente por historial de eventos CANCELLED). También se dispara al cancelar desde el admin.
- **Tercera vía de conciliación:** botón "Verificar pago con Wompi" en el detalle del pedido (`verifyOrderPayment` en `admin/orders.ts` + `POST /api/admin/orders/[id]/verify-payment`). Consulta a Wompi por referencia (`GET /transactions?reference=<código>`, así no hace falta tener guardado el id) y delega en el mismo `applyWompiTransaction` idempotente. Necesario porque si fallan webhook Y página de retorno (túnel caído, deploy), el pedido queda PENDING con la plata cobrada — pasó de verdad con VLP-10260.

### Reintento de pago (Wompi quema la referencia)
- Wompi exige referencia ÚNICA para siempre: un segundo intento con la misma devuelve **422 "La referencia ya ha sido usada"**, aunque el primero lo hayan rechazado. Sin arreglo, a un cliente con la tarjeta declinada no le quedaba forma de pagar su pedido.
- `buildPaymentReference(code, intento)` en `server/wompi.ts`: el intento 1 mantiene el código pelado (compatible con lo ya existente), del 2 en adelante añade `-R2`, `-R3`… El sufijo lleva "R" porque el código ya tiene guion + dígitos (`VLP-10235`) y un `-2` sería ambiguo al recortar.
- `orderCodeFromReference()` deshace el sufijo; `applyWompiTransaction` lo usa para encontrar el pedido, si no el webhook dejaría de confirmar los reintentos.
- `retryOrderPayment(code)` en `server/orders.ts` + `POST /api/orders/[code]/retry-payment`: exige dueño-o-admin, solo si el pedido sigue PENDING y es de Wompi. Crea un registro de pago por intento (queda rastro en /admin/payments).
- Botón "Pagar este pedido" en `/orders/[code]` (`components/orders/retry-payment.tsx`), visible solo con PENDING + WOMPI.

### Stock con colores (variantes)
- Si un producto tiene colores, el stock REAL vive en cada color (`ProductVariant.stock`); el campo `Product.stock` queda sin usar. El checkout descuenta del color cuando la línea trae `variantId` (`server/orders.ts`).
- El listado del panel mostraba `Product.stock` y por eso parecía que una venta no descontaba nada. Ahora `listAdminProducts` suma el stock de los colores y expone `hasVariants`; el detalle (`getAdminProduct`) sigue devolviendo el `stock` general en crudo a propósito, porque es el campo que edita el formulario.
- En el editor, el campo "Stock" general se deshabilita al cargar colores y se guarda en 0, para no tener dos números compitiendo.

### Costos y ganancias
- `Product.cost` (interno, **NUNCA se expone a la tienda** — no va en `toDomainProduct` de `mappers.ts`). Snapshot `OrderItem.unitCost` en cada venta.
- KPI "Ganancia" en el dashboard = Σ(precio venta − costo) × cantidad, sobre pedidos no cancelados con costo. `getAdminStats` también devuelve `productsWithoutCost`.

### Envíos (por producto)
- Se reemplazó el flag decorativo `freeShipping` por **`Product.shippingCost`** (Decimal nullable): vacío/null = tarifa general, `0` = envío gratis siempre, `>0` = costo fijo propio.
- `src/lib/shipping.ts` → `shippingFor(subtotal, lines)`: si algún producto trae costo propio, **gana el más alto** (un solo paquete, no se suman, la cantidad no multiplica). Si ninguno, tarifa general (gratis sobre $150.000).
- Editar en el editor de producto (junto al costo).

### Búsquedas y exportes (todos funcionan)
- Tienda: autocompletar (`SearchBar` + `/api/search/suggest`, con `src/components/checkout/city-autocomplete.tsx` para ciudades).
- Panel: buscador global del header (productos/pedidos/usuarios, `/api/admin/search` + `admin-search.tsx`). Filtros en productos, usuarios (`users-table.tsx`), pedidos, ofertas, PQR.
- CSV: pedidos (dashboard) y pagos, con BOM para Excel. Helper `src/lib/server/csv.ts`. Endpoints `/api/admin/orders/export` y `/api/admin/payments/export`.

### Checkout mejorado
- Precarga datos guardados de la cuenta (nombre, correo, teléfono, dirección).
- **Departamento** = desplegable, **Ciudad** = autocompletar propio (el `datalist` nativo no se veía bien). **Vinculados en ambos sentidos**: elegir ciudad autocompleta departamento y viceversa. Acepta texto libre (nadie queda bloqueado). Datos en `src/data/locations.ts` (32 depts + 170 ciudades de Colombia; otros países solo divisiones de nivel 1).

### Rastreo de pedidos
- Al guardar transportadora/guía/enlace en `/admin/orders/[id]`, aparece para el cliente en `/orders/[code]`, en la lista `/orders` y en el correo de envío. **La guía se muestra aunque no haya enlace**; el botón "Rastrear" solo aparece si hay enlace.

### Datos mock ELIMINADOS (Postgres es la única fuente)
- Se quitaron TODOS los fallbacks a mock. Producto borrado → **404** (antes "revivía" del mock). Banners/secciones vacías → no se pintan (no se inventan).
- Se eliminó el flag `USE_DATABASE` (sin mock detrás solo servía para vaciar la tienda).
- Fixtures de ejemplo movidas a **`prisma/seed-data/`** (la app ya no puede importarlas; solo el seed las usa). `src/data/` ahora tiene solo datos reales: `categories.ts` (visuales) y `locations.ts`.
- **Seed opt-in:** por defecto `npm run db:seed` crea solo lo esencial (categorías + secciones home + admin). Para datos demo: `SEED_DEMO=true npm run db:seed`.

### Responsive (último commit, SIN verificación visual — ver §6)
- Dashboard `StatCard`: montos largos ya no se desbordan en móvil (fuente responsive + truncate + label truncate).
- Hero banners: alturas fijas → aspect-ratio, para que las imágenes anchas (3:1) se recorten menos en móvil. Texto `lg` de banner un poco más chico en móvil.
- Placeholder de producto (`Thumb`): categorías creadas desde el panel (fuera del mapa de 8 originales) ahora tienen degradado estable derivado del slug, en vez de recuadro gris.

---

## 4. Decisiones tomadas por el usuario
- Rama `test` para trabajar; `main` solo validado.
- Envío mixto: **gana el costo propio más alto** (no se suman).
- Ciudad como autocompletar con texto libre (no lista cerrada, para no bloquear municipios no listados).
- Wompi **Web Checkout**.
- Todos los métodos de pago vía Wompi + contra entrega (COD).
- Persona Natural en Wompi (el usuario aún no tiene empresa).
- Quitar mock por completo; a la hora de crear que solo queden los productos que él crea.

---

## 5. Estado actual de credenciales y entorno (`.env`)
- **Wompi en SANDBOX** ahora (`pub_test_...`). ⚠️ Al inicio el usuario pegó por error las de **producción** (quedaron en historial de chat) → **ROTARLAS antes de lanzar**.
- SMTP Gmail configurado y funcionando (`variedadeslosprimosc0l@gmail.com` + app password).
- `APP_URL` apunta al **túnel de cloudflared** (necesario para probar Wompi en local): actualmente `https://gui-lap-beaver-wildlife.trycloudflare.com`.
- **Túnel cloudflared** instalado (`C:\Program Files (x86)\cloudflared\cloudflared.exe`). Se levanta con `cloudflared tunnel --url http://localhost:3000`. **La URL cambia en cada reinicio** → hay que actualizar 3 lugares: `APP_URL` (.env), `allowedDevOrigins` (`next.config.ts`) y la "URL de eventos" en el panel de Wompi (`.../api/webhooks/wompi`).

---

## 6. Pendientes / fallos conocidos (lo que falta)

### Bloqueantes antes de producción real
1. **Rotar TODAS las credenciales** expuestas en chat: Wompi (prod), Resend, `SESSION_SECRET`.
2. **Cambiar Wompi a producción** (`pub_prod_`/`prv_prod_`) y poner `APP_URL` = dominio real.
3. **Configurar URL de eventos de Wompi** (modo producción) al dominio real.
4. **Páginas legales (obligatorias en Colombia):** términos y condiciones, política de tratamiento de datos (Habeas Data, Ley 1581), política de privacidad, derecho de retracto (5 días). Agregar checkbox de aceptación en checkout/registro. **No implementadas.**

### Importantes
5. **Factura electrónica DIAN** — no implementada (integración grande; proveedores: Alegra, Siigo, Factus).
6. **Verificar responsive en móvil de verdad** — los cambios del commit `813cc77` NO se pudieron verificar visualmente (el navegador de preview estuvo caído toda la sesión). Revisar en un iPhone real: hero banners, tarjetas KPI del dashboard, y "otras cosas" que el usuario mencionó. Si algo sigue mal, pedir screenshot.
7. **Logo/fotos en los correos** solo se ven cuando `APP_URL` es un dominio público real (en localhost salen rotas → cae al texto alt).
8. **Verificar dominio en Resend** NO aplica (se usa SMTP Gmail); pero Gmail tiene tope ~500 correos/día y puede caer en spam → para volumen alto, migrar a proveedor transaccional.

### Menores / nice-to-have
9. Abrir el **PR `test → main`** con todo el lote acumulado.
10. Aviso de consola de `next-themes` con Fast Refresh — cosmético, NO es bug (no tocar).
11. Analítica/píxel (Google/Meta) para pauta; SEO (sitemap, robots, OG por producto); moderación de reseñas; alertas "de nuevo en stock". Todo sin empezar.

---

## 7. Gotchas críticos del entorno (leer SIEMPRE)
- **Reiniciar el dev server** tras cambiar `.env`, `next.config.ts`, `npm install` o regenerar el cliente Prisma. Si no, aparecen **500** o **404 fantasma** (el cliente Prisma viejo queda cacheado en memoria). El usuario levanta el dev server él mismo.
- Tras cambiar `schema.prisma`: `npx prisma migrate dev` **Y** `npx prisma generate` (migrate no siempre regenera el cliente; el typecheck falla hasta hacerlo).
- `prisma migrate dev` es **interactivo** (falla en no-interactivo). Para cambios destructivos: `migrate dev --create-only` (o crear la carpeta de migración a mano), escribir el SQL con preservación de datos, y aplicar con `npx prisma migrate deploy`.
- **Base UI, no Radix:** componer con `render={<Elem/>}`, no `asChild`. `DropdownMenuLabel` dentro de `DropdownMenuGroup`. Selects controlados usan `null` (no `undefined`) para vacío. Usar `FormSelect` (`src/components/admin/form-select.tsx`) que fuerza `w-full` y muestra bien el label.
- lucide-react v1 quitó iconos de marca → SVG propios en `src/components/social-icons.tsx`.
- **El navegador de preview (`mcp__Claude_Browser__*`) estuvo caído toda la última sesión** (timeouts en screenshot). Verificar con curl + queries a la DB en su lugar. Patrón para leer `.env` en scripts node: parsear el archivo a mano (ver cualquier bloque `node -e` de la sesión).
- Memoria persistente del asistente en `C:\Users\alejo05\.claude\projects\C--ecommerce-TodoMercado\memory\`.

---

## 8. Siguiente paso sugerido
Verificar el responsive en un móvil real (o pedir screenshots), luego atacar las **páginas legales** (barato y tapa un hueco legal), y abrir el **PR `test → main`** cuando el usuario valide el lote.
