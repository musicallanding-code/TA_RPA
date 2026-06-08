import { prisma } from "./prisma";
import { decryptSecret, encryptSecret } from "./crypto";
import { googleEnabled, refreshAccessToken } from "./google";
import type { Interval } from "./availability";

/**
 * Google Calendar free/busy integration (SPEC §3.6 steps 4–5).
 *
 * `parseFreeBusy` is pure and unit-tested. `getBusyByInterviewer` does the live
 * work: refresh the access token if needed, call the free/busy REST endpoint,
 * and return busy intervals keyed by interviewer id. Any failure degrades
 * gracefully to "no busy info" so the booking page never hard-fails.
 */

interface FreeBusyResponse {
  calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
}

/** Parse a Google free/busy API response for one calendar into intervals. */
export function parseFreeBusy(
  json: FreeBusyResponse,
  calendarId: string
): Interval[] {
  const busy = json.calendars?.[calendarId]?.busy ?? [];
  return busy.map((b) => ({
    startUtc: new Date(b.start),
    endUtc: new Date(b.end),
  }));
}

/** Ensure we have a non-expired access token, refreshing + persisting if needed. */
async function getValidAccessToken(credentialId: string): Promise<string | null> {
  const cred = await prisma.googleCredential.findUnique({
    where: { id: credentialId },
  });
  if (!cred || !cred.refreshToken) return null;

  const notExpired =
    cred.accessToken &&
    cred.expiry &&
    cred.expiry.getTime() > Date.now() + 60_000; // 60s safety margin
  if (notExpired) return cred.accessToken;

  try {
    const refreshToken = decryptSecret(cred.refreshToken);
    const refreshed = await refreshAccessToken(refreshToken);
    await prisma.googleCredential.update({
      where: { id: cred.id },
      data: {
        accessToken: refreshed.accessToken,
        expiry: refreshed.expiryDate ? new Date(refreshed.expiryDate) : null,
        // Google may rotate the refresh token; persist the new one encrypted.
        refreshToken: refreshed.refreshToken
          ? encryptSecret(refreshed.refreshToken)
          : cred.refreshToken,
      },
    });
    return refreshed.accessToken;
  } catch (err) {
    console.error(`free/busy: token refresh failed for ${credentialId}`, err);
    return null;
  }
}

async function queryFreeBusy(
  accessToken: string,
  calendarId: string,
  startUtc: Date,
  endUtc: Date
): Promise<Interval[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: startUtc.toISOString(),
      timeMax: endUtc.toISOString(),
      items: [{ id: calendarId }],
    }),
  });
  if (!res.ok) {
    console.error(`free/busy query failed (${res.status}) for ${calendarId}`);
    return [];
  }
  return parseFreeBusy((await res.json()) as FreeBusyResponse, calendarId);
}

export interface FreeBusyInterviewer {
  id: string;
  email: string;
  googleAccountId: string | null;
}

/**
 * Returns busy intervals per interviewer id over [startUtc, endUtc].
 * Interviewers without a connected Google account (or when Google is disabled)
 * simply get no busy intervals — identical to M1 behaviour.
 */
export async function getBusyByInterviewer(
  interviewers: FreeBusyInterviewer[],
  startUtc: Date,
  endUtc: Date
): Promise<Map<string, Interval[]>> {
  const result = new Map<string, Interval[]>();
  if (!googleEnabled()) return result;

  await Promise.all(
    interviewers.map(async (iv) => {
      if (!iv.googleAccountId) return;
      const accessToken = await getValidAccessToken(iv.googleAccountId);
      if (!accessToken) return;
      const intervals = await queryFreeBusy(
        accessToken,
        iv.email, // primary calendar id == account email
        startUtc,
        endUtc
      );
      if (intervals.length) result.set(iv.id, intervals);
    })
  );

  return result;
}
