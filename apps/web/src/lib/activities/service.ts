
import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, taskActivities, tasks } from "@/lib/db/schema";
import { requireOrganizationMembership } from "@/lib/organizations/authorization";

export async function listTaskActivities(
  organizationId: string,
  projectId: string,
  taskId: string,
  userId: string,
) {
  // Verify the user belongs to the organization.
  await requireOrganizationMembership(organizationId, userId);

  // Confirm that the task belongs to this organization and project.
  const [task] = await db
    .select({
      id: tasks.id,
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(tasks.projectId, projects.id),
        eq(tasks.organizationId, projects.organizationId),
      ),
    )
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.projectId, projectId),
        eq(tasks.organizationId, organizationId),
      ),
    )
    .limit(1);

  // A deleted or inaccessible task has no task-specific history.
  if (!task) {
    return null;
  }

  // Retrieve activity records in chronological order.
  const activities = await db
    .select()
    .from(taskActivities)
    .where(
      and(
        eq(taskActivities.organizationId, organizationId),
        eq(taskActivities.projectId, projectId),
        eq(taskActivities.taskId, taskId),
      ),
    )
    .orderBy(asc(taskActivities.createdAt));

  return activities;
}
