import "server-only";

import { sendInvitationEmail } from "@/lib/email/send-invitation-email";

import { claimInvitationEmail } from "./claim-invitation-email";
import {
  markInvitationEmailFailed,
  markInvitationEmailSent,
} from "./update-invitation-email";

type DeliverInvitationEmailInput = {
  invitationId: string;
  token: string;
  inviterName: string;
  organizationName: string;
};

export type DeliverInvitationEmailResult =
  | {
      status: "not_claimed";
    }
  | {
      status: "failed";
      reason: "configuration" | "provider" | "unexpected";
    }
  | {
      status: "sent";
      emailId: string;
      recorded: boolean;
    };

export async function deliverInvitationEmail(
  input: DeliverInvitationEmailInput,
): Promise<DeliverInvitationEmailResult> {
  const claim = await claimInvitationEmail({
    invitationId: input.invitationId,
  });

  if (!claim) {
    return { status: "not_claimed" };
  }

  const { invitation, attemptStartedAt } = claim;

  const delivery = await sendInvitationEmail({
    email: invitation.email,
    inviterName: input.inviterName,
    organizationName: input.organizationName,
    role: invitation.role,
    token: input.token,
  });

  if (!delivery.success) {
    await markInvitationEmailFailed({
      invitationId: invitation.id,
      attemptStartedAt,
    });

    return {
      status: "failed",
      reason: delivery.reason,
    };
  }

  const recorded = await markInvitationEmailSent({
    invitationId: invitation.id,
    attemptStartedAt,
    emailProviderId: delivery.emailId,
  });

  return {
    status: "sent",
    emailId: delivery.emailId,
    recorded,
  };
}