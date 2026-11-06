import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/lib/legal-info";

export const metadata: Metadata = {
  title: "Retracto, Devoluciones y Garantías — Variedades Los Primos",
  description:
    "Derecho de retracto, cómo devolver un producto y garantía legal, conforme al Estatuto del Consumidor.",
};

export default function RetractoPage() {
  return (
    <LegalPage
      title="Retracto, Devoluciones y Garantías"
      updated="21 de julio de 2026"
      intro="Como comprador en una tienda en línea, la Ley 1480 de 2011 (Estatuto del Consumidor) te da derecho a retractarte de tu compra y a una garantía legal frente a productos defectuosos. Aquí explicamos cómo funciona cada uno."
    >
      <LegalSection id="retracto" title="1. Derecho de retracto">
        <p>
          Tienes <strong>5 días hábiles</strong>, contados desde el día en que
          recibes tu pedido, para arrepentirte de la compra sin necesidad de
          justificar el motivo.
        </p>
        <p>Para que el retracto proceda, el producto debe:</p>
        <ul>
          <li>Estar sin usar y en las mismas condiciones en que lo recibiste.</li>
          <li>
            Conservar su empaque, etiquetas y accesorios originales, en la
            medida de lo posible.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="excepciones" title="2. Excepciones al retracto">
        <p>
          Por disposición legal, el derecho de retracto{" "}
          <strong>no aplica</strong> a:
        </p>
        <ul>
          <li>
            Productos personalizados o hechos a la medida según tu
            especificación.
          </li>
          <li>
            Productos perecederos o que se deterioran/caducan rápido (por
            ejemplo, alimentos frescos).
          </li>
          <li>
            Productos de higiene o cuidado personal cuyo sello o empaque de
            seguridad ya fue abierto, por razones sanitarias.
          </li>
          <li>
            Contenido digital o software entregado electrónicamente y ya
            descargado o activado, si aceptaste expresamente que perdías el
            retracto al hacerlo.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="como-devolver" title="3. Cómo iniciar una devolución">
        <ol>
          <li>
            Radica un reclamo desde <Link href="/pqr">Radicar una PQR</Link>{" "}
            con el código de tu pedido (lo encuentras en{" "}
            <Link href="/orders">Mis pedidos</Link>) y el motivo.
          </li>
          <li>
            Te confirmamos por correo el radicado y los pasos: si es retracto
            o defecto de fábrica, y cómo devolvernos el producto.
          </li>
          <li>
            Cuando recibamos el producto y verifiquemos su estado, procesamos
            el reembolso.
          </li>
        </ol>
        <p>
          Si el retracto es porque cambiaste de opinión, el costo del envío de
          vuelta corre por tu cuenta. Si el producto llegó defectuoso o
          equivocado, nosotros lo cubrimos.
        </p>
      </LegalSection>

      <LegalSection id="reembolso" title="4. Plazo del reembolso">
        <p>
          Una vez aceptada la devolución, el reembolso se hace por el mismo
          medio de pago que usaste, en un plazo máximo de{" "}
          <strong>30 días calendario</strong>. Si pagaste contra entrega, te
          pedimos los datos de una cuenta bancaria para hacer la transferencia.
        </p>
      </LegalSection>

      <LegalSection id="garantia" title="5. Garantía legal">
        <p>
          Además del retracto, todo producto que vendemos tiene garantía legal
          frente a defectos de fábrica, conforme al Estatuto del Consumidor. El
          plazo y las condiciones específicas de garantía de cada producto
          están en su ficha técnica o en el empaque; si el producto llega
          defectuoso o se daña por un problema de fabricación dentro del plazo
          de garantía, lo reparamos, cambiamos o reembolsamos según
          corresponda, sin costo para ti.
        </p>
        <p>
          La garantía no cubre daños por mal uso, desgaste normal, o
          modificaciones hechas por el comprador.
        </p>
      </LegalSection>

      <LegalSection id="contacto" title="6. ¿Dudas?">
        <p>
          Escríbenos desde <Link href="/contacto">Contáctanos</Link> o{" "}
          <Link href="/pqr">radica una PQR</Link>, o al correo{" "}
          <a href={`mailto:${LEGAL_INFO.correoContacto}`}>
            {LEGAL_INFO.correoContacto}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
