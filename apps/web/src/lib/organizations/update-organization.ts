import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import type { UpdateOrganizationInput } from "./schema";

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput,
) {
  const updateValues = {
    updatedAt: new Date(),

    ...(input.name !== undefined
      ? { name: input.name }
      : {}),

    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
  };

  const [organization] = await db
    .update(organizations)
    .set(updateValues)
    .where(eq(organizations.id, organizationId))
    .returning({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      createdById: organizations.createdById,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    });

  return organization ?? null;
}