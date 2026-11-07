import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));


const mocks = vi.hoisted(() => ({
  claimInvitationResend: vi.fn(),
  deliverClaimedInvitationEmail: vi.fn(),
}));

vi.mock("./claim-invitation-resend", () => ({
  claimInvitationResend: mocks.claimInvitationResend,
}));

vi.mock("./deliver-claimed-invitation-email", () => ({
  deliverClaimedInvitationEmail: mocks.deliverClaimedInvitationEmail,
}));

import { resendInvitationEmail } from "./resend-invitation-email";

const input = {
  invitationId: "invitation-123",
  organizationId: "organization-123",
  inviterName: "Bolu",
  organizationName: "TeamFlow Workspace",
};

const claimedInvitation = {
  status: "claimed" as const,
  invitation: {
    id: input.invitationId,
    email: "member@example.com",
    role: "member" as const,
  },
  token: "new-secure-invitation-token",
  attemptStartedAt: new Date("2026-11-07T08:00:00.000Z"),
};

describe("resendInvitationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims and delivers an invitation using the rotated token", async () => {
    mocks.claimInvitationResend.mockResolvedValue(claimedInvitation);

    mocks.deliverClaimedInvitationEmail.mockResolvedValue({
      status: "sent",
      emailId: "resend-email-123",
      recorded: true,
    });

    const result = await resendInvitationEmail(input);

    expect(mocks.claimInvitationResend).toHaveBeenCalledWith({
      invitationId: input.invitationId,
      organizationId: input.organizationId,
    });

    expect(mocks.deliverClaimedInvitationEmail).toHaveBeenCalledWith({
      invitationId: input.invitationId,
      email: "member@example.com",
      role: "member",
      token: claimedInvitation.token,
      attemptStartedAt: claimedInvitation.attemptStartedAt,
      inviterName: input.inviterName,
      organizationName: input.organizationName,
    });

    expect(result).toEqual({
      status: "sent",
      emailId: "resend-email-123",
      recorded: true,
    });
  });

  it("returns delivery failure without exposing the token", async () => {
    mocks.claimInvitationResend.mockResolvedValue(claimedInvitation);

    mocks.deliverClaimedInvitationEmail.mockResolvedValue({
      status: "failed",
      reason: "provider",
    });

    const result = await resendInvitationEmail(input);

    expect(result).toEqual({
      status: "failed",
      reason: "provider",
    });

    expect(result).not.toHaveProperty("token");
  });

  it.each([
    ["not_found", { status: "not_found" }],
    ["already_accepted", { status: "already_accepted" }],
    ["sending", { status: "sending" }],
    ["not_claimed", { status: "not_claimed" }],
  ] as const)(
    "does not send an email when claiming returns %s",
    async (_description, claimResult) => {
      mocks.claimInvitationResend.mockResolvedValue(claimResult);

      const result = await resendInvitationEmail(input);

      expect(result).toEqual(claimResult);
      expect(mocks.deliverClaimedInvitationEmail).not.toHaveBeenCalled();
    },
  );
});