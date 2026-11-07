
import "server-only";

import { sendInvitationEmail } from "@/lib/email/send-invitation-email";
import type { InvitationEmailProps } from "@/emails/invitation-email";

import {
  markInvitationEmailFailed,
  markInvitationEmailSent,
} from "./update-invitation-email";

type DeliverClaimedInvitationEmailInput = {
  invitationId: string;
  email: string;
  role: InvitationEmailProps["role"];
  token: string;
  attemptStartedAt: Date;
  inviterName: string;
  organizationName: string;
};

export type ClaimedInvitationEmailResult =
  | {
      status: "failed";
      reason: "configuration" | "provider" | "unexpected";
    }
  | {
      status: "sent";
      emailId: string;
      recorded: boolean;
    };

export async function deliverClaimedInvitationEmail(
  input: DeliverClaimedInvitationEmailInput,
): Promise<ClaimedInvitationEmailResult> {
  const delivery = await sendInvitationEmail({
    email: input.email,
    inviterName: input.inviterName,
    organizationName: input.organizationName,
    role: input.role,
    token: input.token,
  });

  if (!delivery.success) {
    await markInvitationEmailFailed({
      invitationId: input.invitationId,
      attemptStartedAt: input.attemptStartedAt,
    });

    return {
      status: "failed",
      reason: delivery.reason,
    };
  }

  const recorded = await markInvitationEmailSent({
    invitationId: input.invitationId,
    attemptStartedAt: input.attemptStartedAt,
    emailProviderId: delivery.emailId,
  });

  return {
    status: "sent",
    emailId: delivery.emailId,
    recorded,
  };
}
