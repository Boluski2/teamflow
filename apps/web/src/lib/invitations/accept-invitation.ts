import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hashInvitationToken } from "./token";

type AcceptInvitationParams = {
  token: string;
  userId: string;
  userEmail: string;
};

export type AcceptInvitationErrorCode =
  | "NOT_FOUND"
  | "EXPIRED"
  | "ALREADY_ACCEPTED"
  | "EMAIL_MISMATCH"
  | "ALREADY_MEMBER";

export class AcceptInvitationError extends Error {
  constructor(
    public readonly code: AcceptInvitationErrorCode,
  ) {
    super(code);
    this.name = "AcceptInvitationError";
  }
}

type AcceptanceResult = {
  status: AcceptInvitationErrorCode | "ACCEPTED";
  organizationId: string | null;
  role: "admin" | "member" | "viewer" | null;
  joinedAt: Date | string | null;
};

export async function acceptInvitation({
  token,
  userId,
  userEmail,
}: AcceptInvitationParams) {
  const tokenHash = hashInvitationToken(token);
  const normalizedEmail = userEmail.trim().toLowerCase();

  const result = await db.execute(sql`
    WITH candidate_invitation AS MATERIALIZED (
      SELECT
        id,
        organization_id,
        email,
        role,
        expires_at,
        accepted_at
      FROM invitations
      WHERE token_hash = ${tokenHash}
      FOR UPDATE
    ),

    invitation_decision AS MATERIALIZED (
      SELECT
        id,
        organization_id,
        role,
        CASE
          WHEN accepted_at IS NOT NULL
            THEN 'ALREADY_ACCEPTED'
          WHEN expires_at <= NOW()
            THEN 'EXPIRED'
          WHEN lower(email) <> ${normalizedEmail}
            THEN 'EMAIL_MISMATCH'
          ELSE 'ELIGIBLE'
        END AS decision
      FROM candidate_invitation
    ),

    created_membership AS (
      INSERT INTO memberships (
        organization_id,
        user_id,
        role
      )
      SELECT
        organization_id,
        ${userId}::uuid,
        role::text::organization_role
      FROM invitation_decision
      WHERE decision = 'ELIGIBLE'
      ON CONFLICT (organization_id, user_id) DO NOTHING
      RETURNING
        organization_id,
        user_id,
        role,
        joined_at
    ),

    accepted_invitation AS (
      UPDATE invitations AS i
      SET accepted_at = NOW()
      FROM invitation_decision AS d
      INNER JOIN created_membership AS m
        ON m.organization_id = d.organization_id
      WHERE i.id = d.id
        AND d.decision = 'ELIGIBLE'
        AND i.accepted_at IS NULL
      RETURNING
        i.organization_id,
        m.role,
        m.joined_at
    )

    SELECT
      CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM candidate_invitation
        )
          THEN 'NOT_FOUND'

        WHEN EXISTS (
          SELECT 1
          FROM invitation_decision
          WHERE decision <> 'ELIGIBLE'
        )
          THEN (
            SELECT decision
            FROM invitation_decision
          )

        WHEN EXISTS (
          SELECT 1 FROM accepted_invitation
        )
          THEN 'ACCEPTED'

        ELSE 'ALREADY_MEMBER'
      END AS status,

      (
        SELECT organization_id
        FROM accepted_invitation
      ) AS "organizationId",

      (
        SELECT role
        FROM accepted_invitation
      ) AS role,

      (
        SELECT joined_at
        FROM accepted_invitation
      ) AS "joinedAt"
  `);

  const acceptance = result.rows[0] as
    | AcceptanceResult
    | undefined;

  if (!acceptance) {
    throw new Error("Invitation acceptance failed");
  }

  if (acceptance.status !== "ACCEPTED") {
    throw new AcceptInvitationError(acceptance.status);
  }

const joinedAt = new Date(acceptance.joinedAt!);

if (Number.isNaN(joinedAt.getTime())) {
  throw new Error("Invalid membership timestamp returned by database");
}

return {
  organizationId: acceptance.organizationId!,
  role: acceptance.role!,
  joinedAt,
};
}
