
import { describe, expect, it } from "vitest";

import {
  generateInvitationToken,
  getInvitationExpiryDate,
  hashInvitationToken,
  INVITATION_EXPIRY_DAYS,
} from "./token";

describe("invitation token utilities", () => {
  it("generates URL-safe tokens with the expected length", () => {
    const token = generateInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates a different token on each call", () => {
    expect(generateInvitationToken()).not.toBe(
      generateInvitationToken(),
    );
  });

  it("produces a deterministic SHA-256 hash", () => {
    const token = generateInvitationToken();

    expect(hashInvitationToken(token)).toBe(
      hashInvitationToken(token),
    );
  });

  it("does not return the original token as its hash", () => {
    const token = generateInvitationToken();

    expect(hashInvitationToken(token)).not.toBe(token);
    expect(hashInvitationToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects malformed tokens", () => {
    expect(() => hashInvitationToken("invalid-token")).toThrow(
      "Invalid invitation token format",
    );
  });

  it("sets invitation expiry seven days after creation", () => {
    const now = new Date("2026-11-06T12:00:00.000Z");
    const expiry = getInvitationExpiryDate(now);

    expect(INVITATION_EXPIRY_DAYS).toBe(7);
    expect(expiry.toISOString()).toBe("2026-11-13T12:00:00.000Z");
  });

  it("does not mutate the supplied date", () => {
    const now = new Date("2026-11-06T12:00:00.000Z");

    getInvitationExpiryDate(now);

    expect(now.toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });
});
