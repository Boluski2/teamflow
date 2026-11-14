
import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  memberships,
  notifications,
  projects,
  taskActivities,
  tasks,
  users,
} from "@/lib/db/schema";
import {
  requireOrganizationPermission,
} from "@/lib/organizations/authorization";

import {
  createTaskSchema,
  updateTaskSchema,
} from "./schema";

type CreateTaskInput = z.infer<typeof createTaskSchema>;
type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

async function getProject(
  organizationId: string,
  projectId: string,
) {
  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);

  return project ?? null;
}

async function validateAssignee(
  organizationId: string,
  assigneeId: string | null | undefined,
) {
  if (!assigneeId) return;

  const [membership] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, assigneeId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new Error("Assignee is not a member of this organization");
  }
}

async function validateParentTask(
  organizationId: string,
  projectId: string,
  parentTaskId: string | null | undefined,
  taskId?: string,
) {
  if (!parentTaskId) return;

  const visited = new Set<string>();
  let currentTaskId: string | null = parentTaskId;

  while (currentTaskId) {
    if (currentTaskId === taskId) {
      throw new Error("A task cannot be a parent of its own ancestor");
    }

    if (visited.has(currentTaskId)) {
      throw new Error("Circular task hierarchy detected");
    }

    visited.add(currentTaskId);

    const [parent] = await db
      .select({
        id: tasks.id,
        parentTaskId: tasks.parentTaskId,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, currentTaskId),
          eq(tasks.organizationId, organizationId),
          eq(tasks.projectId, projectId),
        ),
      )
      .limit(1);

    if (!parent) {
      throw new Error("Parent task not found in this project");
    }

    currentTaskId = parent.parentTaskId;
  }
}


export async function createTask(
  organizationId: string,
  projectId: string,
  userId: string,
  input: CreateTaskInput,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "tasks.create",
  );

  const project = await getProject(organization.id, projectId);

  if (!project) return null;

  if (project.status === "archived") {
    throw new Error("Cannot create tasks in an archived project");
  }

  if (input.assigneeId) {
    await requireOrganizationPermission(
      organization.id,
      userId,
      "tasks.assign",
    );

    await validateAssignee(organization.id, input.assigneeId);
  }

  await validateParentTask(
    organization.id,
    projectId,
    input.parentTaskId,
  );

  const [actor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!actor) {
    throw new Error("User not found");
  }

  const now = new Date();

  return db.transaction(async (tx) => {
    const [task] = await tx
      .insert(tasks)
      .values({
        organizationId: organization.id,
        projectId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        dueDate: toDate(input.dueDate),
        createdById: userId,
        completedAt: input.status === "done" ? now : null,
      })
      .returning();

    if (!task) return null;

    await tx.insert(taskActivities).values({
      organizationId: organization.id,
      projectId,
      taskId: task.id,
      actorId: userId,
      actorName: actor.name,
      type: task.parentTaskId
        ? "subtask_created"
        : "task_created",
      metadata: {
        taskTitle: task.title,
        taskStatus: task.status,
        taskPriority: task.priority,
        parentTaskId: task.parentTaskId,
      },
    });

    if (task.assigneeId && task.assigneeId !== userId) {
      await tx.insert(notifications).values({
        organizationId: organization.id,
        recipientId: task.assigneeId,
        actorId: userId,
        projectId,
        taskId: task.id,
        type: "task_assigned",
        title: "Task assigned to you",
        message: `${actor.name ?? "A team member"} assigned "${task.title}" to you.`,
        metadata: {
          taskTitle: task.title,
          taskStatus: task.status,
          taskPriority: task.priority,
        },
      });
    }

    return task;
  });
}


export async function listTasks(
  organizationId: string,
  projectId: string,
  userId: string,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "tasks.view",
  );

  const project = await getProject(organization.id, projectId);

  if (!project) return null;

  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, organization.id),
        eq(tasks.projectId, projectId),
      ),
    )
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
}

export async function getTask(
  organizationId: string,
  projectId: string,
  taskId: string,
  userId: string,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "tasks.view",
  );

  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.organizationId, organization.id),
        eq(tasks.projectId, projectId),
      ),
    )
    .limit(1);

  return task ?? null;
}

