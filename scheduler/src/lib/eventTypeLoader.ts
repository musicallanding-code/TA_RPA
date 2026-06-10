import { prisma } from "@/lib/prisma";
import type {
  AssignmentStrategy,
  EventTypeConfig,
  Interval,
  InterviewerInput,
} from "@/lib/availability";
import { getBusyByInterviewer } from "@/lib/freebusy";

/**
 * Loads everything the slot engine needs for one event type:
 * its config, the assigned interviewers (with weekly availability +
 * date overrides) and their confirmed bookings. Shared by the public
 * `availability` and `availability-days` endpoints so the two never drift.
 *
 * When `range` is provided and Google is enabled, each interviewer's real
 * calendar free/busy for that window (M2, SPEC §3.6 steps 4–5) is attached as
 * `busyIntervals`; otherwise this behaves exactly like M1.
 *
 * Returns null when the event type is missing or inactive.
 */
export async function loadEventTypeForSlots(
  slug: string,
  range?: { startUtc: Date; endUtc: Date }
): Promise<{
  config: EventTypeConfig;
  interviewers: InterviewerInput[];
} | null> {
  const eventType = await prisma.eventType.findUnique({
    where: { slug },
    include: {
      interviewers: {
        include: {
          interviewer: {
            include: { availability: true, dateOverrides: true },
          },
        },
      },
    },
  });

  if (!eventType || !eventType.active) return null;

  const interviewerIds = eventType.interviewers.map((ei) => ei.interviewerId);

  const bookings = interviewerIds.length
    ? await prisma.booking.findMany({
        where: { interviewerId: { in: interviewerIds }, status: "confirmed" },
        select: { interviewerId: true, startUtc: true, endUtc: true },
      })
    : [];

  const bookingsByInterviewer = new Map<
    string,
    { startUtc: Date; endUtc: Date }[]
  >();
  for (const b of bookings) {
    const arr = bookingsByInterviewer.get(b.interviewerId) ?? [];
    arr.push({ startUtc: b.startUtc, endUtc: b.endUtc });
    bookingsByInterviewer.set(b.interviewerId, arr);
  }

  // M2: real Google free/busy for the requested window (no-op without `range`
  // or when Google isn't configured / the interviewer isn't connected).
  let busyByInterviewer = new Map<string, Interval[]>();
  if (range) {
    busyByInterviewer = await getBusyByInterviewer(
      eventType.interviewers.map((ei) => ({
        id: ei.interviewer.id,
        email: ei.interviewer.email,
        googleAccountId: ei.interviewer.googleAccountId,
      })),
      range.startUtc,
      range.endUtc
    );
  }

  const interviewers: InterviewerInput[] = eventType.interviewers.map((ei) => ({
    id: ei.interviewer.id,
    name: ei.interviewer.name,
    availability: ei.interviewer.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
    dateOverrides: ei.interviewer.dateOverrides.map((o) => ({
      date: o.date,
      available: o.available,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
    bookings: bookingsByInterviewer.get(ei.interviewer.id) ?? [],
    busyIntervals: busyByInterviewer.get(ei.interviewer.id) ?? [],
  }));

  const config: EventTypeConfig = {
    durationMin: eventType.durationMin,
    bufferBeforeMin: eventType.bufferBeforeMin,
    bufferAfterMin: eventType.bufferAfterMin,
    minNoticeHours: eventType.minNoticeHours,
    maxPerDay: eventType.maxPerDay,
    bookingWindowDays: eventType.bookingWindowDays,
    assignment: eventType.assignment as AssignmentStrategy,
  };

  return { config, interviewers };
}
