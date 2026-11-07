import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));


const mocks = vi.hoisted(() => ({
  claimInvitationEmail: vi.fn(),
  sendInvitationEmail: vi.fn(),
  markInvitationEmailSent: vi.fn(),
  markInvitationEmailFailed: vi.fn(),
}));

vi.mock("./claim-invitation-email", () => ({
  claimInvitationEmail: mocks.claimInvitationEmail,
}));

vi.mock("@/lib/email/send-invitation-email", () => ({
  sendInvitationEmail: mocks.sendInvitationEmail,
}));

vi.mock("./update-invitation-email", () => ({
  markInvitationEmailSent: mocks.markInvitationEmailSent,
  markInvitationEmailFailed: mocks.markInvitationEmailFailed,
}));

import { deliverInvitationEmail } from "./deliver-invitation-email";

describe("deliverInvitationEmail", () => {
  const invitation = {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    email: "member@example.com",
    role: "member" as const,
    invitedById: "33333333-3333-4333-8333-333333333333",
    emailAttemptCount: 1,
  };

  const attemptStartedAt = new Date("2026-11-07T12:00:00.000Z");

  const input = {
    invitationId: invitation.id,
    token: "test-invitation-token",
    inviterName: "TeamFlow Owner",
    organizationName: "TeamFlow Workspace",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.claimInvitationEmail.mockResolvedValue({
      invitation,
      attemptStartedAt,
    });

    mocks.sendInvitationEmail.mockResolvedValue({
      success: true,
      emailId: "resend-email-123",
    });

    mocks.markInvitationEmailSent.mockResolvedValue(true);
    mocks.markInvitationEmailFailed.mockResolvedValue(true);
  });

  it("sends and records a successful invitation email", async () => {
    const result = await deliverInvitationEmail(input);

    expect(mocks.claimInvitationEmail).toHaveBeenCalledWith({
      invitationId: invitation.id,
    });

    expect(mocks.sendInvitationEmail).toHaveBeenCalledWith({
      email: invitation.email,
      inviterName: input.inviterName,
      organizationName: input.organizationName,
      role: invitation.role,
      token: input.token,
    });

    expect(mocks.markInvitationEmailSent).toHaveBeenCalledWith({
      invitationId: invitation.id,
      attemptStartedAt,
      emailProviderId: "resend-email-123",
    });

    expect(result).toEqual({
      status: "sent",
      emailId: "resend-email-123",
      recorded: true,
    });

    expect(mocks.markInvitationEmailFailed).not.toHaveBeenCalled();
  });

  it("does not send when the invitation cannot be claimed", async () => {
    mocks.claimInvitationEmail.mockResolvedValue(null);

    const result = await deliverInvitationEmail(input);

    expect(result).toEqual({ status: "not_claimed" });
    expect(mocks.sendInvitationEmail).not.toHaveBeenCalled();
    expect(mocks.markInvitationEmailSent).not.toHaveBeenCalled();
    expect(mocks.markInvitationEmailFailed).not.toHaveBeenCalled();
  });

  it("marks the invitation as failed when email delivery fails", async () => {
    mocks.sendInvitationEmail.mockResolvedValue({
      success: false,
      reason: "provider",
    });

    const result = await deliverInvitationEmail(input);

    expect(mocks.markInvitationEmailFailed).toHaveBeenCalledWith({
      invitationId: invitation.id,
      attemptStartedAt,
    });

    expect(result).toEqual({
      status: "failed",
      reason: "provider",
    });

    expect(mocks.markInvitationEmailSent).not.toHaveBeenCalled();
  });

  it("reports when a successful delivery could not be recorded", async () => {
    mocks.markInvitationEmailSent.mockResolvedValue(false);

    const result = await deliverInvitationEmail(input);

    expect(result).toEqual({
      status: "sent",
      emailId: "resend-email-123",
      recorded: false,
    });
  });

  it("does not mark delivery as failed when recording success throws", async () => {
    mocks.markInvitationEmailSent.mockRejectedValue(
      new Error("Database unavailable"),
    );

    await expect(deliverInvitationEmail(input)).rejects.toThrow(
      "Database unavailable",
    );

    expect(mocks.markInvitationEmailFailed).not.toHaveBeenCalled();
  });
});