export async function updateTask(
  organizationId: string,
  projectId: string,
  taskId: string,
  userId: string,
  input: UpdateTaskInput,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "tasks.update",
  );

  const [existingTask] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.organizationId, organization.id),
        eq(tasks.projectId, projectId),
      ),
    )
    .limit(1);

  if (!existingTask) return null;

  const project = await getProject(organization.id, projectId);

  if (!project) return null;

  if (project.status === "archived") {
    throw new Error("Cannot update tasks in an archived project");
  }

  if (input.assigneeId !== undefined) {
    await requireOrganizationPermission(
      organization.id,
      userId,
      "tasks.assign",
    );

    await validateAssignee(organization.id, input.assigneeId);
  }

  if (input.parentTaskId !== undefined) {
    await validateParentTask(
      organization.id,
      projectId,
      input.parentTaskId,
      taskId,
    );
  }

  const nextStatus = input.status ?? existingTask.status;

  const completedAt =
    input.status === undefined
      ? existingTask.completedAt
      : nextStatus === "done"
        ? existingTask.completedAt ?? new Date()
        : null;

  type ActivityEntry = {
    type:
      | "task_updated"
      | "task_status_changed"
      | "task_priority_changed"
      | "task_assigned"
      | "task_unassigned"
      | "task_due_date_changed";
    metadata: Record<string, unknown>;
  };

  const activityEntries: ActivityEntry[] = [];

  // General task details
  const changedFields: string[] = [];
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (
    input.title !== undefined &&
    input.title !== existingTask.title
  ) {
    changedFields.push("title");
    previousValues.title = existingTask.title;
    newValues.title = input.title;
  }

  if (
    input.description !== undefined &&
    input.description !== existingTask.description
  ) {
    changedFields.push("description");
    previousValues.description = existingTask.description;
    newValues.description = input.description;
  }

  if (
    input.parentTaskId !== undefined &&
    input.parentTaskId !== existingTask.parentTaskId
  ) {
    changedFields.push("parentTaskId");
    previousValues.parentTaskId = existingTask.parentTaskId;
    newValues.parentTaskId = input.parentTaskId;
  }

  if (changedFields.length > 0) {
    activityEntries.push({
      type: "task_updated",
      metadata: {
        taskTitle: input.title ?? existingTask.title,
        changedFields,
        previousValues,
        newValues,
      },
    });
  }

  // Status change
  if (
    input.status !== undefined &&
    input.status !== existingTask.status
  ) {
    activityEntries.push({
      type: "task_status_changed",
      metadata: {
        taskTitle: input.title ?? existingTask.title,
        previousStatus: existingTask.status,
        newStatus: input.status,
      },
    });
  }

  // Priority change
  if (
    input.priority !== undefined &&
    input.priority !== existingTask.priority
  ) {
    activityEntries.push({
      type: "task_priority_changed",
      metadata: {
        taskTitle: input.title ?? existingTask.title,
        previousPriority: existingTask.priority,
        newPriority: input.priority,
      },
    });
  }

  // Assignment change
  if (
    input.assigneeId !== undefined &&
    input.assigneeId !== existingTask.assigneeId
  ) {
    activityEntries.push({
      type: input.assigneeId ? "task_assigned" : "task_unassigned",
      metadata: {
        taskTitle: input.title ?? existingTask.title,
        previousAssigneeId: existingTask.assigneeId,
        newAssigneeId: input.assigneeId,
      },
    });
  }

  // Due-date change
  if (input.dueDate !== undefined) {
    const nextDueDate = toDate(input.dueDate);

    const previousTimestamp =
      existingTask.dueDate?.getTime() ?? null;

    const nextTimestamp = nextDueDate?.getTime() ?? null;

    if (previousTimestamp !== nextTimestamp) {
      activityEntries.push({
        type: "task_due_date_changed",
        metadata: {
          taskTitle: input.title ?? existingTask.title,
          previousDueDate:
            existingTask.dueDate?.toISOString() ?? null,
          newDueDate: nextDueDate?.toISOString() ?? null,
        },
      });
    }
  }

  let actorName: string | null = null;

  if (activityEntries.length > 0) {
    const [actor] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!actor) {
      throw new Error("User not found");
    }

    actorName = actor.name;
  }

  return db.transaction(async (tx) => {
    const [updatedTask] = await tx
      .update(tasks)
      .set({
        ...(input.title !== undefined && {
          title: input.title,
        }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status !== undefined && {
          status: input.status,
        }),
        ...(input.priority !== undefined && {
          priority: input.priority,
        }),
        ...(input.assigneeId !== undefined && {
          assigneeId: input.assigneeId,
        }),
        ...(input.parentTaskId !== undefined && {
          parentTaskId: input.parentTaskId,
        }),
        ...(input.dueDate !== undefined && {
          dueDate: toDate(input.dueDate),
        }),
        completedAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.organizationId, organization.id),
          eq(tasks.projectId, projectId),
        ),
      )
      .returning();

    if (!updatedTask) return null;

    if (activityEntries.length > 0 && actorName) {
      await tx.insert(taskActivities).values(
        activityEntries.map((entry) => ({
          organizationId: organization.id,
          projectId,
          taskId: updatedTask.id,
          actorId: userId,
          actorName,
          type: entry.type,
          metadata: {
            ...entry.metadata,
            taskId: updatedTask.id,
          },
        })),
      );
    }

    // Notify the new assignee.
    if (
      input.assigneeId &&
      input.assigneeId !== existingTask.assigneeId &&
      input.assigneeId !== userId
    ) {
      await tx.insert(notifications).values({
        organizationId: organization.id,
        recipientId: input.assigneeId,
        actorId: userId,
        projectId,
        taskId: updatedTask.id,
        type: "task_assigned",
        title: "Task assigned to you",
        message: `${actorName ?? "A team member"} assigned "${updatedTask.title}" to you.`,
        metadata: {
          taskTitle: updatedTask.title,
        },
      });
    }

    // Notify the previous assignee.
    if (
      input.assigneeId !== undefined &&
      existingTask.assigneeId &&
      input.assigneeId !== existingTask.assigneeId &&
      existingTask.assigneeId !== userId
    ) {
      await tx.insert(notifications).values({
        organizationId: organization.id,
        recipientId: existingTask.assigneeId,
        actorId: userId,
        projectId,
        taskId: updatedTask.id,
        type: "task_unassigned",
        title: "Task unassigned",
        message: `${actorName ?? "A team member"} unassigned you from "${updatedTask.title}".`,
        metadata: {
          taskTitle: updatedTask.title,
        },
      });
    }

    // Notify the current assignee about a status change.
    if (
      input.status !== undefined &&
      input.status !== existingTask.status &&
      updatedTask.assigneeId &&
      updatedTask.assigneeId !== userId
    ) {
      await tx.insert(notifications).values({
        organizationId: organization.id,
        recipientId: updatedTask.assigneeId,
        actorId: userId,
        projectId,
        taskId: updatedTask.id,
        type: "task_status_changed",
        title: "Task status changed",
        message: `${actorName ?? "A team member"} changed "${updatedTask.title}" status to ${updatedTask.status.replaceAll("_", " ")}.`,
        metadata: {
          taskTitle: updatedTask.title,
          previousStatus: existingTask.status,
          newStatus: updatedTask.status,
        },
      });
    }

    // Notify the current assignee about a priority change.
    if (
      input.priority !== undefined &&
      input.priority !== existingTask.priority &&
      updatedTask.assigneeId &&
      updatedTask.assigneeId !== userId
    ) {
      await tx.insert(notifications).values({
        organizationId: organization.id,
        recipientId: updatedTask.assigneeId,
        actorId: userId,
        projectId,
        taskId: updatedTask.id,
        type: "task_priority_changed",
        title: "Task priority changed",
        message: `${actorName ?? "A team member"} changed "${updatedTask.title}" priority to ${updatedTask.priority}.`,
        metadata: {
          taskTitle: updatedTask.title,
          previousPriority: existingTask.priority,
          newPriority: updatedTask.priority,
        },
      });
    }

    return updatedTask;
  });
}


