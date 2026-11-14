
import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  notifications,
  projects,
  taskActivities,
  taskComments,
  tasks,
  users,
} from "@/lib/db/schema";
import {
  OrganizationAccessError,
  requireOrganizationMembership,
  type OrganizationRole,
} from "@/lib/organizations/authorization";

import type {
  CreateCommentInput,
  UpdateCommentInput,
} from "./schema";

async function getTaskContext(
  organizationId: string,
  projectId: string,
  taskId: string,
) {
  const [result] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      assigneeId: tasks.assigneeId,
      projectStatus: projects.status,
    })
    .from(tasks)
    .innerJoin(
      projects,
      and(
        eq(projects.id, tasks.projectId),
        eq(projects.organizationId, tasks.organizationId),
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

  return result ?? null;
}

function assertCanComment(role: OrganizationRole) {
  if (role === "viewer") {
    throw new OrganizationAccessError("FORBIDDEN");
  }
}

function assertCanManageComment(
  role: OrganizationRole,
  authorId: string | null,
  userId: string,
) {
  const isModerator = role === "owner" || role === "admin";
  const isAuthor = authorId === userId;

  if (!isModerator && !isAuthor) {
    throw new OrganizationAccessError("FORBIDDEN");
  }

  assertCanComment(role);
}

async function getActorName(userId: string) {
  const [actor] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!actor) {
    throw new Error("User not found");
  }

  return actor.name;
}

function preview(content: string) {
  return content.slice(0, 160);
}

export async function listTaskComments(
  organizationId: string,
  projectId: string,
  taskId: string,
  userId: string,
) {
  const organization = await requireOrganizationMembership(
    organizationId,
    userId,
  );

  const task = await getTaskContext(
    organization.id,
    projectId,
    taskId,
  );

  if (!task) return null;

  return db
    .select()
    .from(taskComments)
    .where(
      and(
        eq(taskComments.organizationId, organization.id),
        eq(taskComments.projectId, projectId),
        eq(taskComments.taskId, taskId),
      ),
    )
    .orderBy(asc(taskComments.createdAt));
}

export async function createTaskComment(
  organizationId: string,
  projectId: string,
  taskId: string,
  userId: string,
  input: CreateCommentInput,
) {
  const organization = await requireOrganizationMembership(
    organizationId,
    userId,
  );

  assertCanComment(organization.role);

  const task = await getTaskContext(
    organization.id,
    projectId,
    taskId,
  );

  if (!task) return null;

  if (task.projectStatus === "archived") {
    throw new Error("Cannot comment on tasks in an archived project");
  }

  const actorName = await getActorName(userId);
  const content = input.content.trim();

  return db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(taskComments)
      .values({
        organizationId: organization.id,
        projectId,
        taskId,
        authorId: userId,
        authorName: actorName,
        content,
      })
      .returning();

    if (!comment) return null;

    await tx.insert(taskActivities).values({
      organizationId: organization.id,
      projectId,
      taskId,
      actorId: userId,
      actorName,
      type: "comment_created",
      metadata: {
        commentId: comment.id,
        taskTitle: task.title,
        contentPreview: preview(comment.content),
      },
    });

    // Notify the task assignee when another member comments.
    // Do not notify the commenter when they are the assignee.
    if (task.assigneeId && task.assigneeId !== userId) {
      await tx.insert(notifications).values({
        organizationId: organization.id,
        recipientId: task.assigneeId,
        actorId: userId,
        projectId,
        taskId,
        type: "task_comment_created",
        title: "New comment on your task",
        message: `${actorName ?? "A team member"} commented on "${task.title}".`,
        metadata: {
          commentId: comment.id,
          taskTitle: task.title,
          contentPreview: preview(comment.content),
        },
      });
    }

    return comment;
  });
}

export async function updateTaskComment(
  organizationId: string,
  projectId: string,
  taskId: string,
  commentId: string,
  userId: string,
  input: UpdateCommentInput,
) {
  const organization = await requireOrganizationMembership(
    organizationId,
    userId,
  );

  const task = await getTaskContext(
    organization.id,
    projectId,
    taskId,
  );

  if (!task) return null;

  const [existingComment] = await db
    .select()
    .from(taskComments)
    .where(
      and(
        eq(taskComments.id, commentId),
        eq(taskComments.organizationId, organization.id),
        eq(taskComments.projectId, projectId),
        eq(taskComments.taskId, taskId),
      ),
    )
    .limit(1);

  if (!existingComment) return null;

  assertCanManageComment(
    organization.role,
    existingComment.authorId,
    userId,
  );

  if (task.projectStatus === "archived") {
    throw new Error("Cannot edit comments in an archived project");
  }

  const content = input.content.trim();

  if (content === existingComment.content) {
    return existingComment;
  }

  const actorName = await getActorName(userId);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [updatedComment] = await tx
      .update(taskComments)
      .set({
        content,
        editedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(taskComments.id, commentId),
          eq(taskComments.organizationId, organization.id),
          eq(taskComments.projectId, projectId),
          eq(taskComments.taskId, taskId),
        ),
      )
      .returning();

    if (!updatedComment) return null;

    await tx.insert(taskActivities).values({
      organizationId: organization.id,
      projectId,
      taskId,
      actorId: userId,
      actorName,
      type: "comment_updated",
      metadata: {
        commentId: updatedComment.id,
        taskTitle: task.title,
        previousContentPreview: preview(existingComment.content),
        newContentPreview: preview(updatedComment.content),
      },
    });

    return updatedComment;
  });
}

export async function deleteTaskComment(
  organizationId: string,
  projectId: string,
  taskId: string,
  commentId: string,
  userId: string,
) {
  const organization = await requireOrganizationMembership(
    organizationId,
    userId,
  );

  const task = await getTaskContext(
    organization.id,
    projectId,
    taskId,
  );

  if (!task) return null;

  const [existingComment] = await db
    .select()
    .from(taskComments)
    .where(
      and(
        eq(taskComments.id, commentId),
        eq(taskComments.organizationId, organization.id),
        eq(taskComments.projectId, projectId),
        eq(taskComments.taskId, taskId),
      ),
    )
    .limit(1);

  if (!existingComment) return null;

  assertCanManageComment(
    organization.role,
    existingComment.authorId,
    userId,
  );

  if (task.projectStatus === "archived") {
    throw new Error("Cannot delete comments in an archived project");
  }

  const actorName = await getActorName(userId);

  return db.transaction(async (tx) => {
    const [deletedComment] = await tx
      .delete(taskComments)
      .where(
        and(
          eq(taskComments.id, commentId),
          eq(taskComments.organizationId, organization.id),
          eq(taskComments.projectId, projectId),
          eq(taskComments.taskId, taskId),
        ),
      )
      .returning();

    if (!deletedComment) return null;

    await tx.insert(taskActivities).values({
      organizationId: organization.id,
      projectId,
      taskId,
      actorId: userId,
      actorName,
      type: "comment_deleted",
      metadata: {
        commentId: deletedComment.id,
        taskTitle: task.title,
        contentPreview: preview(deletedComment.content),
      },
    });

    return deletedComment;
  });
}
