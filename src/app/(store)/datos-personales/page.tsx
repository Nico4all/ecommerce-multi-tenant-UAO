import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "Política de Tratamiento de Datos Personales — Variedades Los Primos",
  description:
    "Cómo tratamos tus datos personales, conforme a la Ley 1581 de 2012 (Habeas Data).",
};

export default function DatosPersonalesPage() {
  return (
    <LegalPage
      title="Política de Tratamiento de Datos Personales"
      updated="21 de julio de 2026"
      intro="Esta política explica cómo recolectamos, usamos y protegemos tus datos personales, conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas colombianas de protección de datos (Habeas Data)."
    >
      <LegalSection id="responsable" title="1. Responsable del tratamiento">
        <p>
          <strong>{LEGAL_INFO.nombreComercial}</strong>, con domicilio en{" "}
          {LEGAL_INFO.ciudad}, Colombia, es el responsable del tratamiento de
          tus datos personales. Puedes escribirnos a{" "}
          <a href={`mailto:${LEGAL_INFO.correoDatos}`}>
            {LEGAL_INFO.correoDatos}
          </a>{" "}
          para cualquier consulta o solicitud sobre tus datos.
        </p>
      </LegalSection>

      <LegalSection id="datos-recolectados" title="2. Qué datos recolectamos">
        <ul>
          <li>
            <strong>De identificación y contacto:</strong> nombre, correo,
            teléfono.
          </li>
          <li>
            <strong>De envío:</strong> dirección, ciudad, departamento, código
            postal, referencias de entrega.
          </li>
          <li>
            <strong>De tu actividad en el sitio:</strong> historial de
            pedidos, productos vistos o guardados, carrito de compras.
          </li>
          <li>
            <strong>De pago:</strong> el método elegido y el resultado de la
            transacción. <strong>No almacenamos números de tarjeta ni
            claves bancarias</strong>: esos datos los recibe y procesa
            directamente la pasarela de pago, nunca nuestros servidores.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="finalidades" title="3. Para qué usamos tus datos">
        <ul>
          <li>Procesar y entregar tus pedidos, y darte soporte sobre ellos.</li>
          <li>
            Gestionar tu cuenta, autenticarte y prevenir fraude o accesos no
            autorizados.
          </li>
          <li>
            Enviarte correos operativos: confirmación de pedido, aviso de
            envío, recuperación de contraseña, respuesta a tus mensajes o PQR.
          </li>
          <li>
            Atender tus solicitudes de petición, queja, reclamo o sugerencia
            (PQR).
          </li>
          <li>
            Cumplir obligaciones legales y contables (por ejemplo, ante
            autoridades tributarias o de protección al consumidor).
          </li>
        </ul>
        <p>
          No usamos tus datos para publicidad de terceros ni los vendemos a
          nadie.
        </p>
      </LegalSection>

      <LegalSection id="terceros" title="4. Con quién compartimos tus datos">
        <p>
          Compartimos únicamente los datos necesarios con proveedores que nos
          ayudan a operar la tienda, y solo para ese fin:
        </p>
        <ul>
          <li>
            La <strong>pasarela de pagos</strong>, para procesar tu pago en
            línea.
          </li>
          <li>
            La <strong>empresa de mensajería/transporte</strong>, para
            entregar tu pedido.
          </li>
          <li>
            Nuestro <strong>proveedor de correo</strong>, para enviarte los
            correos operativos mencionados arriba.
          </li>
          <li>
            <strong>Autoridades</strong>, si una ley o una orden judicial nos
            obliga a entregar información puntual.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="derechos" title="5. Tus derechos como titular">
        <p>Como titular de tus datos, en cualquier momento puedes:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>
            Solicitar prueba de la autorización que nos diste para tratarlos.
          </li>
          <li>
            Ser informado sobre el uso que les hemos dado, previa solicitud.
          </li>
          <li>
            Presentar quejas ante la{" "}
            <strong>
              Superintendencia de Industria y Comercio (SIC)
            </strong>{" "}
            por infracciones a la ley de protección de datos.
          </li>
          <li>
            Revocar la autorización o solicitar la supresión de tus datos,
            cuando no exista un deber legal o contractual que nos obligue a
            conservarlos.
          </li>
          <li>Acceder gratuitamente a tus datos tratados.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ejercer-derechos" title="6. Cómo ejercer estos derechos">
        <p>
          Escríbenos a{" "}
          <a href={`mailto:${LEGAL_INFO.correoDatos}`}>
            {LEGAL_INFO.correoDatos}
          </a>{" "}
          o radica una{" "}
          <Link href="/pqr">PQR</Link> contándonos qué necesitas (consultar,
          corregir, eliminar tus datos, etc.) y tu documento de identidad.
          Respondemos las <strong>consultas</strong> en máximo 10 días hábiles
          y los <strong>reclamos</strong> en máximo 15 días hábiles, conforme
          a la ley; si no alcanzamos a resolver a tiempo, te avisaremos el
          motivo y la nueva fecha, que no supera 8 días hábiles adicionales
          para consultas.
        </p>
      </LegalSection>

      <LegalSection id="menores" title="7. Menores de edad">
        <p>
          Este sitio está dirigido a mayores de edad. No recolectamos a
          propósito datos de menores de edad; si detectamos que ocurrió por
          error, los eliminamos.
        </p>
      </LegalSection>

      <LegalSection id="seguridad" title="8. Seguridad y conservación">
        <p>
          Protegemos tus datos con medidas técnicas razonables (conexión
          cifrada, contraseñas encriptadas, controles de acceso). Conservamos
          tus datos mientras tengas una cuenta activa o mientras exista una
          obligación legal de conservarlos (por ejemplo, contable), y los
          eliminamos o anonimizamos después.
        </p>
      </LegalSection>

      <LegalSection id="autorizacion" title="9. Autorización">
        <p>
          Al crear una cuenta y marcar la casilla de aceptación en el registro,
          autorizas el tratamiento de tus datos personales conforme a esta
          política.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
