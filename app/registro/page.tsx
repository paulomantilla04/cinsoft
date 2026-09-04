"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GROUPS, LOW_QUOTA_RATIO } from "@/lib/catalog";
import {
  REGISTRATION_ERRORS,
  registrationSchema,
  type RegistrationErrorCode,
  type RegistrationInput,
} from "@/lib/validation";

type Confirmation = {
  accountNumber: string;
  email: string;
  fullName: string;
  workshopName: string;
};

/** /registro — portado 1:1 de design/form.html. */
export default function RegistroPage() {
  const workshops = useQuery(api.workshops.list, {});
  const createRegistration = useMutation(api.registrations.create);

  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [serverError, setServerError] = useState<{
    code: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
  });

  const selectedId = watch("workshopId");
  const selected = workshops?.find((workshop) => workshop._id === selectedId);
  const isDone = confirmation !== null;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await createRegistration({
        ...values,
        workshopId: values.workshopId as Id<"workshops">,
      });
      setConfirmation(result);
    } catch (error) {
      // El servidor lanza ConvexError({ code, message }) para poder pintar el
      // banner correcto en vez de un error genérico.
      const data = error instanceof ConvexError ? error.data : null;
      setServerError({
        code: data?.code ?? "UNKNOWN",
        message:
          data?.message ??
          "No se pudo completar el registro. Intenta de nuevo.",
      });
    }
  });

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

            <form className="flex flex-col gap-space-md" onSubmit={onSubmit}>
              {/* 1. NÚMERO DE CUENTA */}
              <Field
                error={errors.accountNumber?.message}
                hint="[6 DÍGITOS]"
                htmlFor="student_id"
                label="1. NÚMERO DE CUENTA"
              >
                <input
                  className={inputClass(errors.accountNumber !== undefined)}
                  disabled={isDone}
                  id="student_id"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="49XXXX"
                  type="text"
                  {...register("accountNumber", {
                    // El input sólo acepta dígitos: el HTML traía maxlength=10
                    // y ningún filtro.
                    onChange: (event) => {
                      event.target.value = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                    },
                  })}
                />
              </Field>

              {/* 2. CORREO ELECTRÓNICO */}
              <Field
                error={errors.email?.message}
                hint="[INSTITUCIONAL]"
                htmlFor="email"
                label="2. CORREO ELECTRÓNICO"
              >
                <input
                  className={inputClass(errors.email !== undefined)}
                  disabled={isDone}
                  id="email"
                  placeholder="alumno@uaeh.edu.mx"
                  type="email"
                  {...register("email")}
                />
              </Field>

              {/* 3. NOMBRE COMPLETO */}
              <Field
                error={errors.fullName?.message}
                hint="[NOMBRE Y APELLIDOS]"
                htmlFor="fullname"
                label="3. NOMBRE COMPLETO"
              >
                <input
                  className={inputClass(errors.fullName !== undefined)}
                  disabled={isDone}
                  id="fullname"
                  placeholder="Tu nombre y apellidos"
                  type="text"
                  {...register("fullName")}
                />
              </Field>

              {/* 4. GRUPO */}
              <Field
                error={errors.group?.message}
                hint="[SELECCIONAR GRUPO]"
                htmlFor="group"
                label="4. GRUPO"
              >
                <SelectShell>
                  <select
                    className={selectClass(errors.group !== undefined)}
                    defaultValue=""
                    disabled={isDone}
                    id="group"
                    {...register("group")}
                  >
                    <option className="bg-surface text-outline" disabled value="">
                      &gt; SELECCIONAR GRUPO...
                    </option>
                    {GROUPS.map((group) => (
                      <option
                        className="bg-surface-container-low text-on-surface py-2"
                        key={group}
                        value={group}
                      >
                        {group}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              </Field>

              {/* 5. TALLER */}
              <div className="flex flex-col gap-space-2xs">
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="workshop"
                  >
                    5. TALLER
                  </label>
                  <QuotaBadge workshop={selected} />
                </div>
                <SelectShell>
                  <select
                    className={selectClass(errors.workshopId !== undefined)}
                    defaultValue=""
                    disabled={isDone || workshops === undefined}
                    id="workshop"
                    {...register("workshopId")}
                  >
                    <option className="bg-surface text-outline" disabled value="">
                      {workshops === undefined
                        ? "> CARGANDO CATÁLOGO..."
                        : "> SELECCIONAR TALLER ELECTIVO..."}
                    </option>
                    {workshops?.map((workshop) => (
                      <option
                        className="bg-surface-container-low text-on-surface py-2"
                        disabled={workshop.isFull}
                        key={workshop._id}
                        value={workshop._id}
                      >
                        {optionLabel(workshop)}
                      </option>
                    ))}
                  </select>
                </SelectShell>
                {errors.workshopId?.message === undefined ? null : (
                  <FieldError message={errors.workshopId.message} />
                )}
              </div>

              {/* SUBMIT BUTTON */}
              <div className="mt-space-sm pt-space-xs">
                <button
                  className={`w-full font-label-caps text-headline-sm uppercase tracking-wider border-[3px] border-black shadow-[6px_6px_0px_#000000] py-4 px-6 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0px_#000000] active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    isDone
                      ? "bg-surface-bright text-on-surface"
                      : "bg-primary text-on-primary"
                  }`}
                  disabled={isSubmitting || isDone}
                  type="submit"
                >
                  {isDone ? (
                    <>
                      <span className="material-symbols-outlined text-[20px]">
                        check
                      </span>
                      <span>REGISTRO COMPLETADO</span>
                    </>
                  ) : isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[20px]">
                        sync
                      </span>
                      <span>PROCESANDO MATRÍCULA...</span>
                    </>
                  ) : (
                    <>
                      <span>ENVIAR REGISTRO</span>
                      <span className="material-symbols-outlined font-bold text-[22px]">
                        arrow_forward
                      </span>
                    </>
                  )}
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

          {confirmation === null ? null : (
            <SuccessBanner confirmation={confirmation} />
          )}
          {serverError === null ? null : <ErrorBanner error={serverError} />}

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

type Workshop = NonNullable<
  ReturnType<typeof useQuery<typeof api.workshops.list>>
>[number];

/** `NOMBRE (N cupos disp.)`, marcando los críticos y los llenos. */
function optionLabel(workshop: Workshop) {
  if (workshop.isFull) return `${workshop.name} (CUPO LLENO)`;
  if (isLow(workshop)) {
    return `${workshop.name} (${workshop.remaining} cupos disp. - CRÍTICO)`;
  }
  return `${workshop.name} (${workshop.remaining} cupos disp.)`;
}

const isLow = (workshop: Workshop) =>
  workshop.remaining <= Math.ceil(workshop.capacity * LOW_QUOTA_RATIO);

function QuotaBadge({ workshop }: { workshop: Workshop | undefined }) {
  if (workshop === undefined) {
    return (
      <span className="font-code-badge text-code-badge text-primary">
        [SELECCIONAR TALLER]
      </span>
    );
  }
  if (workshop.isFull) {
    return (
      <span className="font-code-badge text-code-badge text-secondary font-bold">
        [ESTADO: CUPO LLENO]
      </span>
    );
  }
  if (isLow(workshop)) {
    return (
      <span className="font-code-badge text-code-badge text-secondary font-bold">
        [ESTADO: ÚLTIMOS LUGARES]
      </span>
    );
  }
  return (
    <span className="font-code-badge text-code-badge text-primary font-bold">
      [ESTADO: DISPONIBLE]
    </span>
  );
}

const inputClass = (hasError: boolean) =>
  `w-full bg-surface text-on-surface font-body-md border-[3px] px-4 py-3 placeholder:text-outline focus:border-secondary-container focus:outline-none transition-none shadow-[3px_3px_0px_#000000] disabled:opacity-60 ${
    hasError ? "border-secondary" : "border-on-surface-variant/40"
  }`;

const selectClass = (hasError: boolean) =>
  `w-full bg-surface text-on-surface font-body-md border-[3px] px-4 py-3 appearance-none focus:border-secondary-container focus:outline-none cursor-pointer transition-none shadow-[3px_3px_0px_#000000] disabled:opacity-60 ${
    hasError ? "border-secondary" : "border-on-surface-variant/40"
  }`;

/** El chevron con fondo primary de los <select> del HTML. */
function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 bg-primary text-on-primary border-l-[3px] border-surface">
        <span className="material-symbols-outlined text-[20px] font-bold">
          expand_more
        </span>
      </div>
    </div>
  );
}

