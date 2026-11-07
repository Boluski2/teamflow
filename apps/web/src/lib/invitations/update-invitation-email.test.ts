import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));

  return { returning, where, set, update };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    update: mocks.update,
  },
}));

import { invitations } from "@/lib/db/schema";
import {
  markInvitationEmailFailed,
  markInvitationEmailSent,
} from "./update-invitation-email";

describe("invitation email delivery updates", () => {
  const input = {
    invitationId: "11111111-1111-4111-8111-111111111111",
    attemptStartedAt: new Date("2026-11-07T12:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.returning.mockResolvedValue([{ id: input.invitationId }]);
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
  });

  it("marks a successful delivery as sent", async () => {
    const sentAt = new Date("2026-11-07T12:00:10.000Z");

    const result = await markInvitationEmailSent({
      ...input,
      emailProviderId: "resend-email-123",
      sentAt,
    });

    expect(mocks.update).toHaveBeenCalledWith(invitations);
    expect(mocks.set).toHaveBeenCalledWith({
      emailStatus: "sent",
      emailSentAt: sentAt,
      emailProviderId: "resend-email-123",
    });
    expect(mocks.where).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("marks a failed delivery as failed", async () => {
    const result = await markInvitationEmailFailed(input);

    expect(mocks.set).toHaveBeenCalledWith({
      emailStatus: "failed",
      emailSentAt: null,
      emailProviderId: null,
    });
    expect(result).toBe(true);
  });

  it("returns false when the attempt no longer owns the invitation", async () => {
    mocks.returning.mockResolvedValue([]);

    const result = await markInvitationEmailSent({
      ...input,
      emailProviderId: "resend-email-123",
    });

    expect(result).toBe(false);
  });

  it("returns false when a failed attempt is no longer current", async () => {
    mocks.returning.mockResolvedValue([]);

    const result = await markInvitationEmailFailed(input);

    expect(result).toBe(false);
  });
});