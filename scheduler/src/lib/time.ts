import { DateTime } from "luxon";

/**
 * Company timezone — used to interpret interviewer availability windows and as
 * the default display zone. Per SPEC §3.3: store UTC, display Asia/Taipei.
 */
export const COMPANY_TZ = process.env.COMPANY_TZ || "Asia/Taipei";

/** Parse "HH:mm" into { hour, minute }. */
export function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return { hour: h, minute: m };
}

/**
 * Build a UTC Date for a given calendar date (YYYY-MM-DD) + "HH:mm" wall-clock
 * time interpreted in the given zone.
 */
export function wallClockToUtc(
  isoDate: string,
  hm: string,
  zone: string
): Date {
  const { hour, minute } = parseHm(hm);
  const dt = DateTime.fromISO(isoDate, { zone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  return dt.toUTC().toJSDate();
}

/**
 * Luxon weekday is 1 (Mon) .. 7 (Sun). Our model stores dayOfWeek as
 * 0 (Sun) .. 6 (Sat) to match JS getDay(). Convert from a date in a zone.
 */
export function dayOfWeekInZone(isoDate: string, zone: string): number {
  const dt = DateTime.fromISO(isoDate, { zone });
  return dt.weekday % 7; // Luxon Sun=7 -> 0
}

/** Format a UTC instant as an HH:mm label in the target display zone. */
export function utcToLabel(utc: Date, zone: string): string {
  return DateTime.fromJSDate(utc, { zone: "utc" })
    .setZone(zone)
    .toFormat("HH:mm");
}

/** ISO date string (YYYY-MM-DD) for "today" in a zone. */
export function todayIso(zone: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone: "utc" }).setZone(zone).toISODate()!;
}
