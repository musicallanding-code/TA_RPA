import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { hasEncKey } from "./crypto";

/**
 * Google OAuth2 + config (SPEC §3.3 / §3.10).
 *
 * All Google features are GATED behind `googleEnabled()`. When the env vars are
 * absent the app keeps working exactly like M1 (no free/busy, slots come from
 * weekly availability only), so the project runs with zero Google setup.
 */

const DEFAULT_SCOPES = [
  // free/busy needs calendar.readonly or the dedicated freebusy scope
  "https://www.googleapis.com/auth/calendar.freebusy",
  // requested now so M3 (creating events) won't need a second consent
  "https://www.googleapis.com/auth/calendar.events",
  // to identify which interviewer connected
  "https://www.googleapis.com/auth/userinfo.email",
];

export function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      "http://localhost:3000/api/auth/google/callback",
    scopes: (process.env.GOOGLE_SCOPES || DEFAULT_SCOPES.join(" "))
      .split(/\s+/)
      .filter(Boolean),
  };
}

/** True only when OAuth client + redirect + a valid encryption key are all set. */
export function googleEnabled(): boolean {
  const c = googleConfig();
  return Boolean(c.clientId && c.clientSecret && c.redirectUri && hasEncKey());
}

export function getOAuthClient(): OAuth2Client {
  const c = googleConfig();
  return new OAuth2Client(c.clientId, c.clientSecret, c.redirectUri);
}

export function getAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // we need a refresh token
    prompt: "consent", // force refresh_token to be returned every time
    include_granted_scopes: true,
    scope: googleConfig().scopes,
    state,
  });
}

export interface ExchangedTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: number | null; // epoch ms
}

export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return {
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
  };
}

/**
 * Use a refresh token to get a fresh access token. Returns the new access token
 * and its expiry. (Google may also rotate the refresh token; we surface it.)
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiryDate: number | null;
  refreshToken: string | null;
}> {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Google did not return an access token on refresh");
  }
  return {
    accessToken: credentials.access_token,
    expiryDate: credentials.expiry_date ?? null,
    refreshToken: credentials.refresh_token ?? null,
  };
}

/** Fetch the email of the account that just authorized. */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

// --- Signed OAuth state (prevents tampering with the interviewer id) ---------

function stateSecret(): string {
  // Reuse the encryption key material as the HMAC secret (already required).
  return process.env.GOOGLE_TOKEN_ENC_KEY || "";
}

export function signState(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto
    .createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState<T = Record<string, unknown>>(state: string): T | null {
  const [body, mac] = state.split(".");
  if (!body || !mac) return null;
  const expected = crypto
    .createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");
  // constant-time compare
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
