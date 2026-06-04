import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { COMPANY_TZ } from "@/lib/time";
import { generateSlots } from "@/lib/availability";
import { loadEventTypeForSlots } from "@/lib/eventTypeLoader";

// Public: GET /api/event-types/:slug/availability-days?month=YYYY-MM&tz=...
// Returns the list of dates in that month that have >= 1 bookable slot, so the
// month calendar on the booking page can enable only the days worth clicking.
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const tz = searchParams.get("tz") || COMPANY_TZ;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month query param required (YYYY-MM)" },
      { status: 400 }
    );
  }

  const loaded = await loadEventTypeForSlots(params.slug);
  if (!loaded) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const start = DateTime.fromISO(`${month}-01`, { zone: COMPANY_TZ });
  if (!start.isValid) {
    return NextResponse.json({ error: "invalid month" }, { status: 400 });
  }

  const days: string[] = [];
  const daysInMonth = start.daysInMonth ?? 31;
  for (let d = 0; d < daysInMonth; d++) {
    const date = start.plus({ days: d }).toISODate()!;
    const slots = generateSlots({
      eventType: loaded.config,
      interviewers: loaded.interviewers,
      date,
      displayTz: tz,
    });
    if (slots.length > 0) days.push(date);
  }

  return NextResponse.json({ month, tz, days });
}
