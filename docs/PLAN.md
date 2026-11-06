# Variedades Los Primos — Plan de proyecto (Fase UI primero)

Marketplace multi-categoría (electrónica, moda, hogar, belleza, supermercado, lujo…).
Referencia visual: marketplace tipo "emox/Noon" (header con buscador, barra de categorías,
carrusel hero, banners promocionales, filas de "deals" y grids de productos).

**Alcance de esta primera etapa: solo UI con datos mock. Sin lógica de backend, sin
conexión a base de datos, sin Server Actions reales.** Prisma/MariaDB se dejan definidos
para una fase posterior.

**Idioma de la interfaz: Español** (categorías, botones, secciones, textos mock).

> **Estado (2026-07-12):** F0–F6 completas. UI (Home, PLP con filtros, PDP,
> Carrito) + backend Prisma/MariaDB listo para conectar (`USE_DATABASE`).
> `tsc`, `eslint` y `next build` en verde. Ver `README.md`.

## Stack
- **Next.js** (App Router, TypeScript, `src/`) + **Tailwind CSS**
- **shadcn/ui** (Radix + Tailwind) para componentes accesibles
- **lucide-react** para iconos (SVG, nunca emojis)
- **next/font** para tipografías (self-hosted, sin CLS)
- Datos: archivos mock en `src/data/*` (productos, categorías, banners)
- Fase 2 (implementada): **MariaDB + Prisma**

---

## Sistema de diseño

### Estilo
Marketplace limpio y orientado a conversión: superficies blancas, tarjetas con borde
sutil y sombra ligera, mucha densidad de contenido pero bien jerarquizado. Acentos de
color reservados para precios, ofertas (badges) y CTAs.

### Color (tokens semánticos — se definen como CSS variables + tema shadcn)
Dirección elegida: **Verde mercado + naranja** (fresco, tono "mercado", diferenciado).

| Token | Uso | Valor propuesto (HSL) |
|-------|-----|-----------------------|
| `--primary` | Marca, enlaces, header activo, CTAs principales | `152 60% 36%` (verde esmeralda) |
| `--accent` (deal) | Precios de oferta, badges "OFERTA", urgencia | `24 95% 53%` (naranja) |
| `--background` | Fondo de página | `0 0% 100%` |
| `--muted` | Fondos de secciones, chips | `150 20% 96%` |
| `--foreground` | Texto principal | `160 30% 10%` (verde-slate muy oscuro) |
| `--muted-foreground` | Texto secundario | `155 10% 42%` |
| `--border` | Bordes de tarjetas/inputs | `150 16% 90%` |
| `--success` | Stock, envío gratis | `142 71% 45%` |
| `--destructive` | Errores | `0 72% 51%` |

Verde (fresco/mercado) como marca + naranja para energía/ofertas. **Dark mode** se
diseña en paralelo desde el inicio (tokens por tema).

### Tipografía
- **Títulos / marca:** Plus Jakarta Sans (variable, Google Fonts)
- **Cuerpo / UI:** Inter (variable)
- Escala: 12 · 14 · 16(base) · 18 · 24 · 32 · 40 · line-height 1.5
- **Precios y datos numéricos:** cifras tabulares (`tabular-nums`) para evitar saltos.

### Espaciado / layout
- Ritmo 4/8px. Contenedor `max-w-[1280px]` centrado, gutters adaptativos.
- Mobile-first. Breakpoints: 375 / 640 / 768 / 1024 / 1280.
- Sin scroll horizontal; filas de "deals" con scroll-snap horizontal en móvil.

### Reglas de calidad (de la skill)
- Contraste AA 4.5:1, focus rings visibles, alt text en imágenes de producto.
- Touch targets ≥44px, `cursor-pointer` en clicables.
- Imágenes `next/image` con width/height (CLS < 0.1), lazy load bajo el fold.
- Skeletons en carga; animaciones 150–300ms; respetar `prefers-reduced-motion`.

---

## Estructura de carpetas (objetivo)
```
src/
  app/
    layout.tsx            # fuentes, header, footer, theme provider
    page.tsx              # Home
    (catalog)/
      category/[slug]/page.tsx   # PLP - listado por categoría
      product/[slug]/page.tsx    # PDP - detalle de producto
    cart/page.tsx         # Carrito (UI)
    globals.css           # tokens + tema
  components/
    ui/                   # shadcn (button, card, input, badge, sheet, ...)
    layout/               # Header, TopBar, CategoryNav, Footer, MobileNav
    home/                 # HeroCarousel, CategoryCircles, DealSection, PromoBanners
    product/              # ProductCard, RatingStars, PriceTag, ProductGrid
    catalog/              # FilterSidebar, SortBar, Pagination, Breadcrumbs
  data/                   # products.ts, categories.ts, banners.ts (mock)
  lib/                    # utils.ts, formatters (precio/moneda)
  types/                  # Product, Category, Banner
prisma/                   # (fase 2) schema.prisma — solo borrador, sin migraciones
```

---

## Fases de trabajo

### Fase 0 — Scaffold
1. `create-next-app` (TS, Tailwind, App Router, src/, alias `@/`).
2. `shadcn init` + añadir componentes base (button, card, input, badge, sheet,
   dropdown-menu, separator, skeleton, carousel, tabs, accordion).
3. Fuentes con `next/font`, tokens en `globals.css`, tema claro/oscuro.
4. Tipos + datos mock (10–20 productos, 7+ categorías, banners).

### Fase 1 — Layout compartido
- **TopBar**: entrega/ubicación, selector idioma/moneda.
- **Header**: logo Variedades Los Primos, buscador ancho con autocompletar (UI), cuenta, carrito con contador.
- **CategoryNav**: barra "Todas las categorías" + accesos + "Mejores ofertas".
- **Footer** completo. **MobileNav** (Sheet + bottom bar ≤5 ítems).

### Fase 2 — Home (replica la referencia)
- Hero carousel (2–3 slides) + banner lateral.
- "Explora categorías populares" (círculos con imagen).
- "Mejores ofertas de hoy" (grid/carrusel de ProductCards con rating, precio, tachado).
- Bloque de 3 banners promocionales.
- Fila "60% dcto" por categoría.
- Banner promo full-width (AI shopping).
- "Top en Electrónica", "Más vendidos en Belleza y Salud".

### Fase 3 — PLP (listado por categoría)
- Breadcrumbs, sidebar de filtros (precio, marca, rating, atributos),
  barra de orden, grid responsive, paginación, estado vacío, skeletons.

### Fase 4 — PDP (detalle de producto)
- Galería, título, rating, precio/oferta, variantes, cantidad, "Agregar al carrito"
  (solo UI), tabs de descripción/specs/reseñas, productos relacionados.

### Fase 5 — Carrito (UI)
- Lista de ítems, subtotal, resumen, CTA checkout (sin lógica de pago).

### Fase 6 (posterior, NO ahora) — Backend
- `schema.prisma` (Product, Category, Variant, CartItem, Order…), migraciones,
  Server Actions / API, reemplazo de datos mock por queries reales.

---

## Verificación por fase
- `npm run dev` y revisión visual en 375px y desktop.
- Chequeo de contraste, focus, dark mode y estados de carga antes de cerrar cada fase.
