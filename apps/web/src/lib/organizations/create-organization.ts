
import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import type { CreateOrganizationInput } from "./schema";

function generateSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const safeBase = base || "team";
  const suffix = randomUUID().slice(0, 8);

  return `${safeBase}-${suffix}`;
}

export async function createOrganization(
  input: CreateOrganizationInput,
  userId: string,
) {
  const slug = generateSlug(input.name);
  const description = input.description || null;

  // Create the organization and its owner membership
  // in one atomic PostgreSQL statement.
  const result = await db.execute(
    sql`
      WITH created_organization AS (
        INSERT INTO organizations (
          name,
          slug,
          description,
          created_by_id
        )
        VALUES (
          ${input.name},
          ${slug},
          ${description},
          ${userId}::uuid
        )
        RETURNING
          id,
          name,
          slug,
          description,
          created_by_id,
          created_at,
          updated_at
      ),
      created_membership AS (
        INSERT INTO memberships (
          organization_id,
          user_id,
          role
        )
        SELECT
          id,
          created_by_id,
          'owner'::organization_role
        FROM created_organization
        RETURNING
          organization_id,
          user_id,
          role,
          joined_at
      )
      SELECT
        o.id,
        o.name,
        o.slug,
        o.description,
        o.created_by_id AS "createdById",
        o.created_at AS "createdAt",
        o.updated_at AS "updatedAt",
        m.user_id AS "userId",
        m.role,
        m.joined_at AS "joinedAt"
      FROM created_organization o
      INNER JOIN created_membership m
        ON m.organization_id = o.id
    `,
  );

  const organization = result.rows[0];

  if (!organization) {
    throw new Error("Organization creation failed");
  }

  return organization;
}
