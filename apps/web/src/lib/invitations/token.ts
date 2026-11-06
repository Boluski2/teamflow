import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Generates a cryptographically secure, URL-safe invitation token.
 */
export function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hashes an invitation token before it is stored in the database.
 * The original token must never be persisted.
 */
export function hashInvitationToken(token: string): string {
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error("Invalid invitation token format");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Default invitation lifetime: seven days.
 */
export const INVITATION_EXPIRY_DAYS = 7;

export function getInvitationExpiryDate(
  now: Date = new Date(),
): Date {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + INVITATION_EXPIRY_DAYS);

  return expiresAt;
}
