import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { COMPANY_TZ } from "@/lib/time";
import { generateSlots } from "@/lib/availability";
import { loadEventTypeForSlots } from "@/lib/eventTypeLoader";

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

  // Window covering the requested calendar day (in company tz) for free/busy.
  const dayStart = DateTime.fromISO(date, { zone: COMPANY_TZ }).startOf("day");
  const range = {
    startUtc: dayStart.toUTC().toJSDate(),
    endUtc: dayStart.plus({ days: 1 }).toUTC().toJSDate(),
  };

  const loaded = await loadEventTypeForSlots(params.slug, range);
  if (!loaded) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const slots = generateSlots({
    eventType: loaded.config,
    interviewers: loaded.interviewers,
    date,
    displayTz: tz,
  });

  return NextResponse.json({ date, tz, slots });
}
