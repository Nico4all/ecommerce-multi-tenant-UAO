import type { Metadata } from "next";
import { getSession } from "@/lib/server/auth";
import { PqrForm } from "@/components/support/support-forms";

export const metadata: Metadata = {
  title: "PQR — Variedades Los Primos",
  description:
    "Radica una petición, queja, reclamo o sugerencia y haz seguimiento con tu número de radicado.",
};

export default async function PqrPage() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Peticiones, quejas, reclamos y sugerencias
      </h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">
        Cuéntanos qué pasó y te damos un número de radicado para hacerle
        seguimiento. Respondemos dentro de los 15 días hábiles siguientes.
      </p>

      <PqrForm
        defaults={{ name: session?.name ?? "", email: session?.email ?? "" }}
      />
    </div>
  );
}
