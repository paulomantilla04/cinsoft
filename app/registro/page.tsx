import Link from "next/link";

/**
 * /registro — portado 1:1 de design/form.html.
 * F0: markup estático. La lógica (Convex + react-hook-form + Zod) entra en F2.
 */
export default function RegistroPage() {
  return (
    <main className="w-full pt-20 bg-transparent min-h-screen">
      <div className="flex flex-col w-full items-center justify-center py-space-xl px-margin-mobile md:px-margin-desktop">
        <div className="w-full max-w-155 flex flex-col items-center">
          {/* HEADER BLOCK */}
          <div className="w-full text-center mb-space-lg select-none">
            <div className="inline-block relative">
              <h1 className="font-display-hero text-display-hero text-primary tracking-tighter uppercase inline-block drop-shadow-[4px_4px_0px_#000000]">
                CINS<span className="text-secondary-container">{"{ }"}</span>FT
              </h1>
              <div className="absolute -top-3 -right-6 px-1.5 py-0.5 bg-secondary-container text-on-secondary font-code-badge text-code-badge tracking-widest uppercase border-2 border-black rotate-6">
                v2026
              </div>
            </div>
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-[0.25em] uppercase mt-space-2xs">
              REGISTRO A TALLERES
            </p>
          </div>

          {/* TERMINAL CARD */}
          <div className="w-full bg-surface-container-low border-4 border-primary shadow-[6px_6px_0px_#000000] p-6 md:p-8 relative">
            {/* TOP PROTOCOL BAR */}
            <div className="flex items-center justify-between border-b-2 border-primary/30 pb-space-sm mb-space-md font-code-badge text-code-badge">
              <span className="flex items-center gap-1.5 text-primary">
                <span className="w-2 h-2 bg-primary animate-pulse inline-block" />
                AUTH_LEVEL: STUDENT_SESSION
              </span>
              <span className="text-on-surface-variant">
                PORTAL_REF: T-REG//SEC-01
              </span>
            </div>

            <form className="flex flex-col gap-space-md">
              {/* 1. NÚMERO DE CUENTA */}
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="student_id"
                  >
                    1. NÚMERO DE CUENTA
                  </label>
                  <span className="font-code-badge text-code-badge text-on-surface-variant">
                    [6 DÍGITOS]
                  </span>
                </div>
                <div className="relative">
                  <input
                    className="w-full bg-surface text-on-surface font-body-md border-[3px] border-on-surface-variant/40 px-4 py-3 placeholder:text-outline focus:border-secondary-container focus:outline-none transition-none shadow-[3px_3px_0px_#000000]"
                    id="student_id"
                    inputMode="numeric"
                    maxLength={6}
                    name="student_id"
                    pattern="[0-9]*"
                    placeholder="49XXXX"
                    required
                    type="text"
                  />
                </div>
              </div>

              {/* 2. CORREO ELECTRÓNICO */}
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="email"
                  >
                    2. CORREO ELECTRÓNICO
                  </label>
                  <span className="font-code-badge text-code-badge text-on-surface-variant">
                    [INSTITUCIONAL]
                  </span>
                </div>
                <div className="relative">
                  <input
                    className="w-full bg-surface text-on-surface font-body-md border-[3px] border-on-surface-variant/40 px-4 py-3 placeholder:text-outline focus:border-secondary-container focus:outline-none transition-none shadow-[3px_3px_0px_#000000]"
                    id="email"
                    name="email"
                    placeholder="alumno@uaeh.edu.mx"
                    required
                    type="email"
                  />
                </div>
              </div>

              {/* 3. NOMBRE COMPLETO */}
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="fullname"
                  >
                    3. NOMBRE COMPLETO
                  </label>
                  <span className="font-code-badge text-code-badge text-on-surface-variant">
                    [NOMBRE Y APELLIDOS]
                  </span>
                </div>
                <div className="relative">
                  <input
                    className="w-full bg-surface text-on-surface font-body-md border-[3px] border-on-surface-variant/40 px-4 py-3 placeholder:text-outline focus:border-secondary-container focus:outline-none transition-none shadow-[3px_3px_0px_#000000]"
                    id="fullname"
                    name="fullname"
                    placeholder="Tu nombre y apellidos"
                    required
                    type="text"
                  />
                </div>
              </div>

              {/* 4. GRUPO */}
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="group"
                  >
                    4. GRUPO
                  </label>
                  <span className="font-code-badge text-code-badge text-on-surface-variant">
                    [SELECCIONAR GRUPO]
                  </span>
                </div>
                <div className="relative">
                  <select
                    className="w-full bg-surface text-on-surface font-body-md border-[3px] border-on-surface-variant/40 px-4 py-3 appearance-none focus:border-secondary-container focus:outline-none cursor-pointer transition-none shadow-[3px_3px_0px_#000000]"
                    defaultValue=""
                    id="group"
                    name="group"
                    required
                  >
                    <option className="bg-surface text-outline" disabled value="">
                      &gt; SELECCIONAR GRUPO...
                    </option>
                    {GROUPS.map((g) => (
                      <option
                        className="bg-surface-container-low text-on-surface py-2"
                        key={g}
                        value={g}
                      >
                        {g}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 bg-primary text-on-primary border-l-[3px] border-surface">
                    <span className="material-symbols-outlined text-[20px] font-bold">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. TALLER */}
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="workshop"
                  >
                    5. TALLER
                  </label>
                  <span
                    className="font-code-badge text-code-badge text-primary"
                    id="quotaBadge"
                  >
                    [SELECCIONAR TALLER]
                  </span>
                </div>
                <div className="relative">
                  <select
                    className="w-full bg-surface text-on-surface font-body-md border-[3px] border-on-surface-variant/40 px-4 py-3 appearance-none focus:border-secondary-container focus:outline-none cursor-pointer transition-none shadow-[3px_3px_0px_#000000]"
                    defaultValue=""
                    id="workshop"
                    name="workshop"
                    required
                  >
                    <option className="bg-surface text-outline" disabled value="">
                      &gt; SELECCIONAR TALLER ELECTIVO...
                    </option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 bg-primary text-on-primary border-l-[3px] border-surface">
                    <span className="material-symbols-outlined text-[20px] font-bold">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              {/* SUBMIT */}
              <div className="mt-space-sm pt-space-xs">
                <button
                  className="w-full bg-primary text-on-primary font-label-caps text-headline-sm uppercase tracking-wider border-[3px] border-black shadow-[6px_6px_0px_#000000] py-4 px-6 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0px_#000000] active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer"
                  type="submit"
                >
                  <span>ENVIAR REGISTRO</span>
                  <span className="material-symbols-outlined font-bold text-[22px]">
                    arrow_forward
                  </span>
                </button>
              </div>

              {/* FOOTNOTE BADGE */}
              <div className="w-full flex items-center justify-center gap-2 mt-space-2xs">
                <div className="inline-flex items-center gap-2 border border-secondary-container bg-surface px-3 py-1 text-secondary-container">
                  <span className="material-symbols-outlined text-[16px]">
                    warning
                  </span>
                  <span className="font-label-caps text-body-sm tracking-widest font-bold">
                    CUPO LIMITADO POR TALLER
                  </span>
                </div>
              </div>
            </form>

            {/* SYSTEM STATUS FOOTER INSIDE CARD */}
            <div className="mt-space-lg pt-space-sm border-t border-primary/20 flex flex-wrap items-center justify-between gap-2 font-code-badge text-code-badge text-on-surface-variant">
              <span>SISTEMA: EN LÍNEA // VERIFICACIÓN ACTIVA</span>
              <span className="text-primary font-bold">CINSOFT-ING-2026</span>
            </div>
          </div>

          <Link
            className="mt-space-lg font-code-badge text-code-badge text-on-surface-variant hover:text-primary underline underline-offset-4 decoration-2 decoration-primary uppercase"
            href="/estatus"
          >
            ¿YA TE INSCRIBISTE? CONSULTA TU ESTATUS
          </Link>
        </div>
      </div>
    </main>
  );
}

const GROUPS = ["101", "102", "301", "302", "501", "502", "701", "702"];
