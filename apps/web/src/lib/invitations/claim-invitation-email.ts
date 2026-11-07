import "server-only";

import {
  and,
  eq,
  gt,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { invitations } from "@/lib/db/schema";

export const INVITATION_EMAIL_STALE_AFTER_MS = 5 * 60 * 1000;

type ClaimInvitationEmailInput = {
  invitationId: string;
  now?: Date;
};

export async function claimInvitationEmail({
  invitationId,
  now = new Date(),
}: ClaimInvitationEmailInput) {
  const staleBefore = new Date(
    now.getTime() - INVITATION_EMAIL_STALE_AFTER_MS,
  );

  const [claimedInvitation] = await db
    .update(invitations)
    .set({
      emailStatus: "sending",
      emailAttemptCount: sql`${invitations.emailAttemptCount} + 1`,
      emailLastAttemptAt: now,
      emailSentAt: null,
      emailProviderId: null,
    })
    .where(
      and(
        eq(invitations.id, invitationId),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, now),
        or(
          eq(invitations.emailStatus, "pending"),
          eq(invitations.emailStatus, "failed"),
          and(
            eq(invitations.emailStatus, "sending"),
            or(
              isNull(invitations.emailLastAttemptAt),
              lt(invitations.emailLastAttemptAt, staleBefore),
            ),
          ),
        ),
      ),
    )
    .returning({
      id: invitations.id,
      organizationId: invitations.organizationId,
      email: invitations.email,
      role: invitations.role,
      invitedById: invitations.invitedById,
      emailAttemptCount: invitations.emailAttemptCount,
    });

  if (!claimedInvitation) {
    return null;
  }

  return {
    invitation: claimedInvitation,
    attemptStartedAt: now,
  };
}