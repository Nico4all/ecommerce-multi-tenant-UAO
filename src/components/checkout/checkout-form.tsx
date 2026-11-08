"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Banknote,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductImage } from "@/components/product/product-image";
import { CityAutocomplete } from "@/components/checkout/city-autocomplete";
import { formatPrice } from "@/lib/format";
import { api, ApiClientError } from "@/lib/api-client";
import { shippingFor } from "@/lib/shipping";
import { useLocationStore } from "@/stores/location-store";
import { DISCOUNT_STORAGE_KEY } from "@/components/cart/cart-view";
import {
  COUNTRIES,
  statesFor,
  citiesFor,
  allCitiesFor,
  stateForCity,
  stateLabelFor,
} from "@/data/locations";
import type { CartSummary } from "@/lib/server/carts";
import type { AppliedDiscount } from "@/lib/server/discounts";
import type { CheckoutMethod, CheckoutResult } from "@/lib/server/orders";

const COUNTRY_ITEMS = COUNTRIES.map((c) => ({ value: c, label: c }));

export interface CheckoutDefaults {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const methods: {
  id: CheckoutMethod;
  label: string;
  description: string;
  icon: typeof CreditCard;
  /** Lo que hace el botón de confirmar con este método. */
  cta: string;
  /** Qué pasa al confirmar, dicho antes de confirmar. */
  note: React.ReactNode;
}[] = [
  {
    id: "WOMPI",
    label: "Pago en línea",
    description: "Tarjeta, PSE, Nequi y más · pasarela segura Wompi",
    icon: CreditCard,
    cta: "Continuar al pago",
    note: (
      <>
        Al continuar te llevaremos a la pasarela segura de <strong>Wompi</strong>{" "}
        (de Bancolombia) para pagar con tarjeta, PSE, Nequi, Bancolombia o
        efectivo en corresponsales. Tus datos de pago nunca pasan por nuestra
        tienda, y el pedido queda confirmado cuando Wompi aprueba el pago.
      </>
    ),
  },
  {
    id: "COD",
    label: "Contra entrega",
    description: "Pagas en efectivo cuando recibas tu pedido",
    icon: Banknote,
    cta: "Confirmar pedido",
    note: (
      <>
        Pagas en <strong>efectivo al recibir</strong> tu pedido. Ten el monto
        exacto a la mano: el mensajero no siempre tiene cambio. El pedido queda
        confirmado de inmediato, sin pasar por la pasarela.
      </>
    ),
  },
];

export function CheckoutForm({
  cart,
  defaults,
}: {
  cart: CartSummary;
  defaults: CheckoutDefaults;
}) {
  const router = useRouter();
  const [method, setMethod] = React.useState<CheckoutMethod>("WOMPI");
  const [form, setForm] = React.useState({
    name: defaults.name,
    email: defaults.email,
    phone: defaults.phone,
    street: defaults.street,
    city: defaults.city,
    state: defaults.state,
    zip: defaults.zip,
    country: defaults.country || "Colombia",
    reference: "",
  });
  const [discount, setDiscount] = React.useState<AppliedDiscount | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  // Al fallar el envío no basta con subir la página: quien navega con teclado
  // o lector de pantalla se queda donde estaba. Se le lleva el foco al aviso.
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  const chosen = methods.find((m) => m.id === method) ?? methods[0];

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const fail = (message: string) => {
    setError(message);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Tras el repintado, para que el nodo del aviso ya exista.
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  // Departamentos/provincias y ciudades según el país elegido. Si aún no se ha
  // elegido departamento, se sugieren TODAS las ciudades del país (para poder
  // empezar por la ciudad); si ya hay departamento, solo las suyas.
  const stateLabel = stateLabelFor(form.country);
  const stateItems = statesFor(form.country).map((s) => ({ value: s, label: s }));
  const cityOptions = form.state
    ? citiesFor(form.country, form.state)
    : allCitiesFor(form.country);

  // Al cambiar país se limpian departamento y ciudad (no aplican al nuevo país).
  const changeCountry = (country: string) =>
    setForm((f) => ({ ...f, country, state: "", city: "" }));
  // Al elegir departamento se limpia la ciudad para volver a elegirla.
  const changeState = (state: string) =>
    setForm((f) => ({ ...f, state, city: "" }));
  // Al escribir/elegir ciudad: si coincide con una ciudad conocida, autocompleta
  // su departamento. Así se puede empezar por cualquiera de los dos.
  const changeCity = (city: string) =>
    setForm((f) => {
      const dept = stateForCity(f.country, city);
      return { ...f, city, ...(dept ? { state: dept } : {}) };
    });

  // La ciudad elegida en la barra superior rellena la dirección, sin pisar lo
  // que el cliente ya haya escrito. El valor llega tras hidratar (localStorage).
  const locCity = useLocationStore((s) => s.city);
  const locState = useLocationStore((s) => s.state);
  React.useEffect(() => {
    setForm((f) => (f.city ? f : { ...f, city: locCity, state: locState }));
  }, [locCity, locState]);

  // Retomar el cupón validado en el carrito.
  React.useEffect(() => {
    const code = localStorage.getItem(DISCOUNT_STORAGE_KEY);
    if (!code) return;
    api
      .post<AppliedDiscount>("/api/discounts/validate", {
        code,
        subtotal: cart.subtotal,
      })
      .then(setDiscount)
      .catch(() => localStorage.removeItem(DISCOUNT_STORAGE_KEY));
  }, [cart.subtotal]);

  const shipping = discount?.freeShipping
    ? 0
    : shippingFor(
        cart.subtotal,
        cart.lines.map((l) => ({ shippingCost: l.product.shippingCost })),
      );
  const discountAmount = discount ? Math.min(discount.amount, cart.subtotal) : 0;
  const total = Math.max(0, cart.subtotal - discountAmount) + shipping;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // El departamento es un desplegable (no valida nativo como los inputs).
    if (!form.state) {
      fail(`Selecciona tu ${stateLabel.toLowerCase()}`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<CheckoutResult>("/api/checkout", {
        contact: { name: form.name, email: form.email, phone: form.phone },
        shipping: {
          street: form.street,
          city: form.city,
          state: form.state,
          zip: form.zip,
          country: form.country,
          reference: form.reference || undefined,
        },
        method,
        discountCode: discount?.code,
      });
      localStorage.removeItem(DISCOUNT_STORAGE_KEY);
      if (result.redirectUrl) {
        // Pago en línea: navegación completa a la pasarela de Wompi. El estado
        // del pedido lo confirma el webhook / la página de retorno.
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success(`¡Pedido ${result.code} creado!`);
      router.push(`/checkout/success/${result.code}`);
      router.refresh();
    } catch (err) {
      fail(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo procesar el pedido",
      );
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-busy={submitting}
      className="grid gap-6 lg:grid-cols-3"
    >
      {/* Formulario */}
      <div className="space-y-4 lg:col-span-2">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" />
          Volver al carrito
        </Link>

        {error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive outline-none"
          >
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Contacto */}
        <section
          aria-labelledby="paso-contacto"
          className="rounded-xl border border-border bg-card p-5"
        >
          <h2
            id="paso-contacto"
            className="mb-4 flex items-center gap-2 font-heading font-semibold"
          >
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              1
            </span>
            Datos de contacto
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullname">Nombre completo</Label>
              <Input
                id="fullname"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="María González"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="+57 301 234 5678"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="tu@correo.com"
                aria-describedby="email-hint"
              />
              <p id="email-hint" className="text-xs text-muted-foreground">
                Aquí te enviaremos la confirmación y el rastreo del pedido.
              </p>
            </div>
          </div>
        </section>

        {/* Dirección de envío */}
        <section
          aria-labelledby="paso-envio"
          className="rounded-xl border border-border bg-card p-5"
        >
          <h2
            id="paso-envio"
            className="mb-4 flex items-center gap-2 font-heading font-semibold"
          >
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              2
            </span>
            Dirección de envío
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="street">Dirección</Label>
              <Input
                id="street"
                required
                autoComplete="street-address"
                value={form.street}
                onChange={(e) => set({ street: e.target.value })}
                placeholder="Carrera 15 #93-47, Apto 402"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">{stateLabel}</Label>
              <Select
                items={stateItems}
                value={form.state || null}
                onValueChange={(v) => changeState((v as string) ?? "")}
              >
                <SelectTrigger id="state" className="w-full">
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {stateItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ciudad</Label>
              <CityAutocomplete
                id="city"
                required
                value={form.city}
                onChange={changeCity}
                options={cityOptions}
                placeholder="Escribe o elige tu ciudad"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zip">Código postal</Label>
              <Input
                id="zip"
                required
                autoComplete="postal-code"
                value={form.zip}
                onChange={(e) => set({ zip: e.target.value })}
                placeholder="110221"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">País</Label>
              <Select
                items={COUNTRY_ITEMS}
                value={form.country}
                onValueChange={(v) => changeCountry((v as string) ?? "Colombia")}
              >
                <SelectTrigger id="country" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_ITEMS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Referencias (opcional)</Label>
              <Input
                id="notes"
                value={form.reference}
                onChange={(e) => set({ reference: e.target.value })}
                placeholder="Entre calles, color de la casa…"
              />
            </div>
          </div>
        </section>

        {/* Método de pago */}
        <section
          aria-labelledby="paso-pago"
          className="rounded-xl border border-border bg-card p-5"
        >
          <h2
            id="paso-pago"
            className="mb-4 flex items-center gap-2 font-heading font-semibold"
          >
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              3
            </span>
            Método de pago
          </h2>

          {/* Radios nativos: se recorren con las flechas, el lector anuncia
              "1 de 2" y el estado elegido no depende solo del color. Antes eran
              botones con aria-pressed, que se leen como dos conmutadores
              independientes y no dicen que elegir uno descarta el otro. */}
          <fieldset aria-labelledby="paso-pago" className="grid gap-2 sm:grid-cols-2">
            {methods.map((m) => (
              <label key={m.id} className="block cursor-pointer">
                <input
                  type="radio"
                  name="metodo-pago"
                  value={m.id}
                  checked={method === m.id}
                  onChange={() => setMethod(m.id)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex h-full items-start gap-3 rounded-lg border-2 p-3 text-left text-sm transition-colors",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                    method === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <m.icon
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-5 shrink-0",
                      method === m.id ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span>
                    <span className="block font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.description}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* Cambia con la elección, así que se anuncia al cambiar. */}
          <p
            aria-live="polite"
            className="mt-4 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground"
          >
            {chosen.note}
          </p>
        </section>
      </div>

      {/* Resumen */}
      <aside className="lg:col-span-1">
        <div className="sticky top-40 space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Tu pedido</h2>

          <ul className="space-y-3">
            {cart.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {/* La foto real del producto. Antes era <Thumb>, que siempre
                      dibuja el mosaico de la categoría: la última pantalla
                      antes de pagar no mostraba lo que el cliente eligió. */}
                  <ProductImage
                    src={l.product.imageUrl}
                    category={l.product.category}
                    name={l.product.name}
                    className="size-12 rounded-md border border-border"
                  />
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground tabular-nums">
                    <span className="sr-only">Cantidad: </span>
                    {l.qty}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{l.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.product.brand}
                    {l.variantName ? ` · ${l.variantName}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatPrice(l.product.price * l.qty)}
                </span>
              </li>
            ))}
          </ul>

          {discount && (
            <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium text-primary">
                <Tag aria-hidden className="size-4" />
                {discount.code}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDiscount(null);
                  localStorage.removeItem(DISCOUNT_STORAGE_KEY);
                }}
                aria-label="Quitar código"
                className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="shrink-0 tabular-nums">{formatPrice(cart.subtotal)}</dd>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between gap-3 text-primary">
                <dt className="min-w-0 truncate">Descuento</dt>
                <dd className="shrink-0 tabular-nums">-{formatPrice(discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="shrink-0 tabular-nums">
                {shipping === 0 ? (
                  <span className="font-semibold text-success-ink">Gratis</span>
                ) : (
                  formatPrice(shipping)
                )}
              </dd>
            </div>
          </dl>

          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-heading text-xl font-bold tabular-nums">
              {formatPrice(total)}
            </span>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="h-11 w-full gap-2 text-base"
          >
            {submitting ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" /> Procesando…
              </>
            ) : (
              <>
                <chosen.icon aria-hidden className="size-4" /> {chosen.cta}
              </>
            )}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden className="size-3.5 text-success-ink" />
            Tus datos viajan cifrados y protegidos
          </p>
          {/* Informativo, no un checkbox nuevo: aceptar los Términos ya se pidió
              al crear la cuenta; el retracto es un derecho legal automático, no
              algo que el cliente deba "autorizar" pedido a pedido. */}
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Al confirmar aceptas nuestros{" "}
            <Link
              href="/terminos"
              target="_blank"
              className="rounded-sm text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Términos
            </Link>{" "}
            y tienes derecho a{" "}
            <Link
              href="/retracto"
              target="_blank"
              className="rounded-sm text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              retracto y garantía
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}
