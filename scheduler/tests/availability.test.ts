import { describe, expect, it } from "vitest";
import {
  generateSlots,
  type EventTypeConfig,
  type InterviewerInput,
} from "@/lib/availability";

// All availability windows are interpreted in COMPANY_TZ (Asia/Taipei).
// 2026-06-08 is a Monday (dayOfWeek = 1). 10:00 Taipei == 02:00 UTC.
const MONDAY = "2026-06-08";
const TUESDAY = "2026-06-09";
const NOW = new Date("2026-06-01T00:00:00Z"); // 7 days before, deterministic

const baseEventType: EventTypeConfig = {
  durationMin: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeHours: 12,
  maxPerDay: null,
  bookingWindowDays: 30,
  assignment: "single",
  stepMin: 30,
};

function interviewer(
  overrides: Partial<InterviewerInput> = {}
): InterviewerInput {
  return {
    id: "iv1",
    name: "黃琬心",
    availability: [{ dayOfWeek: 1, startTime: "10:00", endTime: "12:00" }],
    ...overrides,
  };
}

describe("generateSlots (M1 — no Google free/busy)", () => {
  it("slices a weekly window into duration-sized slots stepping by stepMin", () => {
    const slots = generateSlots({
      eventType: baseEventType,
      interviewers: [interviewer()],
      date: MONDAY,
      now: NOW,
    });
    // 10:00-12:00, 60-min slots, 30-min step => 10:00, 10:30, 11:00
    expect(slots.map((s) => s.label)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("stores UTC and labels in the requested display timezone", () => {
    const taipei = generateSlots({
      eventType: baseEventType,
      interviewers: [interviewer()],
      date: MONDAY,
      now: NOW,
    });
    expect(taipei[0].startUtc).toBe("2026-06-08T02:00:00.000Z");
    expect(taipei[0].label).toBe("10:00");

    const utc = generateSlots({
      eventType: baseEventType,
      interviewers: [interviewer()],
      date: MONDAY,
      displayTz: "UTC",
      now: NOW,
    });
    expect(utc[0].label).toBe("02:00");
  });

  it("returns nothing on a weekday with no availability window", () => {
    const slots = generateSlots({
      eventType: baseEventType,
      interviewers: [interviewer()],
      date: TUESDAY,
      now: NOW,
    });
    expect(slots).toEqual([]);
  });

  it("respects minNoticeHours", () => {
    // now is 5 hours before the first slot; minNotice 12h => first two filtered.
    const slots = generateSlots({
      eventType: baseEventType,
      interviewers: [interviewer()],
      date: MONDAY,
      now: new Date("2026-06-07T23:00:00Z"), // 07:00 Taipei same day-ish
    });
    // 10:00 Taipei = 02:00 UTC on 06-08; now+12h = 06-08T11:00Z = 19:00 Taipei
    // => all of today's slots are within notice window -> empty
    expect(slots).toEqual([]);
  });

  it("respects bookingWindowDays", () => {
    const far = generateSlots({
      eventType: baseEventType,
      interviewers: [interviewer()],
      date: "2026-12-07", // way beyond 30-day window
      now: NOW,
    });
    expect(far).toEqual([]);
  });

  it("DateOverride with available=false blocks the day", () => {
    const slots = generateSlots({
      eventType: baseEventType,
      interviewers: [
        interviewer({
          dateOverrides: [{ date: MONDAY, available: false }],
        }),
      ],
      date: MONDAY,
      now: NOW,
    });
    expect(slots).toEqual([]);
  });

  it("removes slots overlapping an existing booking (incl. its window)", () => {
    const slots = generateSlots({
      eventType: baseEventType,
      interviewers: [
        interviewer({
          bookings: [
            {
              startUtc: new Date("2026-06-08T02:00:00Z"), // 10:00 Taipei
              endUtc: new Date("2026-06-08T03:00:00Z"), // 11:00 Taipei
            },
          ],
        }),
      ],
      date: MONDAY,
      now: NOW,
    });
    // 10:00 & 10:30 overlap the booking; only 11:00 survives
    expect(slots.map((s) => s.label)).toEqual(["11:00"]);
  });

  it("collective assignment requires every interviewer to be free", () => {
    const iv1 = interviewer({ id: "iv1" });
    const iv2 = interviewer({
      id: "iv2",
      // iv2 only free 11:00-12:00 => intersection is just 11:00
      availability: [{ dayOfWeek: 1, startTime: "11:00", endTime: "12:00" }],
    });
    const slots = generateSlots({
      eventType: { ...baseEventType, assignment: "collective" },
      interviewers: [iv1, iv2],
      date: MONDAY,
      now: NOW,
    });
    expect(slots.map((s) => s.label)).toEqual(["11:00"]);
    expect(slots[0].interviewerIds.sort()).toEqual(["iv1", "iv2"]);
  });

  it("round_robin/single takes the union across interviewers", () => {
    const iv1 = interviewer({ id: "iv1" });
    const iv2 = interviewer({
      id: "iv2",
      availability: [{ dayOfWeek: 1, startTime: "11:00", endTime: "12:00" }],
    });
    const slots = generateSlots({
      eventType: { ...baseEventType, assignment: "round_robin" },
      interviewers: [iv1, iv2],
      date: MONDAY,
      now: NOW,
    });
    expect(slots.map((s) => s.label)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("maxPerDay drops an interviewer already at their daily limit", () => {
    const slots = generateSlots({
      eventType: { ...baseEventType, maxPerDay: 1 },
      interviewers: [
        interviewer({
          bookings: [
            {
              startUtc: new Date("2026-06-08T06:00:00Z"), // 14:00 Taipei, same day
              endUtc: new Date("2026-06-08T07:00:00Z"),
            },
          ],
        }),
      ],
      date: MONDAY,
      now: NOW,
    });
    expect(slots).toEqual([]);
  });
});
