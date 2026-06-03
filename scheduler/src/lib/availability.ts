import { DateTime } from "luxon";
import {
  COMPANY_TZ,
  dayOfWeekInZone,
  utcToLabel,
  wallClockToUtc,
} from "./time";

/**
 * Bookable-slot engine (SPEC §3.6).
 *
 * This is a pure function so it is fully unit-testable without a DB or Google.
 * In M1 the Google free/busy steps (§3.6 steps 4–5) are no-ops because no
 * `busyIntervals` are provided; M2 will pass real free/busy ranges through the
 * same `busyIntervals` seam without changing the rest of the logic.
 */

export type AssignmentStrategy = "single" | "collective" | "round_robin";

export interface AvailabilityWindow {
  dayOfWeek: number; // 0 (Sun) .. 6 (Sat)
  startTime: string; // "HH:mm" in COMPANY_TZ
  endTime: string; // "HH:mm" in COMPANY_TZ
}

export interface DateOverrideInput {
  date: string; // "YYYY-MM-DD" in COMPANY_TZ
  available: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface Interval {
  startUtc: Date;
  endUtc: Date;
}

export interface InterviewerInput {
  id: string;
  name: string;
  availability: AvailabilityWindow[];
  dateOverrides?: DateOverrideInput[];
  /** Busy ranges from Google free/busy (M2). Empty in M1. */
  busyIntervals?: Interval[];
  /** Confirmed bookings for this interviewer (used for maxPerDay + overlap). */
  bookings?: Interval[];
}

export interface EventTypeConfig {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeHours: number;
  maxPerDay?: number | null;
  bookingWindowDays: number;
  assignment: AssignmentStrategy;
  /** Slot step in minutes; defaults to 30. */
  stepMin?: number;
}

export interface GenerateSlotsParams {
  eventType: EventTypeConfig;
  interviewers: InterviewerInput[];
  /** Target calendar date "YYYY-MM-DD", interpreted in `displayTz`. */
  date: string;
  /** Candidate-facing timezone. Defaults to COMPANY_TZ. */
  displayTz?: string;
  /** Injected "now" for deterministic tests; defaults to current time. */
  now?: Date;
}

export interface Slot {
  startUtc: string; // ISO 8601
  endUtc: string; // ISO 8601
  label: string; // "HH:mm" in displayTz
  /** Interviewers that can take this slot (drives round-robin assignment). */
  interviewerIds: string[];
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.startUtc < b.endUtc && b.startUtc < a.endUtc;
}

/** Effective availability windows for one interviewer on one date. */
function windowsForDate(
  interviewer: InterviewerInput,
  isoDate: string
): AvailabilityWindow[] {
  const override = interviewer.dateOverrides?.find((o) => o.date === isoDate);
  if (override) {
    if (!override.available) return []; // day blocked off
    if (override.startTime && override.endTime) {
      return [
        {
          dayOfWeek: dayOfWeekInZone(isoDate, COMPANY_TZ),
          startTime: override.startTime,
          endTime: override.endTime,
        },
      ];
    }
    // available with no custom window -> fall through to weekly availability
  }
  const dow = dayOfWeekInZone(isoDate, COMPANY_TZ);
  return interviewer.availability.filter((w) => w.dayOfWeek === dow);
}

export function generateSlots(params: GenerateSlotsParams): Slot[] {
  const { eventType, interviewers, date } = params;
  const displayTz = params.displayTz || COMPANY_TZ;
  const now = params.now ?? new Date();
  const step = eventType.stepMin ?? 30;
  const durationMs = eventType.durationMin * 60_000;
  const bufBeforeMs = eventType.bufferBeforeMin * 60_000;
  const bufAfterMs = eventType.bufferAfterMin * 60_000;
  const minNoticeMs = eventType.minNoticeHours * 3_600_000;
  const earliestStart = new Date(now.getTime() + minNoticeMs);

  // Step 6 (booking window): drop dates outside [today, today + window].
  const todayInZone = DateTime.fromJSDate(now, { zone: "utc" })
    .setZone(COMPANY_TZ)
    .startOf("day");
  const targetDay = DateTime.fromISO(date, { zone: COMPANY_TZ }).startOf("day");
  const daysAhead = Math.floor(targetDay.diff(todayInZone, "days").days);
  if (daysAhead < 0 || daysAhead > eventType.bookingWindowDays) return [];

  // start -> set of interviewer ids that can take it
  const candidates = new Map<
    string,
    { startUtc: Date; endUtc: Date; interviewerIds: Set<string> }
  >();

  for (const interviewer of interviewers) {
    // Step 7 (maxPerDay): if already booked to the limit, skip entirely.
    if (eventType.maxPerDay != null) {
      const bookedThatDay = (interviewer.bookings ?? []).filter((b) => {
        const d = DateTime.fromJSDate(b.startUtc, { zone: "utc" })
          .setZone(COMPANY_TZ)
          .toISODate();
        return d === targetDay.toISODate();
      }).length;
      if (bookedThatDay >= eventType.maxPerDay) continue;
    }

    const windows = windowsForDate(interviewer, date);
    const busy: Interval[] = [
      ...(interviewer.busyIntervals ?? []),
      ...(interviewer.bookings ?? []),
    ];

    for (const w of windows) {
      const windowStart = wallClockToUtc(date, w.startTime, COMPANY_TZ);
      const windowEnd = wallClockToUtc(date, w.endTime, COMPANY_TZ);

      for (
        let s = windowStart.getTime();
        s + durationMs <= windowEnd.getTime();
        s += step * 60_000
      ) {
        const startUtc = new Date(s);
        const endUtc = new Date(s + durationMs);

        // Steps 4–5: drop slots colliding with busy ranges (incl. buffers).
        const occupied: Interval = {
          startUtc: new Date(s - bufBeforeMs),
          endUtc: new Date(s + durationMs + bufAfterMs),
        };
        if (busy.some((b) => overlaps(occupied, b))) continue;

        // Step 6: minimum notice.
        if (startUtc < earliestStart) continue;

        const key = startUtc.toISOString();
        const entry =
          candidates.get(key) ??
          { startUtc, endUtc, interviewerIds: new Set<string>() };
        entry.interviewerIds.add(interviewer.id);
        candidates.set(key, entry);
      }
    }
  }

  // Step 8: assignment strategy.
  const slots: Slot[] = [];
  for (const entry of candidates.values()) {
    if (
      eventType.assignment === "collective" &&
      entry.interviewerIds.size !== interviewers.length
    ) {
      continue; // every interviewer must be free
    }
    slots.push({
      startUtc: entry.startUtc.toISOString(),
      endUtc: entry.endUtc.toISOString(),
      label: utcToLabel(entry.startUtc, displayTz),
      interviewerIds: [...entry.interviewerIds],
    });
  }

  slots.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return slots;
}
