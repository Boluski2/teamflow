
import "server-only";

import { claimInvitationResend } from "./claim-invitation-resend";
import { deliverClaimedInvitationEmail } from "./deliver-claimed-invitation-email";

type ResendInvitationEmailInput = {
  invitationId: string;
  organizationId: string;
  inviterName: string;
  organizationName: string;
};

type ResendInvitationEmailResult =
  | { status: "not_found" }
  | { status: "already_accepted" }
  | { status: "sending" }
  | { status: "not_claimed" }
  | {
      status: "failed";
      reason: "configuration" | "provider" | "unexpected";
    }
  | {
      status: "sent";
      emailId: string;
      recorded: boolean;
    };

export async function resendInvitationEmail(
  input: ResendInvitationEmailInput,
): Promise<ResendInvitationEmailResult> {
  const claim = await claimInvitationResend({
    invitationId: input.invitationId,
    organizationId: input.organizationId,
  });

  if (claim.status !== "claimed") {
    return claim;
  }

  const delivery = await deliverClaimedInvitationEmail({
    invitationId: claim.invitation.id,
    email: claim.invitation.email,
    role: claim.invitation.role,
    token: claim.token,
    attemptStartedAt: claim.attemptStartedAt,
    inviterName: input.inviterName,
    organizationName: input.organizationName,
  });

  if (delivery.status === "failed") {
    return {
      status: "failed",
      reason: delivery.reason,
    };
  }

  return {
    status: "sent",
    emailId: delivery.emailId,
    recorded: delivery.recorded,
  };
}
