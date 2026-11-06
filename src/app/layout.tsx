import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { LEGAL_INFO } from "@/lib/legal-info";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  serializeJsonLd,
} from "@/lib/seo";

/**
 * DM Sans es la tipografía principal de la identidad UAO (manual, pág. 32) y
 * cubre interfaz y titulares. La alterna autorizada es Arial (pág. 33), que
 * queda declarada como fallback en `globals.css`.
 *
 * Se carga la variable completa (sin `weight`) porque la interfaz usa de
 * `medium` a `extrabold`, y el manual pide aprovechar los distintos pesos
 * para jerarquizar.
 *
 * La cadena de respaldo no se declara aquí sino en `globals.css`, para que
 * siga aplicando aunque la variable no llegue a definirse.
 */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Variedades Los Primos | Tienda online en Colombia",
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "shopping",
  keywords: [
    "Variedades Los Primos",
    "tienda online Colombia",
    "compras en línea",
    "tienda de variedades",
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: SITE_NAME,
    title: "Variedades Los Primos | Tienda online en Colombia",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Variedades Los Primos | Tienda online en Colombia",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/icon.svg"),
        width: 150,
        height: 150,
      },
      email: LEGAL_INFO.correoContacto,
      address: {
        "@type": "PostalAddress",
        addressLocality: LEGAL_INFO.ciudad,
        addressCountry: "CO",
      },
      areaServed: {
        "@type": "Country",
        name: "Colombia",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: "es-CO",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
