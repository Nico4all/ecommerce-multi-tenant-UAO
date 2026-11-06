"use client";

/**
 * Wrapper de fetch para consumir la API desde componentes cliente.
 * Todas las respuestas siguen el formato { ok, data | error, details }.
 */

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: { ok?: boolean; data?: T; error?: string; details?: unknown };
  try {
    payload = await res.json();
  } catch {
    throw new ApiClientError(res.status, "Respuesta inválida del servidor");
  }

  if (!res.ok || payload.ok === false) {
    throw new ApiClientError(
      res.status,
      payload.error ?? "Error de la API",
      payload.details,
    );
  }
  return payload.data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};
