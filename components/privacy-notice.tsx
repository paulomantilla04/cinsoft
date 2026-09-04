/**
 * Aviso de privacidad integral del CInSoft 2026, transcrito de
 * `AVISO_DE_PRIVACIDAD_talleres.md`. Vive en JSX y no como markdown renderizado
 * para no arrastrar un parser sólo por esta pantalla.
 */
export function PrivacyNotice() {
  return (
    <div className="flex flex-col gap-space-md font-body-sm text-body-sm text-on-surface">
      <header className="flex flex-col gap-space-2xs border-b-2 border-primary/30 pb-space-sm">
        <span className="font-label-caps text-label-caps text-primary uppercase tracking-wider">
          CInSoft 2026 // Registro de participantes a talleres
        </span>
        <span className="font-code-badge text-code-badge text-on-surface-variant uppercase">
          Última actualización: septiembre de 2026
        </span>
      </header>

      <Section title="1. Identidad y domicilio del Responsable">
        <p>
          La coordinación de la Licenciatura en Ingeniería en Software de la
          Universidad Autónoma del Estado de Hidalgo (UAEH) (en adelante, «el
          Responsable»), es responsable del tratamiento de los datos personales
          que usted proporcione con motivo de su registro y participación en los
          talleres del CInSoft 2026, de conformidad con la legislación mexicana
          aplicable en materia de protección de datos personales.
        </p>
        <p>
          Para cualquier asunto relacionado con el tratamiento de sus datos
          personales podrá comunicarse al correo electrónico:{" "}
          <a
            className="text-primary font-bold underline underline-offset-4 decoration-2"
            href="mailto:monicagm@uaeh.edu.mx"
          >
            monicagm@uaeh.edu.mx
          </a>
        </p>
      </Section>

      <Section title="2. Datos personales que se recaban">
        <p>
          Con motivo de su inscripción y participación en el Concurso podrán
          recabarse las siguientes categorías de datos personales:
        </p>
        <SubTitle>Datos de identificación</SubTitle>
        <List items={["Nombre completo."]} />
        <SubTitle>Datos de contacto</SubTitle>
        <List items={["Correo electrónico."]} />
        <SubTitle>Datos académicos</SubTitle>
        <List items={["Matrícula o número de cuenta."]} />
        <SubTitle>Imagen y voz</SubTitle>
        <p>
          Durante el desarrollo de los talleres podrán captarse fotografías,
          videos, grabaciones audiovisuales y transmisiones en vivo donde pueda
          aparecer su imagen o voz.
        </p>
      </Section>

      <Section title="3. Finalidades del tratamiento">
        <SubTitle>3.1 Finalidades primarias</SubTitle>
        <p>Los datos personales serán utilizados para:</p>
        <List
          items={[
            "Registrar la participación en el CInSoft 2026.",
            "Administrar la logística de los talleres.",
            "Asignar horarios y espacios de talleres.",
            "Mantener comunicación con los participantes antes, durante y después del evento.",
            "Atender cualquier situación de seguridad o emergencia durante el desarrollo de algún taller.",
          ]}
        />
        <p>
          Estas finalidades son indispensables para la realización de los
          talleres.
        </p>

        <SubTitle>3.2 Finalidades secundarias</SubTitle>
        <p>Con su consentimiento, sus datos podrán utilizarse para:</p>
        <List
          items={[
            "Publicación de fotografías y videos del evento en redes sociales oficiales de la UAEH LIS.",
            "Elaboración de material promocional del Congreso.",
            "Envío de invitaciones a futuros concursos, talleres, conferencias, hackatones y demás actividades organizadas.",
          ]}
        />
        <p>
          La negativa para el tratamiento de sus datos con estas finalidades
          secundarias no será motivo para negar su participación en los
          talleres.
        </p>
      </Section>

      <Section title="4. Transferencia de datos personales">
        <p>
          Los datos personales podrán compartirse únicamente cuando resulte
          estrictamente necesario con:
        </p>
        <List
          items={[
            "Comité Organizador del CInSoft 2026.",
            "Autoridades académicas de la Licenciatura en Ingeniería en Software.",
            "Dependencias de la Universidad Autónoma del Estado de Hidalgo que intervengan en la organización del evento.",
            "Plataformas digitales utilizadas para el registro, evaluación o emisión de constancias.",
          ]}
        />
        <p>
          No se realizarán transferencias distintas a las aquí descritas, salvo
          aquellas previstas por la legislación aplicable o por requerimiento de
          autoridad competente.
        </p>
      </Section>

      <Section title="5. Derechos ARCO">
        <p>Usted podrá ejercer en cualquier momento sus derechos de:</p>
        <List
          items={["Acceso.", "Rectificación.", "Cancelación.", "Oposición."]}
        />
        <p>
          Asimismo, podrá revocar el consentimiento otorgado para las
          finalidades secundarias mediante solicitud enviada al correo
          electrónico del Responsable, indicando:
        </p>
        <List
          items={[
            "Nombre completo.",
            "Derecho que desea ejercer.",
            "Documentación que acredite su identidad.",
            "Motivo de la revocación.",
          ]}
        />
      </Section>

      <Section title="6. Uso de imagen y voz">
        <p>
          Durante los talleres podrán realizarse fotografías, grabaciones y
          transmisiones audiovisuales con fines de documentación y difusión
          institucional.
        </p>
        <p>
          En caso de que usted no desee que su imagen sea utilizada para las
          finalidades secundarias señaladas en este Aviso, podrá manifestarlo
          por escrito antes del inicio del evento o comunicarlo directamente al
          Comité Organizador durante su registro.
        </p>
        <p>
          El Comité Organizador realizará esfuerzos razonables para respetar
          dicha decisión, sin garantizar la exclusión total de imágenes grupales
          o panorámicas propias del desarrollo de los talleres.
        </p>
      </Section>

      <Section title="7. Medidas de seguridad">
        <p>
          El Comité Organizador implementará medidas administrativas, técnicas y
          organizativas razonables para proteger la confidencialidad e
          integridad de los datos personales recabados, evitando su alteración,
          pérdida, destrucción o acceso no autorizado.
        </p>
        <p>
          No obstante, el participante reconoce que ningún sistema informático
          puede garantizar un nivel absoluto de seguridad, por lo que el
          Responsable no será responsable de incidentes derivados de ataques
          informáticos, caso fortuito, fuerza mayor o actos realizados por
          terceros fuera de su control, siempre que se hayan implementado las
          medidas razonables de protección.
        </p>
      </Section>

      <Section title="8. Modificaciones al presente Aviso de Privacidad">
        <p>
          El Comité Organizador podrá modificar el presente Aviso de Privacidad
          cuando resulte necesario por cambios en la legislación, en la
          organización de los talleres o en los procesos de tratamiento de datos
          personales.
        </p>
        <p>
          Las modificaciones serán publicadas por los mismos medios oficiales
          utilizados para la difusión del CInSoft 2026.
        </p>
      </Section>

      <p className="font-code-badge text-code-badge text-on-surface-variant border-t-2 border-primary/20 pt-space-sm uppercase">
        Fecha de última actualización: septiembre de 2026.
      </p>
    </div>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-space-xs">
      <h3 className="font-label-caps text-label-caps text-primary uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-code-badge text-code-badge text-on-surface uppercase tracking-wider mt-space-2xs">
      {children}
    </h4>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-space-2xs pl-space-xs">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span className="text-primary shrink-0">›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
