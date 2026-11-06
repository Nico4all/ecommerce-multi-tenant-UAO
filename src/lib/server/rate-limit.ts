import "server-only";

/**
 * Limitador de tasa simple, en memoria (ventana fija).
 *
 * Sirve para frenar abuso puntual —p.ej. spamear el correo de recuperación de
 * alguien— sin montar Redis. Al ser en memoria, el contador es POR INSTANCIA:
 * si algún día la app corre en varias instancias, cada una lleva su cuenta y el
 * límite efectivo se multiplica. Para eso ya haría falta un store compartido.
 */

interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Hit>();

// Barrido perezoso: al comprobar, se descartan las ventanas ya vencidas para que
// el Map no crezca sin fin.
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

/**
 * Registra un intento para `key` y dice si se permite.
 * @param key    identificador (p.ej. `forgot:ip:1.2.3.4`)
 * @param limit  intentos permitidos por ventana
 * @param windowMs duración de la ventana en ms
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);

  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** IP del cliente a partir de las cabeceras del proxy (o "unknown"). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
