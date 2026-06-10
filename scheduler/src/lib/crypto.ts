import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for secrets at rest (SPEC §3.10: OAuth refresh tokens
 * must be stored encrypted).
 *
 * Key comes from GOOGLE_TOKEN_ENC_KEY: a base64-encoded 32-byte key.
 * Generate one with:  openssl rand -base64 32
 *
 * Ciphertext format (base64):  iv(12) | authTag(16) | ciphertext
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!raw) {
    throw new Error(
      "GOOGLE_TOKEN_ENC_KEY is not set — required to encrypt/decrypt Google tokens"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `GOOGLE_TOKEN_ENC_KEY must decode to 32 bytes (got ${key.length}); use: openssl rand -base64 32`
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** True when a 32-byte key is configured (used to gate Google features). */
export function hasEncKey(): boolean {
  const raw = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!raw) return false;
  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}
