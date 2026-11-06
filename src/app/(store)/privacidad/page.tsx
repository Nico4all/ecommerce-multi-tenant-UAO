import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "Política de Privacidad — Variedades Los Primos",
  description: "Cómo protegemos tu información al navegar y comprar en el sitio.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de Privacidad"
      updated="21 de julio de 2026"
      intro={
        <>
          Esta política complementa nuestra{" "}
          <Link href="/datos-personales">
            Política de Tratamiento de Datos Personales
          </Link>{" "}
          y explica, en términos prácticos, qué guarda tu navegador cuando usas
          el sitio y qué hacemos para mantenerlo seguro.
        </>
      }
    >
      <LegalSection id="cookies" title="1. Cookies y almacenamiento local">
        <p>Usamos un número reducido de cookies y datos guardados en tu navegador:</p>
        <ul>
          <li>
            <strong>Sesión (obligatoria):</strong> una cookie cifrada que
            recuerda que iniciaste sesión, para no pedirte la contraseña en
            cada página.
          </li>
          <li>
            <strong>Carrito de invitado (obligatoria):</strong> si compras sin
            cuenta, una cookie identifica tu carrito hasta que inicies sesión.
          </li>
          <li>
            <strong>Preferencias (funcional):</strong> tema claro/oscuro y la
            ciudad elegida para calcular el envío, guardados en tu navegador
            (no en un servidor).
          </li>
        </ul>
        <p>
          No usamos cookies de publicidad ni de rastreo de terceros. Todas las
          cookies que usamos son necesarias para que la tienda funcione; por
          eso no mostramos un banner para &ldquo;aceptar cookies&rdquo; de
          mercadeo, porque
          no las hay.
        </p>
      </LegalSection>

      <LegalSection id="seguridad-cuenta" title="2. Seguridad de tu cuenta">
        <ul>
          <li>Tu contraseña se guarda encriptada: ni nosotros podemos leerla.</li>
          <li>
            La comunicación entre tu navegador y el sitio va cifrada
            (HTTPS).
          </li>
          <li>
            Los datos de pago los procesa directamente la pasarela de pagos:
            nunca pasan por nuestros servidores ni quedan guardados con
            nosotros.
          </li>
          <li>
            Puedes cambiar tu contraseña o recuperarla en cualquier momento
            desde <Link href="/cuenta">Mi cuenta</Link> o desde{" "}
            <Link href="/forgot">¿Olvidaste tu contraseña?</Link>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="correos" title="3. Correos que te enviamos">
        <p>
          Solo te escribimos por motivos operativos de tu cuenta o tus pedidos:
          confirmación de compra, aviso de envío, recuperación de contraseña, y
          respuesta a tus mensajes o PQR. No enviamos correos de mercadeo
          masivo sin tu autorización explícita.
        </p>
      </LegalSection>

      <LegalSection id="enlaces-externos" title="4. Enlaces a sitios externos">
        <p>
          Al pagar en línea, o al hacer clic en el enlace de rastreo de tu
          pedido, saldrás de nuestro sitio hacia la pasarela de pagos o la
          transportadora. Esta política no cubre lo que esos sitios hagan con
          tu información: revisa sus propias políticas de privacidad.
        </p>
      </LegalSection>

      <LegalSection id="contacto" title="5. Preguntas sobre privacidad">
        <p>
          Si tienes dudas sobre esta política o sobre el tratamiento de tus
          datos, escríbenos a{" "}
          <a href={`mailto:${LEGAL_INFO.correoDatos}`}>
            {LEGAL_INFO.correoDatos}
          </a>{" "}
          o revisa la{" "}
          <Link href="/datos-personales">
            Política de Tratamiento de Datos Personales
          </Link>
          , que detalla tus derechos como titular y cómo ejercerlos.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
