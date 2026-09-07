/**
 * Horarios de los talleres.
 *
 * México dejó el horario de verano en 2022, así que Hidalgo está en UTC-6 todo
 * el año: basta con un desfase fijo para pasar de hora local a instante.
 */
const MEXICO_UTC_OFFSET_HOURS = 6;

/** Construye el instante en milisegundos desde una hora local de Hidalgo. */
export function mexicoTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return Date.UTC(year, month - 1, day, hour + MEXICO_UTC_OFFSET_HOURS, minute);
}

export type Schedule = { startsAt: number; endsAt: number };

/**
 * Dos talleres se cruzan si uno empieza antes de que el otro termine y
 * viceversa. Se usa `<` y no `<=` a propósito: terminar a las 14:00 y empezar
 * a las 14:00 no es un cruce, sólo talleres consecutivos.
 */
export function overlaps(a: Schedule, b: Schedule) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Mexico_City",
});

const TIME_FORMAT = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Mexico_City",
});

/** "lunes 21 de septiembre, 11:30–14:30" */
export function formatSchedule(schedule: Schedule) {
  return `${DATE_FORMAT.format(schedule.startsAt)}, ${TIME_FORMAT.format(
    schedule.startsAt,
  )}–${TIME_FORMAT.format(schedule.endsAt)}`;
}

/** "LUN 21 · 11:30–14:30", para donde el espacio escasea. */
export function formatScheduleShort(schedule: Schedule) {
  const day = new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    timeZone: "America/Mexico_City",
  }).format(schedule.startsAt);
  return `${day.toUpperCase()} · ${TIME_FORMAT.format(schedule.startsAt)}–${TIME_FORMAT.format(schedule.endsAt)}`;
}

/** Un taller sin horario no puede cruzarse con nada. */
export function toSchedule(workshop: {
  startsAt?: number;
  endsAt?: number;
}): Schedule | null {
  if (workshop.startsAt === undefined || workshop.endsAt === undefined) {
    return null;
  }
  return { startsAt: workshop.startsAt, endsAt: workshop.endsAt };
}
