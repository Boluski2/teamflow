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
import { claimInvitationEmail } from "./claim-invitation-email";

describe("claimInvitationEmail", () => {
  const now = new Date("2026-11-07T12:00:00.000Z");

  const claimedInvitation = {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    email: "member@example.com",
    role: "member" as const,
    invitedById: "33333333-3333-4333-8333-333333333333",
    emailAttemptCount: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.returning.mockResolvedValue([claimedInvitation]);
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
  });

  it("claims an eligible invitation", async () => {
    const result = await claimInvitationEmail({
      invitationId: claimedInvitation.id,
      now,
    });

    expect(mocks.update).toHaveBeenCalledWith(invitations);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        emailStatus: "sending",
        emailAttemptCount: expect.any(Object),
        emailLastAttemptAt: now,
        emailSentAt: null,
        emailProviderId: null,
      }),
    );

    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.returning).toHaveBeenCalledOnce();

    expect(result).toEqual({
      invitation: claimedInvitation,
      attemptStartedAt: now,
    });
  });

  it("returns null when another request has already claimed the invitation", async () => {
    mocks.returning.mockResolvedValue([]);

    const result = await claimInvitationEmail({
      invitationId: claimedInvitation.id,
      now,
    });

    expect(result).toBeNull();
  });

  it("uses the supplied timestamp for the delivery attempt", async () => {
    await claimInvitationEmail({
      invitationId: claimedInvitation.id,
      now,
    });

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        emailLastAttemptAt: now,
      }),
    );
  });

  it("returns the incremented attempt count from the database", async () => {
    mocks.returning.mockResolvedValue([
      {
        ...claimedInvitation,
        emailAttemptCount: 3,
      },
    ]);

    const result = await claimInvitationEmail({
      invitationId: claimedInvitation.id,
      now,
    });

    expect(result?.invitation.emailAttemptCount).toBe(3);
  });
});
