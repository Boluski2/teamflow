
import "server-only";

import {
  and,
  count,
  desc,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  notificationTypeEnum,
  notifications,
} from "@/lib/db/schema";
import { requireOrganizationMembership } from "@/lib/organizations/authorization";

export type NotificationType =
  (typeof notificationTypeEnum.enumValues)[number];

export type CreateNotificationInput = {
  organizationId: string;
  recipientId: string;
  actorId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function createNotification(
  input: CreateNotificationInput,
) {
  // A recipient must belong to the organization.
  await requireOrganizationMembership(
    input.organizationId,
    input.recipientId,
  );

  const [notification] = await db
    .insert(notifications)
    .values({
      organizationId: input.organizationId,
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? {},
    })
    .returning();

  if (!notification) {
    throw new Error("Failed to create notification");
  }

  return notification;
}

export async function listNotifications(
  organizationId: string,
  userId: string,
  limit = 30,
) {
  await requireOrganizationMembership(organizationId, userId);

  const safeLimit = Math.min(Math.max(limit, 1), 100);

  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientId, userId),
      ),
    )
    .orderBy(
      desc(notifications.createdAt),
      desc(notifications.id),
    )
    .limit(safeLimit);
}

export async function getUnreadNotificationCount(
  organizationId: string,
  userId: string,
) {
  await requireOrganizationMembership(organizationId, userId);

  const [result] = await db
    .select({
      total: count(),
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientId, userId),
        isNull(notifications.readAt),
      ),
    );

  return result?.total ?? 0;
}

export async function markNotificationAsRead(
  organizationId: string,
  notificationId: string,
  userId: string,
) {
  await requireOrganizationMembership(organizationId, userId);

  const [updatedNotification] = await db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning();

  if (updatedNotification) {
    return updatedNotification;
  }

  // Return the existing notification when it was already read.
  // This makes repeated requests idempotent.
  const [existingNotification] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientId, userId),
      ),
    )
    .limit(1);

  return existingNotification ?? null;
}

export async function markAllNotificationsAsRead(
  organizationId: string,
  userId: string,
) {
  await requireOrganizationMembership(organizationId, userId);

  const updatedNotifications = await db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning({
      id: notifications.id,
    });

  return updatedNotifications.length;
}
