
import "server-only";

import {
  and,
  eq,
  isNull,
  lte,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  invitations,
  memberships,
  users,
} from "@/lib/db/schema";

import {
  generateInvitationToken,
  getInvitationExpiryDate,
  hashInvitationToken,
} from "./token";

type OrganizationRole = typeof memberships.$inferSelect.role;
type InvitationRole = typeof invitations.$inferSelect.role;

type CreateInvitationParams = {
  organizationId: string;
  inviterId: string;
  inviterRole: OrganizationRole;
  email: string;
  role: InvitationRole;
};

export type InvitationServiceErrorCode =
  | "FORBIDDEN_ROLE"
  | "ALREADY_MEMBER"
  | "PENDING_INVITATION_EXISTS";

export class InvitationServiceError extends Error {
  constructor(public readonly code: InvitationServiceErrorCode) {
    super(code);
    this.name = "InvitationServiceError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function createInvitation({
  organizationId,
  inviterId,
  inviterRole,
  email,
  role,
}: CreateInvitationParams) {
  if (
    inviterRole !== "owner" &&
    inviterRole !== "admin"
  ) {
    throw new InvitationServiceError("FORBIDDEN_ROLE");
  }

  if (inviterRole === "admin" && role === "admin") {
    throw new InvitationServiceError("FORBIDDEN_ROLE");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  // Reject users who already belong to this organization.
  const [existingMember] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        sql`lower(${users.email}) = ${normalizedEmail}`,
      ),
    )
    .limit(1);

  if (existingMember) {
    throw new InvitationServiceError("ALREADY_MEMBER");
  }

  // Reject an existing, unexpired invitation.
  const [existingInvitation] = await db
    .select({
      id: invitations.id,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        sql`lower(${invitations.email}) = ${normalizedEmail}`,
        isNull(invitations.acceptedAt),
      ),
    )
    .limit(1);

  if (existingInvitation && existingInvitation.expiresAt > now) {
    throw new InvitationServiceError("PENDING_INVITATION_EXISTS");
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = getInvitationExpiryDate(now);

  const invitationFields = {
    role,
    tokenHash,
    invitedById: inviterId,
    expiresAt,
    createdAt: now,
  };

  try {
    // Reuse an expired, unaccepted invitation if one exists.
    const [updatedInvitation] = await db
      .update(invitations)
      .set(invitationFields)
      .where(
        and(
          eq(invitations.organizationId, organizationId),
          sql`lower(${invitations.email}) = ${normalizedEmail}`,
          isNull(invitations.acceptedAt),
          lte(invitations.expiresAt, now),
        ),
      )
      .returning({
        id: invitations.id,
        organizationId: invitations.organizationId,
        email: invitations.email,
        role: invitations.role,
        invitedById: invitations.invitedById,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      });

    if (updatedInvitation) {
      return {
        invitation: updatedInvitation,
        token,
      };
    }

    // No expired invitation was available, so create a new one.
    const [createdInvitation] = await db
      .insert(invitations)
      .values({
        organizationId,
        email: normalizedEmail,
        ...invitationFields,
      })
      .returning({
        id: invitations.id,
        organizationId: invitations.organizationId,
        email: invitations.email,
        role: invitations.role,
        invitedById: invitations.invitedById,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      });

    if (!createdInvitation) {
      throw new Error("Unable to create invitation");
    }

    return {
      invitation: createdInvitation,
      token,
    };
  } catch (error) {
    if (error instanceof InvitationServiceError) {
      throw error;
    }

    if (isUniqueViolation(error)) {
      throw new InvitationServiceError(
        "PENDING_INVITATION_EXISTS",
      );
    }

    throw error;
  }
}