function Field({
  children,
  error,
  hint,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  hint: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-space-2xs">
      <div className="flex items-center justify-between">
        <label
          className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
          htmlFor={htmlFor}
        >
          {label}
        </label>
        <span className="font-code-badge text-code-badge text-on-surface-variant">
          {hint}
        </span>
      </div>
      {children}
      {error === undefined ? null : <FieldError message={error} />}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <span className="font-code-badge text-code-badge text-secondary mt-space-2xs">
      ⚠ {message}
    </span>
  );
}

function SuccessBanner({ confirmation }: { confirmation: Confirmation }) {
  return (
    <div className="w-full mt-space-md p-4 bg-surface-container border-[3px] border-primary shadow-[6px_6px_0px_#000000]">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[28px]">
          verified
        </span>
        <div className="flex flex-col">
          <span className="font-label-caps text-label-caps text-primary tracking-wider uppercase">
            INSCRIPCIÓN REGISTRADA
          </span>
          <p className="font-body-sm text-on-surface mt-0.5">
            <strong>ALUMNO:</strong> {confirmation.fullName} (
            {confirmation.accountNumber})
            <br />
            <strong>TALLER:</strong> {confirmation.workshopName}
            <br />
            <strong>CORREO:</strong> {confirmation.email}
          </p>
          <p className="font-code-badge text-code-badge text-on-surface-variant mt-space-sm">
            PUEDES GUARDAR ESTE COMPROBANTE
            {" // "}
            PUEDES RECONSULTARLO EN /ESTATUS.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: { code: string; message: string } }) {
  const label =
    REGISTRATION_ERRORS[error.code as RegistrationErrorCode] ??
    "ERROR DEL SISTEMA";

  return (
    <div className="w-full mt-space-md p-4 bg-surface-container border-[3px] border-secondary-container shadow-[6px_6px_0px_#000000]">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-secondary text-[28px]">
          warning
        </span>
        <div className="flex flex-col">
          <span className="font-label-caps text-label-caps text-secondary tracking-wider uppercase">
            ⚠ REGISTRO RECHAZADO {" // "} {label}
          </span>
          <p className="font-body-sm text-on-surface mt-0.5">{error.message}</p>
        </div>
      </div>
    </div>
  );
}
