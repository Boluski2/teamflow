import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { invitations } from "@/lib/db/schema";

type UpdateInvitationEmailInput = {
  invitationId: string;
  attemptStartedAt: Date;
};

export async function markInvitationEmailSent(
  input: UpdateInvitationEmailInput & {
    emailProviderId: string;
    sentAt?: Date;
  },
) {
  const [updated] = await db
    .update(invitations)
    .set({
      emailStatus: "sent",
      emailSentAt: input.sentAt ?? new Date(),
      emailProviderId: input.emailProviderId,
    })
    .where(
      and(
        eq(invitations.id, input.invitationId),
        eq(invitations.emailStatus, "sending"),
        eq(invitations.emailLastAttemptAt, input.attemptStartedAt),
      ),
    )
    .returning({ id: invitations.id });

  return Boolean(updated);
}

export async function markInvitationEmailFailed(
  input: UpdateInvitationEmailInput,
) {
  const [updated] = await db
    .update(invitations)
    .set({
      emailStatus: "failed",
      emailSentAt: null,
      emailProviderId: null,
    })
    .where(
      and(
        eq(invitations.id, input.invitationId),
        eq(invitations.emailStatus, "sending"),
        eq(invitations.emailLastAttemptAt, input.attemptStartedAt),
      ),
    )
    .returning({ id: invitations.id });

  return Boolean(updated);
}