"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LOOKUP_HINT, parseLookupTerm } from "@/lib/validation";

/**
 * /estatus — consulta pública de inscripción.
 *
 * Pantalla sin mock: diseñada con el mismo vocabulario brutalista de las otras
 * tres (bordes 2–4px, sombras duras, textos de terminal, radio 0).
 */
export default function EstatusPage() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  // El término inválido ni siquiera sale a la red: se avisa en el cliente.
  const isValid = parseLookupTerm(term) !== null;
  const result = useQuery(
    api.registrations.lookup,
    submitted === null ? "skip" : { term: submitted },
  );
  const isLoading = submitted !== null && result === undefined;

  return (
    <main className="w-full pt-20 bg-transparent min-h-screen">
      <div className="flex flex-col w-full items-center py-space-xl px-margin-mobile md:px-margin-desktop">
        <div className="w-full max-w-155 flex flex-col items-center">
          {/* HEADER BLOCK */}
          <div className="w-full text-center mb-space-lg select-none">
            <div className="inline-block relative">
              <h1 className="font-display-hero text-headline-lg-mobile sm:text-headline-lg text-primary tracking-tighter uppercase inline-block drop-shadow-[4px_4px_0px_#000000]">
                ESTATUS<span className="text-secondary-container">_</span>
              </h1>
            </div>
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-[0.25em] uppercase mt-space-2xs">
              CONSULTA DE INSCRIPCIÓN
            </p>
          </div>

          {/* TERMINAL CARD */}
          <div className="w-full bg-surface-container-low border-4 border-primary shadow-[6px_6px_0px_#000000] p-6 md:p-8 relative">
            <div className="flex items-center justify-between border-b-2 border-primary/30 pb-space-sm mb-space-md font-code-badge text-code-badge">
              <span className="flex items-center gap-1.5 text-primary">
                <span className="w-2 h-2 bg-primary animate-pulse inline-block" />
                AUTH_LEVEL: PUBLIC_QUERY
              </span>
              <span className="text-on-surface-variant">
                PORTAL_REF: T-STAT//SEC-02
              </span>
            </div>

            <form
              className="flex flex-col gap-space-md"
              onSubmit={(event) => {
                event.preventDefault();
                if (isValid) setSubmitted(term.trim());
              }}
            >
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="lookup"
                  >
                    IDENTIFICADOR
                  </label>
                  <span className="font-code-badge text-code-badge text-on-surface-variant">
                    [CUENTA O CORREO]
                  </span>
                </div>
                <input
                  autoComplete="off"
                  className="w-full bg-surface text-on-surface font-body-md border-[3px] border-on-surface-variant/40 px-4 py-3 placeholder:text-outline focus:border-secondary-container focus:outline-none transition-none shadow-[3px_3px_0px_#000000]"
                  id="lookup"
                  onChange={(event) => {
                    setTerm(event.target.value);
                    setSubmitted(null);
                  }}
                  placeholder="123456  ·  alumno@uaeh.edu.mx"
                  value={term}
                />
                {term.length > 0 && !isValid ? (
                  <span className="font-code-badge text-code-badge text-secondary mt-space-2xs">
                    ⚠ {LOOKUP_HINT}
                  </span>
                ) : null}
              </div>

              <button
                className="w-full bg-primary text-on-primary font-label-caps text-headline-sm uppercase tracking-wider border-[3px] border-black shadow-[6px_6px_0px_#000000] py-4 px-6 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0px_#000000] active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-[6px_6px_0px_#000000] disabled:translate-x-0 disabled:translate-y-0"
                disabled={!isValid || isLoading}
                type="submit"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">
                      sync
                    </span>
                    <span>CONSULTANDO REGISTRO...</span>
                  </>
                ) : (
                  <>
                    <span>CONSULTAR ESTATUS</span>
                    <span className="material-symbols-outlined font-bold text-[22px]">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-space-lg pt-space-sm border-t border-primary/20 flex flex-wrap items-center justify-between gap-2 font-code-badge text-code-badge text-on-surface-variant">
              <span>SISTEMA: EN LÍNEA // LECTURA EN VIVO</span>
              <span className="text-primary font-bold">CINSOFT-ING-2026</span>
            </div>
          </div>

          {/* RESULTADO */}
          {result?.status === "found" ? (
            <ResultCard registration={result.registration} />
          ) : null}

          {result?.status === "not_found" ? <NotFoundCard /> : null}

          <Link
            className="mt-space-lg font-code-badge text-code-badge text-on-surface-variant hover:text-primary underline underline-offset-4 decoration-2 decoration-primary uppercase"
            href="/registro"
          >
            ¿AÚN NO TE INSCRIBES? IR AL REGISTRO
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Colores del badge del taller, alineados con la tabla del dashboard. */
const ACCENT_CLASSES = {
  primary: "text-primary border-primary",
  secondary: "text-secondary border-secondary",
  tertiary: "text-tertiary border-tertiary",
} as const;

type Registration = Extract<
  NonNullable<ReturnType<typeof useQuery<typeof api.registrations.lookup>>>,
  { status: "found" }
>["registration"];

function ResultCard({ registration }: { registration: Registration }) {
  const accent = ACCENT_CLASSES[registration.workshop.accent];

  return (
    <div className="w-full mt-space-md bg-surface-container border-[3px] border-primary shadow-[6px_6px_0px_#000000]">
      <div className="bg-surface-container-high border-b-[3px] border-primary px-space-md py-space-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-secondary-container border border-black inline-block" />
          <span className="w-3 h-3 bg-primary-container border border-black inline-block" />
          <span className="w-3 h-3 bg-primary border border-black inline-block" />
          <span className="ml-2 font-code-badge text-code-badge text-on-surface-variant font-bold uppercase">
            RECORD_FOUND // MATRÍCULA CONFIRMADA
          </span>
        </div>
        <span className="material-symbols-outlined text-primary text-[18px]">
          verified
        </span>
      </div>

      <div className="p-space-lg flex flex-col gap-space-md">
        <div className="flex flex-col gap-space-2xs">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            TALLER ASIGNADO
          </span>
          <span className="font-display-hero text-headline-md text-on-background uppercase leading-tight">
            {registration.workshop.name}
          </span>
          <span
            className={`self-start mt-space-2xs inline-block bg-surface-container-highest border-2 px-2.5 py-1 font-code-badge text-code-badge font-bold uppercase ${accent}`}
          >
            {registration.workshop.keyword}
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-space-md border-t-2 border-primary/20 pt-space-md">
          <Field label="NÚMERO DE CUENTA" value={registration.accountNumber} />
          <Field label="GRUPO" value={`G-${registration.group}`} />
          <Field label="ALUMNO" value={registration.maskedName} />
          <Field label="CORREO" value={registration.maskedEmail} />
        </dl>

{registration.reassignedAt === undefined ? null : (
          <div className="flex items-start gap-2 border-2 border-secondary bg-surface-container-high p-space-sm">
            <span className="material-symbols-outlined text-secondary text-[18px]">
              swap_horiz
            </span>
            <div className="flex flex-col">
              <span className="font-label-caps text-code-badge text-secondary uppercase tracking-wider">
                REASIGNADO POR COORDINACIÓN
              </span>
              <span className="font-body-sm text-body-sm text-on-surface mt-0.5">
                Tu taller cambió el{" "}
                {formatTimestamp(registration.reassignedAt)} — el taller de
                arriba es el vigente.
              </span>
            </div>
          </div>
        )}

        <p className="font-code-badge text-code-badge text-on-surface-variant border-t-2 border-primary/20 pt-space-sm">
          REGISTRADO: {formatTimestamp(registration.registeredAt)}
          {" // "}
          ESTE DATO REFLEJA TU TALLER ACTUAL, INCLUSO SI FUISTE REASIGNADO.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-space-2xs">
      <dt className="font-code-badge text-code-badge text-on-surface-variant uppercase">
        {label}
      </dt>
      <dd className="font-body-md text-body-md text-on-surface font-bold">
        {value}
      </dd>
    </div>
  );
}

function NotFoundCard() {
  return (
    <div className="w-full mt-space-md p-space-lg bg-surface-container border-[3px] border-secondary-container shadow-[6px_6px_0px_#000000] flex items-start gap-3">
      <span className="material-symbols-outlined text-secondary text-[28px]">
        report
      </span>
      <div className="flex flex-col">
        <span className="font-label-caps text-label-caps text-secondary tracking-wider uppercase">
          NO_RECORD_FOUND // BUFFER VACÍO
        </span>
        <p className="font-body-sm text-body-sm text-on-surface mt-0.5">
          No hay ninguna inscripción con ese identificador. Verifica tu número
          de cuenta o tu correo, o completa tu registro si aún no lo hiciste.
        </p>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(timestamp);
}
