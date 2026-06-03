import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMPANY_TZ } from "@/lib/time";
import {
  generateSlots,
  type AssignmentStrategy,
  type InterviewerInput,
} from "@/lib/availability";

// Public: GET /api/event-types/:slug/availability?date=YYYY-MM-DD&tz=Asia/Taipei
// Returns bookable slots for the day (SPEC §3.5 / §3.6).
//
// M1: no Google free/busy yet — slots come purely from weekly Availability +
// DateOverride, minus any existing confirmed bookings in the DB.
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const tz = searchParams.get("tz") || COMPANY_TZ;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date query param required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const eventType = await prisma.eventType.findUnique({
    where: { slug: params.slug },
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

  if (!eventType || !eventType.active) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const interviewerIds = eventType.interviewers.map((ei) => ei.interviewerId);

  // Confirmed bookings for these interviewers (overlap + maxPerDay checks).
  const bookings = interviewerIds.length
    ? await prisma.booking.findMany({
        where: {
          interviewerId: { in: interviewerIds },
          status: "confirmed",
        },
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
  }));

  const slots = generateSlots({
    eventType: {
      durationMin: eventType.durationMin,
      bufferBeforeMin: eventType.bufferBeforeMin,
      bufferAfterMin: eventType.bufferAfterMin,
      minNoticeHours: eventType.minNoticeHours,
      maxPerDay: eventType.maxPerDay,
      bookingWindowDays: eventType.bookingWindowDays,
      assignment: eventType.assignment as AssignmentStrategy,
    },
    interviewers,
    date,
    displayTz: tz,
  });

  return NextResponse.json({ date, tz, slots });
}
