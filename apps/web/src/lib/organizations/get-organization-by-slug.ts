import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";
import { requireOrganizationMembership } from "@/lib/organizations/authorization";

export async function getOrganizationBySlug(
  slug: string,
  userId: string,
) {
  const [membership] = await db
    .select({
      organizationId: organizations.id,
    })
    .from(organizations)
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, organizations.id),
        eq(memberships.userId, userId),
      ),
    )
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!membership) {
    return null;
  }

  return requireOrganizationMembership(
    membership.organizationId,
    userId,
  );
}
