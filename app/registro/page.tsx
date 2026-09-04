"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { BrutalistSelect } from "@/components/brutalist-select";
import { Modal, ModalHeader } from "@/components/modal";
import { PrivacyNotice } from "@/components/privacy-notice";
import logoCinsoft from "@/public/logo-cinsoft.png";
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
  // Datos ya validados esperando a que se acepte el aviso. Se valida ANTES de
  // abrir el modal para no hacer leer el aviso y fallar después por un campo.
  const [pending, setPending] = useState<RegistrationInput | null>(null);
  const [isSending, setIsSending] = useState(false);
  // Permite releer el aviso sin tener que intentar enviar el formulario.
  const [readingNotice, setReadingNotice] = useState(false);
  // Finalidades secundarias (§3.2): arranca MARCADA. La LFPDPPP admite
  // consentimiento tácito para finalidades secundarias con datos no sensibles
  // —la imagen no lo es— mientras el aviso esté disponible y haya un medio
  // claro de oponerse, que es como está redactado el §6. Lo que sostiene esa
  // validez es que la casilla se vea y se entienda, no que venga vacía.
  const [allowsSecondaryUse, setAllowsSecondaryUse] = useState(true);

  const reduced = useReducedMotion();
  // Stagger de los 5 bloques del formulario, ~40ms entre cada uno.
  const stagger = reduced
    ? {}
    : {
        initial: "hidden" as const,
        animate: "visible" as const,
        variants: {
          visible: { transition: { staggerChildren: 0.04 } },
        },
      };
  const {
    control,
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

  // `handleSubmit` sólo llama a esto si el formulario es válido, así que el
  // aviso únicamente aparece cuando el registro ya puede enviarse.
  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setPending(values);
  });

  const acceptAndSend = async () => {
    if (pending === null) return;
    setIsSending(true);
    try {
      const result = await createRegistration({
        ...pending,
        workshopId: pending.workshopId as Id<"workshops">,
        acceptedPrivacy: true,
        allowsSecondaryUse,
      });
      setConfirmation(result);
      setPending(null);
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
      setPending(null);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="w-full pt-20 bg-transparent min-h-screen">
      <div className="flex flex-col w-full items-center justify-center py-space-xl px-margin-mobile md:px-margin-desktop">
        <div className="w-full max-w-155 flex flex-col items-center">
          {/* HEADER BLOCK */}
          <div className="w-full text-center mb-space-lg select-none">
            {/* El logo sustituye al wordmark de texto y ya trae "6ta. edición",
                así que el badge "v2026" que lo acompañaba sobraba. Import
                estático: Next conoce las dimensiones y reserva el hueco, sin
                salto de maquetación al cargar. */}
            <h1 className="m-0">
              <Image
                alt="CINSOFT — 6ta edición"
                // El brazo robótico se corta en seco contra el borde superior.
                // Se difumina con una máscara sobre la propia imagen y no con
                // una capa opaca encima: así el fondo de puntos sigue viéndose
                // a través. El degradado acaba al 20%, justo antes de donde
                // empieza el badge "6ta. edición".
                className="w-full max-w-105 h-auto mx-auto [mask-image:linear-gradient(to_bottom,transparent_0%,#000_20%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_20%)]"
                priority
                sizes="(max-width: 640px) 85vw, 420px"
                src={logoCinsoft}
              />
            </h1>
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

            <motion.form
              className="flex flex-col gap-space-md"
              onSubmit={onSubmit}
              {...stagger}
            >
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
                <Controller
                  control={control}
                  name="group"
                  render={({ field }) => (
                    <BrutalistSelect
                      disabled={isDone}
                      hasError={errors.group !== undefined}
                      id="group"
                      labelledBy="group-label"
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      options={GROUPS.map((group) => ({
                        label: group,
                        value: group,
                      }))}
                      placeholder="> SELECCIONAR GRUPO..."
                      value={field.value ?? ""}
                    />
                  )}
                />
              </Field>

              {/* 5. TALLER */}
              <motion.div
                className="flex flex-col gap-space-2xs"
                transition={BLOCK_TRANSITION}
                variants={BLOCK_VARIANTS}
              >
                <div className="flex items-center justify-between">
                  <label
                    className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
                    htmlFor="workshop"
                    id="workshop-label"
                  >
                    5. TALLER
                  </label>
                  <QuotaBadge workshop={selected} />
                </div>
                <Controller
                  control={control}
                  name="workshopId"
                  render={({ field }) => (
                    <BrutalistSelect
                      disabled={isDone || workshops === undefined}
                      hasError={errors.workshopId !== undefined}
                      id="workshop"
                      labelledBy="workshop-label"
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      options={(workshops ?? []).map((workshop) => ({
                        disabled: workshop.isFull,
                        label: optionLabel(workshop),
                        value: workshop._id,
                      }))}
                      placeholder={
                        workshops === undefined
                          ? "> CARGANDO CATÁLOGO..."
                          : "> SELECCIONAR TALLER ELECTIVO..."
                      }
                      value={field.value ?? ""}
                    />
                  )}
                />
                {errors.workshopId?.message === undefined ? null : (
                  <FieldError message={errors.workshopId.message} />
                )}
              </motion.div>

              {/* SUBMIT BUTTON */}
              <motion.div
                className="mt-space-sm pt-space-xs"
                transition={BLOCK_TRANSITION}
                variants={BLOCK_VARIANTS}
              >
                <button
                  className={`w-full font-label-caps text-headline-sm uppercase tracking-wider border-[3px] border-black shadow-[6px_6px_0px_#000000] py-4 px-6 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0px_#000000] active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    isDone
                      ? "bg-surface-bright text-on-surface"
                      : "bg-primary text-on-primary"
                  }`}
                  disabled={isSubmitting || isSending || isDone}
                  type="submit"
                >
                  {isDone ? (
                    <>
                      <span className="material-symbols-outlined text-[20px]">
                        check
                      </span>
                      <span>REGISTRO COMPLETADO</span>
                    </>
                  ) : isSubmitting || isSending ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[20px]">
                        sync
                      </span>
                      <span>PROCESANDO MATRÍCULA...</span>
                    </>
                  ) : (
                    <>
                      <span>CONTINUAR AL AVISO</span>
                      <span className="material-symbols-outlined font-bold text-[22px]">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </motion.div>

              {/* FOOTNOTE BADGE */}
              <motion.div
                className="w-full flex items-center justify-center gap-2 mt-space-2xs"
                transition={BLOCK_TRANSITION}
                variants={BLOCK_VARIANTS}
              >
                <div className="inline-flex items-center gap-2 border border-secondary-container bg-surface px-3 py-1 text-secondary-container">
                  <span className="material-symbols-outlined text-[16px]">
                    warning
                  </span>
                  <span className="font-label-caps text-body-sm tracking-widest font-bold">
                    CUPO LIMITADO POR TALLER
                  </span>
                </div>
              </motion.div>
            </motion.form>

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

          <div className="mt-space-lg flex flex-col items-center gap-space-xs">
            <Link
              className="font-code-badge text-code-badge text-on-surface-variant hover:text-primary underline underline-offset-4 decoration-2 decoration-primary uppercase"
              href="/estatus"
            >
              ¿YA TE INSCRIBISTE? CONSULTA TU ESTATUS
            </Link>
            <button
              className="font-code-badge text-code-badge text-on-surface-variant hover:text-primary underline underline-offset-4 decoration-2 decoration-primary uppercase"
              onClick={() => setReadingNotice(true)}
              type="button"
            >
              LEER EL AVISO DE PRIVACIDAD
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pending === null ? null : (
          <PrivacyModal
            allowsSecondaryUse={allowsSecondaryUse}
            confirmLabel="ACEPTO Y ENVÍO MI REGISTRO"
            isSending={isSending}
            key="privacy-gate"
            onAccept={acceptAndSend}
            onClose={() => setPending(null)}
            onToggleSecondary={setAllowsSecondaryUse}
          />
        )}

        {readingNotice ? (
          <PrivacyModal
            key="privacy-read"
            onClose={() => setReadingNotice(false)}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

/**
 * Aviso de privacidad. Con `onAccept` es la puerta previa al envío; sin él es
 * sólo lectura, para poder consultarlo sin intentar registrarse.
 */
function PrivacyModal({
  allowsSecondaryUse,
  confirmLabel,
  isSending = false,
  onAccept,
  onClose,
  onToggleSecondary,
}: {
  allowsSecondaryUse?: boolean;
  confirmLabel?: string;
  isSending?: boolean;
  onAccept?: () => void;
  onClose: () => void;
  onToggleSecondary?: (value: boolean) => void;
}) {
  return (
    <Modal labelledBy="privacy-title" onClose={onClose} size="lg">
      <ModalHeader
        id="privacy-title"
        onClose={onClose}
        title="AVISO DE PRIVACIDAD INTEGRAL"
      />

      <div className="scrollbar-brutal overflow-y-auto p-space-lg flex-1 min-h-0">
        <PrivacyNotice />
      </div>

      <div className="border-t-4 border-primary bg-surface-container p-space-md flex flex-col gap-space-md">
        {onToggleSecondary === undefined ? null : (
          <label className="flex items-start gap-3 cursor-pointer select-none group">
            <input
              checked={allowsSecondaryUse === true}
              className="sr-only peer"
              disabled={isSending}
              onChange={(event) => onToggleSecondary(event.target.checked)}
              type="checkbox"
            />
            <div className="w-5 h-5 shrink-0 mt-0.5 bg-surface border-[3px] border-primary flex items-center justify-center peer-checked:bg-primary transition-none">
              <span className="material-symbols-outlined text-[14px] text-on-primary font-black opacity-0 peer-checked:opacity-100">
                check
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface">
              Autorizo el uso de mis datos e imagen para las finalidades
              secundarias del punto 3.2 (difusión en redes de la UAEH LIS,
              material promocional e invitaciones a próximas actividades).
              <span className="block font-code-badge text-code-badge text-secondary mt-space-2xs uppercase">
                ¿No lo autorizas? Desmarca esta casilla. No afecta a tu
                inscripción.
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
        <button
          className="px-space-lg py-3 bg-surface-container-high text-on-surface font-label-caps text-label-caps border-2 border-outline hover:border-primary shadow-[2px_2px_0px_#000] disabled:opacity-40"
          disabled={isSending}
          onClick={onClose}
          type="button"
        >
          {onAccept === undefined ? "[CERRAR]" : "[CANCELAR]"}
        </button>

        {onAccept === undefined ? null : (
          <button
            className="px-space-lg py-3 bg-primary text-on-primary font-label-caps text-label-caps border-[3px] border-black shadow-[4px_4px_0px_#000000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#000000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isSending}
            onClick={onAccept}
            type="button"
          >
            {isSending ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  sync
                </span>
                <span>ENVIANDO...</span>
              </>
            ) : (
              <>
                <span>{confirmLabel}</span>
                <span className="material-symbols-outlined text-[18px]">
                  check
                </span>
              </>
            )}
          </button>
        )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Variantes de cada bloque del formulario. Los hijos heredan `initial`/`animate`
 * del `motion.form`; si ese no anima (reduced motion), estos tampoco.
 */
const BLOCK_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

const BLOCK_TRANSITION = { duration: 0.16, ease: "easeOut" as const };

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
    <motion.div
      className="flex flex-col gap-space-2xs"
      transition={BLOCK_TRANSITION}
      variants={BLOCK_VARIANTS}
    >
      <div className="flex items-center justify-between">
        <label
          className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider"
          htmlFor={htmlFor}
          id={`${htmlFor}-label`}
        >
          {label}
        </label>
        <span className="font-code-badge text-code-badge text-on-surface-variant">
          {hint}
        </span>
      </div>
      {children}
      {error === undefined ? null : <FieldError message={error} />}
    </motion.div>
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
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="w-full mt-space-md p-4 bg-surface-container border-[3px] border-primary shadow-[6px_6px_0px_#000000]"
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
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
    </motion.div>
  );
}

function ErrorBanner({ error }: { error: { code: string; message: string } }) {
  const label =
    REGISTRATION_ERRORS[error.code as RegistrationErrorCode] ??
    "ERROR DEL SISTEMA";

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="w-full mt-space-md p-4 bg-surface-container border-[3px] border-secondary-container shadow-[6px_6px_0px_#000000]"
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
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
    </motion.div>
  );
}
