/** Catálogo de grupos definitivo del congreso. Ver PLAN §8.3. */
export const GROUPS = [
  "101",
  "102",
  "301",
  "302",
  "501",
  "502",
  "701",
  "702",
] as const;

export type Group = (typeof GROUPS)[number];

/** Color del badge del taller en la tabla del dashboard (el HTML alterna 3). */
export const ACCENTS = ["primary", "secondary", "tertiary"] as const;

export type Accent = (typeof ACCENTS)[number];

/** Umbral bajo el cual el badge de cupo pasa a "ÚLTIMOS LUGARES". */
export const LOW_QUOTA_RATIO = 0.2;
