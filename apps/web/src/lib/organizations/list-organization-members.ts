
import "server-only";

import { asc, and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";
import { requireOrganizationMembership } from "@/lib/organizations/authorization";

export async function listOrganizationMembers(
  organizationId: string,
  userId: string,
) {
  // Confirm that the requesting user belongs to this organization.
  await requireOrganizationMembership(organizationId, userId);

  // Return only active users who belong to this organization.
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: memberships.role,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(users.isActive, true),
      ),
    )
    .orderBy(asc(users.name));

  return members;
}
