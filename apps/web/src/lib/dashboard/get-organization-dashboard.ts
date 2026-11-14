import "server-only";

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  memberships,
  organizations,
  projects,
  tasks,
  users,
} from "@/lib/db/schema";
import { requireOrganizationMembership } from "@/lib/organizations/authorization";

export async function getOrganizationDashboardData(
  slug: string,
  userId: string,
) {
  // Resolve the organization only if the user belongs to it.
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

  // Reuse the existing authorization helper.
  const organization = await requireOrganizationMembership(
    membership.organizationId,
    userId,
  );

  // Retrieve all dashboard information within this organization.
  const [
    projectStats,
    taskStats,
    taskStatusCounts,
    memberStats,
    recentProjects,
    recentMembers,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        // active: count(
        //   // Count active projects separately below.
        // ),
      })
      .from(projects)
      .where(eq(projects.organizationId, organization.id)),

    db
      .select({
        total: count(),
      })
      .from(tasks)
      .where(eq(tasks.organizationId, organization.id)),

    db
      .select({
        status: tasks.status,
        total: count(),
      })
      .from(tasks)
      .where(eq(tasks.organizationId, organization.id))
      .groupBy(tasks.status),

    db
      .select({
        total: count(),
      })
      .from(memberships)
      .where(eq(memberships.organizationId, organization.id)),

    db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        dueDate: projects.dueDate,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.organizationId, organization.id))
      .orderBy(desc(projects.updatedAt))
      .limit(5),

    db
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
      .where(eq(memberships.organizationId, organization.id))
      .orderBy(desc(memberships.joinedAt))
      .limit(5),
  ]);

  const activeProjectResult = await db
    .select({
      total: count(),
    })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organization.id),
        eq(projects.status, "active"),
      ),
    );

  return {
    organization,

    statistics: {
      totalProjects: projectStats[0]?.total ?? 0,
      activeProjects: activeProjectResult[0]?.total ?? 0,
      totalTasks: taskStats[0]?.total ?? 0,
      totalMembers: memberStats[0]?.total ?? 0,
    },

    taskStatusCounts,

    recentProjects,

    recentMembers,
  };
}