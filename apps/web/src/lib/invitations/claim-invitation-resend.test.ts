import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  const selectLimit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  return {
    returning,
    updateWhere,
    set,
    update,
    selectLimit,
    selectWhere,
    from,
    select,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    update: mocks.update,
    select: mocks.select,
  },
}));

import { invitations } from "@/lib/db/schema";
import { hashInvitationToken } from "./token";
import { claimInvitationResend } from "./claim-invitation-resend";

describe("claimInvitationResend", () => {
  const now = new Date("2026-11-07T12:00:00.000Z");

  const invitationId = "11111111-1111-4111-8111-111111111111";
  const organizationId = "22222222-2222-4222-8222-222222222222";

  const claimedInvitation = {
    id: invitationId,
    email: "member@example.com",
    role: "member" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.returning.mockResolvedValue([claimedInvitation]);
    mocks.selectLimit.mockResolvedValue([]);

    mocks.updateWhere.mockReturnValue({
      returning: mocks.returning,
    });

    mocks.set.mockReturnValue({
      where: mocks.updateWhere,
    });

    mocks.update.mockReturnValue({
      set: mocks.set,
    });

    mocks.selectWhere.mockReturnValue({
      limit: mocks.selectLimit,
    });

    mocks.from.mockReturnValue({
      where: mocks.selectWhere,
    });

    mocks.select.mockReturnValue({
      from: mocks.from,
    });
  });

  it("claims an invitation and rotates its token", async () => {
    const result = await claimInvitationResend({
      invitationId,
      organizationId,
      now,
    });

    expect(mocks.update).toHaveBeenCalledWith(invitations);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.any(String),
        expiresAt: new Date("2026-11-14T12:00:00.000Z"),
        emailStatus: "sending",
        emailAttemptCount: expect.any(Object),
        emailLastAttemptAt: now,
        emailSentAt: null,
        emailProviderId: null,
      }),
    );

    expect(result.status).toBe("claimed");

    if (result.status !== "claimed") {
      throw new Error("Expected invitation to be claimed");
    }

    expect(result.invitation).toEqual(claimedInvitation);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.attemptStartedAt).toEqual(now);

    const setCalls = mocks.set.mock.calls as unknown as Array<
  [Record<string, unknown>]
>;

const updateValues = setCalls[0]?.[0];

if (!updateValues) {
  throw new Error("Invitation update values were not captured");
}

    expect(updateValues.tokenHash).toBe(
      hashInvitationToken(result.token),
    );

    expect(updateValues.tokenHash).not.toBe(result.token);
  });

  it("returns not_found when the invitation does not exist", async () => {
    mocks.returning.mockResolvedValue([]);
    mocks.selectLimit.mockResolvedValue([]);

    const result = await claimInvitationResend({
      invitationId,
      organizationId,
      now,
    });

    expect(result).toEqual({
      status: "not_found",
    });
  });

  it("does not resend an accepted invitation", async () => {
    mocks.returning.mockResolvedValue([]);

    mocks.selectLimit.mockResolvedValue([
      {
        acceptedAt: new Date("2026-11-06T10:00:00.000Z"),
        emailStatus: "sent",
        emailLastAttemptAt: now,
      },
    ]);

    const result = await claimInvitationResend({
      invitationId,
      organizationId,
      now,
    });

    expect(result).toEqual({
      status: "already_accepted",
    });
  });

  it("does not claim an invitation with an active sending attempt", async () => {
    mocks.returning.mockResolvedValue([]);

    mocks.selectLimit.mockResolvedValue([
      {
        acceptedAt: null,
        emailStatus: "sending",
        emailLastAttemptAt: new Date(now.getTime() - 60_000),
      },
    ]);

    const result = await claimInvitationResend({
      invitationId,
      organizationId,
      now,
    });

    expect(result).toEqual({
      status: "sending",
    });
  });

  it("allows recovery of a stale sending attempt", async () => {
    const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);

    const result = await claimInvitationResend({
      invitationId,
      organizationId,
      now,
    });

    expect(result.status).toBe("claimed");

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        emailStatus: "sending",
        emailLastAttemptAt: now,
      }),
    );

    expect(mocks.updateWhere).toHaveBeenCalledOnce();

  const whereCalls = mocks.updateWhere.mock.calls as unknown as Array<
  [SQL<unknown>]
>;

const whereClause = whereCalls[0]?.[0];

if (!whereClause) {
  throw new Error("Invitation update condition was not captured");
}

const query = new PgDialect().sqlToQuery(whereClause);

    expect(query.params).toContain(staleBefore.toISOString());
  });

  it("renews an expired invitation with a seven-day expiry", async () => {
    await claimInvitationResend({
      invitationId,
      organizationId,
      now,
    });

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date("2026-11-14T12:00:00.000Z"),
      }),
    );
  });

  it("does not claim an invitation outside the requested organization", async () => {
    mocks.returning.mockResolvedValue([]);
    mocks.selectLimit.mockResolvedValue([]);

    await claimInvitationResend({
      invitationId,
      organizationId,
      now,
    });

    expect(mocks.updateWhere).toHaveBeenCalledOnce();
  });
});
