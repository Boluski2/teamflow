
import "server-only";

import {
  and,
  eq,
  gt,
  isNotNull,
  lte,
  notInArray,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications, projects, tasks } from "@/lib/db/schema";

type ProcessDueSoonNotificationsOptions = {
  now?: Date;
  windowHours?: number;
};

type DueSoonTask = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  assigneeId: string;
  dueDate: Date;
  projectName: string;
};

export type DueSoonNotificationResult = {
  scannedTasks: number;
  notificationsCreated: number;
  windowHours: number;
};

export async function processDueSoonNotifications(
  options: ProcessDueSoonNotificationsOptions = {},
): Promise<DueSoonNotificationResult> {
  const now = options.now ?? new Date();
  const windowHours = options.windowHours ?? 24;

  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid processing date");
  }

  if (
    !Number.isFinite(windowHours) ||
    windowHours <= 0 ||
    windowHours > 168
  ) {
    throw new Error("Reminder window must be between 0 and 168 hours");
  }

  const windowEnd = new Date(
    now.getTime() + windowHours * 60 * 60 * 1000,
  );

  const dueSoonTasks = await db
    .select({
      id: tasks.id,
      organizationId: tasks.organizationId,
      projectId: tasks.projectId,
      title: tasks.title,
      assigneeId: tasks.assigneeId,
      dueDate: tasks.dueDate,
      projectName: projects.name,
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
        eq(projects.status, "active"),
        isNotNull(tasks.assigneeId),
        isNotNull(tasks.dueDate),
        gt(tasks.dueDate, now),
        lte(tasks.dueDate, windowEnd),
        notInArray(tasks.status, ["done", "cancelled"]),
      ),
    );

  const eligibleTasks: DueSoonTask[] = dueSoonTasks.filter(
    (
      task,
    ): task is typeof task & {
      assigneeId: string;
      dueDate: Date;
    } => task.assigneeId !== null && task.dueDate !== null,
  );

  if (eligibleTasks.length === 0) {
    return {
      scannedTasks: 0,
      notificationsCreated: 0,
      windowHours,
    };
  }

  const notificationValues = eligibleTasks.map((task) => {
    const dueDateKey = task.dueDate.toISOString();

    return {
      organizationId: task.organizationId,
      recipientId: task.assigneeId,
      actorId: null,
      projectId: task.projectId,
      taskId: task.id,
      type: "task_due_soon" as const,
      title: "Task due soon",
      message: `"${task.title}" is due within the next ${windowHours} hours.`,
      metadata: {
        taskTitle: task.title,
        projectName: task.projectName,
        dueDate: dueDateKey,
        reminderWindowHours: windowHours,
      },
      dedupeKey: `task_due_soon:${task.id}:${task.assigneeId}:${dueDateKey}`,
    };
  });

  const createdNotifications = await db
    .insert(notifications)
    .values(notificationValues)
    .onConflictDoNothing()
    .returning({
      id: notifications.id,
    });

  return {
    scannedTasks: eligibleTasks.length,
    notificationsCreated: createdNotifications.length,
    windowHours,
  };
}
