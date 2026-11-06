import type { Metadata } from "next";
import Link from "next/link";
import { Truck, RotateCcw, CreditCard, FileText, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/shipping";
import { CITIES } from "@/lib/colombia";

export const metadata: Metadata = {
  title: "Centro de ayuda — Variedades Los Primos",
  description: "Envíos, devoluciones, pagos y cómo radicar una PQR.",
};

/** Las cifras salen de las mismas constantes que usa el checkout: no se desfasan. */
export default function AyudaPage() {
  const sameDay = CITIES.filter((c) => c.days <= 1).map((c) => c.name);
  const twoDays = CITIES.filter((c) => c.days === 2).map((c) => c.name);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Centro de ayuda
      </h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">
        Lo esencial sobre envíos, devoluciones y pagos. Si no encuentras lo que
        buscas, escríbenos.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        <Link href="/contacto" className={cn(buttonVariants(), "gap-1.5")}>
          <LifeBuoy className="size-4" />
          Contáctanos
        </Link>
        <Link
          href="/pqr"
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <FileText className="size-4" />
          Radicar una PQR
        </Link>
      </div>

      <section id="envios" className="scroll-mt-24">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Truck className="size-4 text-primary" />
          Envíos y entregas
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            El envío cuesta{" "}
            <strong className="text-foreground">{formatPrice(SHIPPING_COST)}</strong> y
            es <strong className="text-foreground">gratis</strong> en compras desde{" "}
            <strong className="text-foreground">
              {formatPrice(FREE_SHIPPING_THRESHOLD)}
            </strong>
            .
          </li>
          <li>
            Entregamos al día hábil siguiente en {sameDay.join(", ")}, y en dos días
            hábiles en {twoDays.join(", ")}. El resto del país, entre tres y cuatro
            días hábiles.
          </li>
          <li>
            Trabajamos con Servientrega, Coordinadora, Interrapidísimo y TCC. Cuando
            tu pedido sale de bodega te damos el número de guía para rastrearlo desde{" "}
            <Link href="/orders" className="text-primary hover:underline">
              Mis pedidos
            </Link>
            .
          </li>
        </ul>
      </section>

      <section id="devoluciones" className="mt-8 scroll-mt-24">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <RotateCcw className="size-4 text-primary" />
          Devoluciones
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            Tienes <strong className="text-foreground">5 días hábiles</strong> desde
            que recibes el pedido para retractarte de la compra, como manda el
            Estatuto del Consumidor.
          </li>
          <li>
            El producto debe estar sin usar y con su empaque original. Si llegó
            defectuoso, la devolución no te cuesta nada.
          </li>
          <li>
            Para empezar una devolución,{" "}
            <Link href="/pqr" className="text-primary hover:underline">
              radica un reclamo
            </Link>{" "}
            con el código de tu pedido y te damos la guía de retorno.
          </li>
        </ul>
      </section>

      <section id="pagos" className="mt-8 scroll-mt-24">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <CreditCard className="size-4 text-primary" />
          Pagos
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            Aceptamos <strong className="text-foreground">pago en línea</strong>{" "}
            (tarjeta de crédito o débito, PSE, Nequi y otros medios, procesados
            por una pasarela de pago segura) y{" "}
            <strong className="text-foreground">pago contra entrega</strong> en
            efectivo al recibir tu pedido.
          </li>
          <li>
            Todos los precios están en{" "}
            <strong className="text-foreground">pesos colombianos (COP)</strong> e
            incluyen IVA. Si pides desde otro país, el cobro también se hace en COP.
          </li>
          <li>
            Con el pago en línea tu pedido se confirma apenas se aprueba el pago
            (usualmente al instante). Con pago contra entrega, tu pedido queda
            confirmado de una vez y pagas cuando lo recibas.
          </li>
        </ul>
      </section>

      <section id="pqr" className="mt-8 scroll-mt-24">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <FileText className="size-4 text-primary" />
          PQR
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Una PQR es una petición, queja, reclamo o sugerencia formal. Al radicarla
          recibes un número con el que puedes hacerle seguimiento, y respondemos
          dentro de los 15 días hábiles siguientes.
        </p>
        <Link
          href="/pqr"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 gap-1.5")}
        >
          <FileText className="size-4" />
          Radicar una PQR
        </Link>
      </section>
    </div>
  );
}
