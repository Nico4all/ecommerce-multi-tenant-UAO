import { storePageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, FileText } from "lucide-react";
import { getSession } from "@/lib/server/auth";
import { ContactForm } from "@/components/support/support-forms";
import { getStoreLegalInfo } from "@/lib/server/store-presentation";
export async function generateMetadata(): Promise<Metadata> {
  return storePageMetadata({
  title: "Contáctanos — Variedades Los Primos",
  description: "Escríbenos y te respondemos al correo lo antes posible.",
}, "/contacto");
}


export default async function ContactoPage() {
  const LEGAL_INFO = await getStoreLegalInfo();
  const session = await getSession();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
        Contáctanos
      </h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">
        ¿Tienes una duda o una propuesta? Escríbenos y te respondemos al correo.
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <Mail className="size-4 text-primary" />
          <p className="mt-2 text-sm font-medium">Correo</p>
          <p className="break-all text-xs text-muted-foreground">
            <a href={LEGAL_INFO.contactHref} className="hover:underline">
              {LEGAL_INFO.correoContacto || "formulario de contacto"}
            </a>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <MessageCircle className="size-4 text-primary" />
          <p className="mt-2 text-sm font-medium">Horario</p>
          <p className="text-xs text-muted-foreground">
            Lunes a sábado, 8:00 a.m. – 6:00 p.m.
          </p>
        </div>
        <Link
          href="/pqr"
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
        >
          <FileText className="size-4 text-primary" />
          <p className="mt-2 text-sm font-medium">¿Es un reclamo?</p>
          <p className="text-xs text-muted-foreground">
            Radícalo como PQR y recibe seguimiento
          </p>
        </Link>
      </div>

      <ContactForm
        defaults={{ name: session?.name ?? "", email: session?.email ?? "" }}
      />
    </div>
  );
}
