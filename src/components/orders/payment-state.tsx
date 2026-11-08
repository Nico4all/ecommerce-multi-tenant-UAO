import * as React from "react";
import {
  Ban,
  Banknote,
  CheckCircle2,
  Clock3,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estado del PAGO de un pedido, deducido de lo que el servidor ya expone.
 *
 * `OrderDetail` trae `status` (del pedido), `paymentMethod` y el historial de
 * eventos, pero NO el estado de la fila `Payment`. Así que esto deduce, y solo
 * afirma lo que esos tres datos sostienen:
 *
 *  - Wompi aprueba  -> la orden pasa de PENDING a PAID (`applyWompiTransaction`).
 *  - Wompi rechaza  -> la orden pasa a CANCELLED, el pago a FAILED y el stock
 *                      se devuelve.
 *  - Contra entrega -> la orden nace PENDING y el dinero se recibe al entregar.
 *
 * Un pedido CANCELLED NO permite deducir si hubo cobro: el historial de
 * eventos no lo registra (hay pedidos cancelados con el pago en REFUNDED y sin
 * ningún evento PAID). Por eso un pedido cancelado nunca afirma aquí "no se te
 * cobró nada", salvo cuando quien lo pinta acaba de verificar el rechazo
 * contra la API de Wompi y lo dice con `declined`.
 *
 * Cuando los datos no alcanzan (un pedido sin ningún pago registrado, o un
 * estado que no conocemos) devuelve `null` y la interfaz calla, en vez de
 * adivinar.
 */

/** Estados en los que el pedido ya avanzó más allá de "pendiente". */
const FULFILLED = ["PAID", "PACKING", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

export type PaymentStateKey =
  | "approved"
  | "pending"
  | "awaiting"
  | "on-delivery"
  | "declined"
  | "cancelled";

export interface PaymentStateInfo {
  key: PaymentStateKey;
  /** Etiqueta corta, para la insignia. */
  label: string;
  /** Qué pasó y qué sigue, en una frase. */
  detail: string;
  icon: LucideIcon;
  /** Aviso en bloque: tinte al 10% y tinta que sí cumple 4.5:1. */
  noticeClass: string;
  iconClass: string;
  /**
   * El cliente puede pagarlo ahora mismo. Solo con la pasarela y en PENDING:
   * `retryOrderPayment` exige las dos cosas, así que ofrecerlo en cualquier
   * otro caso sería un botón que responde 409.
   */
  canPay: boolean;
}

const TINT = {
  ok: {
    noticeClass: "border-success/40 bg-success/10 text-foreground",
    iconClass: "text-success-ink",
  },
  wait: {
    noticeClass: "border-deal/50 bg-deal/10 text-foreground",
    iconClass: "text-deal-ink",
  },
  bad: {
    noticeClass: "border-destructive/30 bg-destructive/10 text-foreground",
    iconClass: "text-destructive",
  },
  plain: {
    noticeClass: "border-border bg-muted/50 text-foreground",
    iconClass: "text-primary",
  },
} as const;

const STATES: Record<PaymentStateKey, Omit<PaymentStateInfo, "key">> = {
  approved: {
    label: "Pago aprobado",
    detail: "Recibimos la confirmación de tu pago.",
    icon: CheckCircle2,
    canPay: false,
    ...TINT.ok,
  },
  pending: {
    label: "Pago pendiente",
    detail:
      "Todavía no recibimos la confirmación del pago. Tu pedido queda guardado tal como lo dejaste y puedes pagarlo cuando quieras.",
    icon: Clock3,
    canPay: true,
    ...TINT.wait,
  },
  awaiting: {
    label: "Pago pendiente",
    detail:
      "Estamos esperando la confirmación del pago. En cuanto se registre, el pedido entra en preparación.",
    icon: Clock3,
    canPay: false,
    ...TINT.wait,
  },
  "on-delivery": {
    label: "Pago contra entrega",
    detail:
      "El pago es en efectivo, al recibir el pedido. Ten el monto exacto a la mano: el mensajero no siempre tiene cambio.",
    icon: Banknote,
    canPay: false,
    ...TINT.plain,
  },
  declined: {
    label: "Pago no aprobado",
    detail:
      "El pago no se aprobó, así que el pedido quedó cancelado. No se te cobró nada y los productos volvieron a quedar disponibles.",
    icon: XCircle,
    canPay: false,
    ...TINT.bad,
  },
  cancelled: {
    label: "Pedido cancelado",
    detail:
      "Este pedido quedó cancelado: no se va a enviar ni se te va a cobrar. Si ya habías pagado y no ves la devolución, radica tu caso y lo revisamos.",
    icon: Ban,
    canPay: false,
    ...TINT.bad,
  },
};

export function paymentState({
  status,
  paymentMethod,
  events,
  declined,
}: {
  status: string;
  paymentMethod: string | null;
  events?: readonly { status: string }[];
  /**
   * Solo lo pasa la pantalla a la que la pasarela acaba de devolver al
   * cliente, cuando el servidor verificó contra la API de Wompi que la
   * transacción fue rechazada. Se honra únicamente si el pedido está
   * cancelado; en cualquier otro caso se ignora.
   */
  declined?: boolean;
}): PaymentStateInfo | null {
  // Sin pago registrado no hay nada que afirmar sobre el pago.
  if (!paymentMethod) return null;

  const cod = paymentMethod === "COD";
  // Solo la pasarela admite reintento; los métodos antiguos (CARD, EFECTY,
  // TRANSFER…) se conciliaban a mano y no tienen a dónde reenviar al cliente.
  const retryable = paymentMethod === "WOMPI";

  const key: PaymentStateKey | null =
    status === "CANCELLED"
      ? declined && !cod
        ? "declined"
        : "cancelled"
      : cod
        ? "on-delivery"
        : status === "PENDING"
          ? retryable
            ? "pending"
            : "awaiting"
          : FULFILLED.includes(status)
            ? "approved"
            : null;

  if (!key) return null;
  const base = STATES[key];

  // Ya entregado: el consejo de tener el monto exacto no viene al caso.
  if (
    key === "on-delivery" &&
    (status === "DELIVERED" || events?.some((e) => e.status === "DELIVERED"))
  ) {
    return {
      key,
      ...base,
      detail: "El pago de este pedido es en efectivo, contra entrega.",
    };
  }

  return { key, ...base };
}

/**
 * Aviso del estado del pago, con sitio para la acción que corresponda.
 *
 * `role="status"` y no `alert`: el estado ya está en la página al cargarla, no
 * es algo que acabe de ocurrir; `alert` interrumpiría la lectura sin motivo.
 */
export function PaymentNotice({
  state,
  action,
  className,
}: {
  state: PaymentStateInfo;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = state.icon;
  return (
    <section
      role="status"
      className={cn("rounded-xl border p-4 sm:p-5", state.noticeClass, className)}
    >
      <div className="flex gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", state.iconClass)} />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-semibold">{state.label}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {state.detail}
          </p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </section>
  );
}