export async function deleteTask(
  organizationId: string,
  projectId: string,
  taskId: string,
  userId: string,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "tasks.delete",
  );

  const [existingTask] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.organizationId, organization.id),
        eq(tasks.projectId, projectId),
      ),
    )
    .limit(1);

  if (!existingTask) return null;

  const project = await getProject(organization.id, projectId);

  if (!project) return null;

  if (project.status === "archived") {
    throw new Error("Cannot delete tasks in an archived project");
  }

  const [childTask] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, organization.id),
        eq(tasks.projectId, projectId),
        eq(tasks.parentTaskId, taskId),
      ),
    )
    .limit(1);

  if (childTask) {
    throw new Error("Cannot delete a task that has subtasks");
  }

  const [actor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!actor) {
    throw new Error("User not found");
  }

  return db.transaction(async (tx) => {
    const [deletedTask] = await tx
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.organizationId, organization.id),
          eq(tasks.projectId, projectId),
        ),
      )
      .returning();

    if (!deletedTask) return null;

    await tx.insert(taskActivities).values({
      organizationId: organization.id,
      projectId,
      taskId: null,
      actorId: userId,
      actorName: actor.name,
      type: "task_deleted",
      metadata: {
        taskId: deletedTask.id,
        taskTitle: deletedTask.title,
        taskStatus: deletedTask.status,
        taskPriority: deletedTask.priority,
        assigneeId: deletedTask.assigneeId,
        parentTaskId: deletedTask.parentTaskId,
        dueDate: deletedTask.dueDate?.toISOString() ?? null,
      },
    });

    return deletedTask;
  });
}
