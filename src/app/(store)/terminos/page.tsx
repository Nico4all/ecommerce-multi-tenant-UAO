import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/lib/legal-info";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "Términos y Condiciones — Variedades Los Primos",
  description: "Condiciones de uso y compra en Variedades Los Primos.",
};

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y Condiciones"
      updated="21 de julio de 2026"
      intro={`Estos términos regulan el uso del sitio ${LEGAL_INFO.nombreComercial} y las compras que hagas en él. Al crear una cuenta, comprar o usar el sitio, aceptas lo que dice este documento.`}
    >
      <LegalSection id="quien-vende" title="1. Quién vende">
        <p>
          <strong>{LEGAL_INFO.nombreComercial}</strong> es una tienda en línea
          con domicilio en {LEGAL_INFO.ciudad}, Colombia. No contamos con punto
          físico de atención: toda la venta y el soporte son en línea. Puedes
          contactarnos en{" "}
          <a href={`mailto:${LEGAL_INFO.correoContacto}`}>
            {LEGAL_INFO.correoContacto}
          </a>{" "}
          o desde nuestra página de{" "}
          <Link href="/contacto">contacto</Link>.
        </p>
      </LegalSection>

      <LegalSection id="cuenta" title="2. Tu cuenta">
        <p>
          Para comprar necesitas una cuenta con un correo válido. Sos
          responsable de la información que registres y de mantener tu
          contraseña segura. Si sospechas que alguien más accedió a tu cuenta,
          avísanos de inmediato.
        </p>
        <p>
          Podemos suspender o cerrar una cuenta que incumpla estos términos, use
          datos falsos, o que hayamos detectado en actividad fraudulenta.
        </p>
      </LegalSection>

      <LegalSection id="productos-precios" title="3. Productos y precios">
        <ul>
          <li>
            Los precios se muestran en <strong>pesos colombianos (COP)</strong>{" "}
            e incluyen los impuestos aplicables, salvo que se indique lo
            contrario.
          </li>
          <li>
            Hacemos lo posible por mostrar información y fotos exactas de cada
            producto. Si hay un error evidente de precio o descripción (por
            ejemplo, un cero de más o de menos), podemos cancelar el pedido
            afectado y te devolvemos cualquier pago ya realizado.
          </li>
          <li>
            La disponibilidad de stock se actualiza en tiempo real, pero puede
            agotarse entre que agregas un producto al carrito y confirmas el
            pedido. En ese caso te lo informamos y ajustamos o cancelamos esa
            parte del pedido.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="compra-pago" title="4. Cómo se compra y se paga">
        <ul>
          <li>
            Aceptamos <strong>pago en línea</strong> (tarjeta, PSE, Nequi y
            otros medios, procesados por una pasarela de pago autorizada) y{" "}
            <strong>pago contra entrega</strong> en efectivo al recibir el
            pedido.
          </li>
          <li>
            En el pago en línea, tus datos de tarjeta o banco{" "}
            <strong>nunca pasan por nuestros servidores</strong>: los procesa
            directamente la pasarela de pago.
          </li>
          <li>
            El pedido queda confirmado cuando el pago es aprobado (pago en
            línea) o de inmediato (contra entrega). Recibirás un correo de
            confirmación y podrás ver el estado en{" "}
            <Link href="/orders">Mis pedidos</Link>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="envios" title="5. Envíos">
        <p>
          El costo de envío estándar es de {formatPrice(SHIPPING_COST)} y es
          gratis en compras desde {formatPrice(FREE_SHIPPING_THRESHOLD)}
          (algunos productos pueden tener un costo de envío propio, que se
          muestra antes de pagar). Los tiempos de entrega y más detalles están
          en el <Link href="/ayuda#envios">Centro de ayuda</Link>.
        </p>
      </LegalSection>

      <LegalSection id="retracto-garantias" title="6. Retracto y garantías">
        <p>
          Tienes derecho a retractarte de tu compra dentro de los 5 días
          hábiles siguientes a la entrega, y a la garantía legal frente a
          productos defectuosos, conforme al Estatuto del Consumidor (Ley 1480
          de 2011). Los detalles y el procedimiento están en nuestra{" "}
          <Link href="/retracto">Política de Retracto y Garantías</Link>.
        </p>
      </LegalSection>

      <LegalSection id="datos-personales" title="7. Tus datos personales">
        <p>
          Usamos tus datos personales para procesar tu pedido, contactarte y
          mejorar el servicio, conforme a nuestra{" "}
          <Link href="/datos-personales">
            Política de Tratamiento de Datos Personales
          </Link>{" "}
          y nuestra <Link href="/privacidad">Política de Privacidad</Link>.
        </p>
      </LegalSection>

      <LegalSection id="uso-aceptable" title="8. Uso del sitio">
        <p>
          No está permitido usar el sitio para fines ilegales, intentar
          vulnerar su seguridad, extraer datos de forma automatizada (scraping)
          sin autorización, ni suplantar a otra persona. Los contenidos del
          sitio (marca, logo, textos, diseño) son propiedad de{" "}
          {LEGAL_INFO.nombreComercial} o de sus proveedores y no pueden
          reproducirse sin permiso.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidad" title="9. Límite de responsabilidad">
        <p>
          Respondemos por los productos y el servicio conforme a la ley
          colombiana. No somos responsables por fallas ajenas a nuestro
          control razonable (por ejemplo, interrupciones de internet, de la
          pasarela de pago o del servicio de transporte), sin perjuicio de tus
          derechos legales como consumidor.
        </p>
      </LegalSection>

      <LegalSection id="cambios" title="10. Cambios a estos términos">
        <p>
          Podemos actualizar estos términos cuando cambie el servicio o la
          normativa aplicable. Si el cambio es importante, te avisaremos por
          el sitio o por correo. La fecha de arriba indica la última
          actualización.
        </p>
      </LegalSection>

      <LegalSection id="ley-aplicable" title="11. Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República de Colombia.
          Cualquier controversia se someterá a los jueces competentes de{" "}
          {LEGAL_INFO.ciudad}, sin perjuicio de que puedas acudir a la
          Superintendencia de Industria y Comercio como consumidor.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
