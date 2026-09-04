import { z } from "zod";
import { GROUPS } from "./catalog";

/**
 * Esquema único compartido por el formulario (react-hook-form) y la mutation
 * de Convex. La validación de cliente es UX; la de servidor es la que manda.
 */
export const registrationSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El número de cuenta debe tener exactamente 6 dígitos."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[^\s@]+@uaeh\.edu\.mx$/i,
      "Usa tu correo institucional @uaeh.edu.mx.",
    ),
  fullName: z
    .string()
    .trim()
    .min(3, "Escribe tu nombre completo.")
    .max(120, "El nombre no puede exceder 120 caracteres.")
    .transform((value) => value.replace(/\s+/g, " ")),
  group: z.enum(GROUPS, { error: "Selecciona un grupo válido." }),
  // El mensaje va también en el tipo, no sólo en `.min(1)`: el selector custom
  // arranca en `undefined` (no en cadena vacía) y sin esto Zod devolvía su
  // error genérico en inglés.
  workshopId: z
    .string({ error: "Selecciona un taller." })
    .min(1, "Selecciona un taller."),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

const ACCOUNT_PATTERN = /^\d{6}$/;
const UAEH_EMAIL_PATTERN = /^[^\s@]+@uaeh\.edu\.mx$/i;

/**
 * La consulta de /estatus acepta indistintamente número de cuenta o correo
 * institucional. Devuelve el término normalizado junto con el tipo detectado
 * para que el servidor sepa qué índice usar.
 */
export function parseLookupTerm(
  term: string,
): { kind: "account" | "email"; value: string } | null {
  const value = term.trim();
  if (ACCOUNT_PATTERN.test(value)) return { kind: "account", value };
  if (UAEH_EMAIL_PATTERN.test(value)) {
    return { kind: "email", value: value.toLowerCase() };
  }
  return null;
}

export const LOOKUP_HINT =
  "Escribe tu número de cuenta (6 dígitos) o tu correo @uaeh.edu.mx.";

/** Códigos de error que la mutation `registrations.create` puede lanzar. */
export const REGISTRATION_ERRORS = {
  DUPLICATE_ACCOUNT: "CUENTA YA INSCRITA",
  DUPLICATE_EMAIL: "CORREO YA INSCRITO",
  WORKSHOP_FULL: "CUPO LLENO",
  WORKSHOP_NOT_FOUND: "TALLER NO DISPONIBLE",
  VALIDATION: "DATOS INVÁLIDOS",
} as const;

export type RegistrationErrorCode = keyof typeof REGISTRATION_ERRORS;
