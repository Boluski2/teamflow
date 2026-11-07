
import "server-only";

import { claimInvitationEmail } from "./claim-invitation-email";
import {
  deliverClaimedInvitationEmail,
  type ClaimedInvitationEmailResult,
} from "./deliver-claimed-invitation-email";

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
  | ClaimedInvitationEmailResult;

export async function deliverInvitationEmail(
  input: DeliverInvitationEmailInput,
): Promise<DeliverInvitationEmailResult> {
  const claim = await claimInvitationEmail({
    invitationId: input.invitationId,
  });

  if (!claim) {
    return { status: "not_claimed" };
  }

  return deliverClaimedInvitationEmail({
    invitationId: claim.invitation.id,
    email: claim.invitation.email,
    role: claim.invitation.role,
    token: input.token,
    attemptStartedAt: claim.attemptStartedAt,
    inviterName: input.inviterName,
    organizationName: input.organizationName,
  });
}
