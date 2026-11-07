import "server-only";

import {
  and,
  eq,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { invitations } from "@/lib/db/schema";

import {
  generateInvitationToken,
  getInvitationExpiryDate,
  hashInvitationToken,
} from "./token";

import { INVITATION_EMAIL_STALE_AFTER_MS } from "./claim-invitation-email";

type ClaimInvitationResendInput = {
  invitationId: string;
  organizationId: string;
  now?: Date;
};

export async function claimInvitationResend({
  invitationId,
  organizationId,
  now = new Date(),
}: ClaimInvitationResendInput) {
  const staleBefore = new Date(
    now.getTime() - INVITATION_EMAIL_STALE_AFTER_MS,
  );

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = getInvitationExpiryDate(now);

  const [claimed] = await db
    .update(invitations)
    .set({
      tokenHash,
      expiresAt,
      emailStatus: "sending",
      emailAttemptCount: sql`${invitations.emailAttemptCount} + 1`,
      emailLastAttemptAt: now,
      emailSentAt: null,
      emailProviderId: null,
    })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.organizationId, organizationId),
        isNull(invitations.acceptedAt),
        or(
          ne(invitations.emailStatus, "sending"),
          isNull(invitations.emailLastAttemptAt),
          lt(invitations.emailLastAttemptAt, staleBefore),
        ),
      ),
    )
    .returning({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
    });

  if (claimed) {
    return {
      status: "claimed" as const,
      invitation: claimed,
      token,
      attemptStartedAt: now,
    };
  }

  const [existing] = await db
    .select({
      acceptedAt: invitations.acceptedAt,
      emailStatus: invitations.emailStatus,
      emailLastAttemptAt: invitations.emailLastAttemptAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!existing) {
    return { status: "not_found" as const };
  }

  if (existing.acceptedAt) {
    return { status: "already_accepted" as const };
  }

  if (
    existing.emailStatus === "sending" &&
    existing.emailLastAttemptAt &&
    existing.emailLastAttemptAt >= staleBefore
  ) {
    return { status: "sending" as const };
  }

  return { status: "not_claimed" as const };
}