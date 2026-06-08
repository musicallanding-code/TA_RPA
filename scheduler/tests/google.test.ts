import { beforeAll, describe, expect, it } from "vitest";

// A valid 32-byte base64 key, set before importing modules that read it.
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

beforeAll(() => {
  process.env.GOOGLE_TOKEN_ENC_KEY = TEST_KEY;
});

describe("crypto (refresh-token encryption)", () => {
  it("round-trips a secret", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const secret = "1//0g-some-google-refresh-token";
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encryptSecret } = await import("@/lib/crypto");
    expect(encryptSecret("abc")).not.toBe(encryptSecret("abc"));
  });

  it("fails to decrypt tampered ciphertext (GCM auth)", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const enc = encryptSecret("abc");
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff; // flip a ciphertext bit
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });
});

describe("signed OAuth state", () => {
  it("verifies a payload it signed", async () => {
    const { signState, verifyState } = await import("@/lib/google");
    const state = signState({ interviewerId: "iv1", ts: 123 });
    expect(verifyState(state)).toMatchObject({ interviewerId: "iv1" });
  });

  it("rejects a tampered state", async () => {
    const { signState, verifyState } = await import("@/lib/google");
    const state = signState({ interviewerId: "iv1" });
    const tampered = state.replace(/^[^.]+/, (b) =>
      Buffer.from(JSON.stringify({ interviewerId: "attacker" })).toString(
        "base64url"
      )
    );
    expect(verifyState(tampered)).toBeNull();
  });
});

describe("parseFreeBusy", () => {
  it("extracts busy intervals for the given calendar", async () => {
    const { parseFreeBusy } = await import("@/lib/freebusy");
    const intervals = parseFreeBusy(
      {
        calendars: {
          "iv@cmoney.com.tw": {
            busy: [
              { start: "2026-06-08T02:00:00Z", end: "2026-06-08T03:00:00Z" },
            ],
          },
        },
      },
      "iv@cmoney.com.tw"
    );
    expect(intervals).toHaveLength(1);
    expect(intervals[0].startUtc.toISOString()).toBe("2026-06-08T02:00:00.000Z");
  });

  it("returns [] when the calendar has no busy data", async () => {
    const { parseFreeBusy } = await import("@/lib/freebusy");
    expect(parseFreeBusy({ calendars: {} }, "x@y.com")).toEqual([]);
    expect(parseFreeBusy({}, "x@y.com")).toEqual([]);
  });
});

describe("busy intervals feed the slot engine", () => {
  it("removes slots overlapping a Google busy block", async () => {
    const { generateSlots } = await import("@/lib/availability");
    const { parseFreeBusy } = await import("@/lib/freebusy");
    const busyIntervals = parseFreeBusy(
      {
        calendars: {
          "iv@x.com": {
            // 10:00–11:00 Taipei == 02:00–03:00 UTC
            busy: [{ start: "2026-06-08T02:00:00Z", end: "2026-06-08T03:00:00Z" }],
          },
        },
      },
      "iv@x.com"
    );
    const slots = generateSlots({
      eventType: {
        durationMin: 60,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        minNoticeHours: 12,
        maxPerDay: null,
        bookingWindowDays: 30,
        assignment: "single",
        stepMin: 30,
      },
      interviewers: [
        {
          id: "iv1",
          name: "x",
          availability: [{ dayOfWeek: 1, startTime: "10:00", endTime: "12:00" }],
          busyIntervals,
        },
      ],
      date: "2026-06-08", // Monday
      now: new Date("2026-06-01T00:00:00Z"),
    });
    // 10:00 & 10:30 overlap busy; only 11:00 survives
    expect(slots.map((s) => s.label)).toEqual(["11:00"]);
  });
});
