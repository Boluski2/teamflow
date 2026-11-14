import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";

export type OrganizationRole =
  typeof memberships.$inferSelect.role;

  export type OrganizationPermission =
  | "organization.view"
  | "organization.update"
  | "organization.delete"
  | "organization.transfer_ownership"
  | "members.invite"
  | "members.remove"
  | "members.change_role"
  | "projects.view"
  | "projects.create"
  | "tasks.view"
  | "tasks.create"
  | "tasks.update"
  | "tasks.assign"
  | "projects.update"
  | "tasks.delete"
  | "projects.archive";

const rolePermissions: Record<
  OrganizationRole,
  readonly OrganizationPermission[]
> = {
  owner: [
    "organization.view",
    "organization.update",
    "organization.delete",
    "organization.transfer_ownership",
    "members.invite",
    "members.remove",
    "members.change_role",
    "projects.view",
    "projects.create",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.assign",
    "projects.update",
    "tasks.delete",
    "projects.archive",
  ],

  admin: [
    "organization.view",
    "organization.update",
    "members.invite",
    "members.remove",
    "projects.view",
    "projects.create",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.assign",
    "projects.update",
    "tasks.delete",
    "projects.archive",
  ],

  member: [
    "organization.view",
    "projects.view",
    "projects.create",
    "tasks.view",
    "tasks.create",
    "tasks.update",
    "tasks.assign",
  ],

  viewer: [
    "organization.view",
    "projects.view",
    "tasks.view",
  ],
};


export async function requireOrganizationPermission(
  organizationId: string,
  userId: string,
  permission: OrganizationPermission,
) {
  const organization = await requireOrganizationMembership(
    organizationId,
    userId,
  );

  const allowedPermissions = rolePermissions[organization.role];

  if (!allowedPermissions.includes(permission)) {
    throw new OrganizationAccessError("FORBIDDEN");
  }

  return organization;
}


export class OrganizationAccessError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN",
  ) {
    super(code);
    this.name = "OrganizationAccessError";
  }
}

export async function requireOrganizationMembership(
  organizationId: string,
  userId: string,
) {
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      createdById: organizations.createdById,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      role: memberships.role,
      joinedAt: memberships.joinedAt,
    })
    .from(organizations)
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, organizations.id),
        eq(memberships.userId, userId),
      ),
    )
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new OrganizationAccessError("NOT_FOUND");
  }

  return organization;
}

export async function requireOrganizationRole(
  organizationId: string,
  userId: string,
  allowedRoles: readonly OrganizationRole[],
) {
  const organization = await requireOrganizationMembership(
    organizationId,
    userId,
  );

  if (!allowedRoles.includes(organization.role)) {
    throw new OrganizationAccessError("FORBIDDEN");
  }

  return organization;
}