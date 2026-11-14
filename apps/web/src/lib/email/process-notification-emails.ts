
import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  emailOutbox,
  notifications,
  organizations,
  projects,
  userNotificationPreferences,
  users,
} from "@/lib/db/schema";
import {
  markEmailJobCancelled,
  markEmailJobFailed,
  markEmailJobSent,
  claimEmailJobs,
} from "@/lib/email/outbox-worker";
import {
  sendNotificationEmail,
} from "@/lib/email/send-notification-email";
import type {
  NotificationEmailType,
} from "@/lib/email/notification-email";

const SUPPORTED_TEMPLATES: readonly NotificationEmailType[] = [
  "task_assigned",
  "task_unassigned",
  "task_comment_created",
  "task_status_changed",
  "task_priority_changed",
  "task_due_soon",
];

function isSupportedTemplate(
  value: string,
): value is NotificationEmailType {
  return SUPPORTED_TEMPLATES.some((template) => template === value);
}

function getString(
  value: unknown,
): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

type DeliveryContext = {
  email: string;
  recipientName: string;
  emailEnabled: boolean | null;
  isActive: boolean;
  notificationType: string;
  notificationTitle: string;
  notificationMessage: string;
  metadata: Record<string, unknown>;
  organizationSlug: string;
  projectId: string | null;
};

async function getDeliveryContext(
  notificationId: string,
): Promise<DeliveryContext | null> {
  const [result] = await db
    .select({
      email: users.email,
      recipientName: users.name,
      isActive: users.isActive,
      emailEnabled: userNotificationPreferences.emailEnabled,
      notificationType: notifications.type,
      notificationTitle: notifications.title,
      notificationMessage: notifications.message,
      metadata: notifications.metadata,
      organizationSlug: organizations.slug,
      projectId: projects.id,
    })
    .from(emailOutbox)
    .innerJoin(
      notifications,
      eq(emailOutbox.notificationId, notifications.id),
    )
    .innerJoin(
      users,
      eq(notifications.recipientId, users.id),
    )
    .innerJoin(
      organizations,
      eq(notifications.organizationId, organizations.id),
    )
    .leftJoin(
      projects,
      and(
        eq(notifications.projectId, projects.id),
        eq(notifications.organizationId, projects.organizationId),
      ),
    )
    .leftJoin(
      userNotificationPreferences,
      eq(
        notifications.recipientId,
        userNotificationPreferences.userId,
      ),
    )
    .where(eq(emailOutbox.notificationId, notificationId))
    .limit(1);

  if (!result) return null;

  return {
    ...result,
    metadata: getRecord(result.metadata),
  };
}

export type ProcessNotificationEmailsResult = {
  claimed: number;
  sent: number;
  failed: number;
  cancelled: number;
  skipped: number;
};

export async function processNotificationEmails(): Promise<ProcessNotificationEmailsResult> {
  const jobs = await claimEmailJobs();

  const result: ProcessNotificationEmailsResult = {
    claimed: jobs.length,
    sent: 0,
    failed: 0,
    cancelled: 0,
    skipped: 0,
  };

  for (const job of jobs) {
    const leaseExpiresAt = job.leaseExpiresAt;

    if (!leaseExpiresAt) {
      result.skipped += 1;
      continue;
    }

    try {
      const context = await getDeliveryContext(job.notificationId);

      // The notification or its related records are no longer available.
      if (!context) {
        const cancelled = await markEmailJobCancelled({
          jobId: job.id,
          leaseExpiresAt,
        });

        if (cancelled) {
          result.cancelled += 1;
        } else {
          result.skipped += 1;
        }

        continue;
      }

      // Always re-check opt-in and account status at delivery time.
      if (!context.isActive || context.emailEnabled !== true) {
        const cancelled = await markEmailJobCancelled({
          jobId: job.id,
          leaseExpiresAt,
        });

        if (cancelled) {
          result.cancelled += 1;
        } else {
          result.skipped += 1;
        }

        continue;
      }

      // Do not send an unknown template or a mismatched notification.
      if (
        !isSupportedTemplate(job.template) ||
        job.template !== context.notificationType
      ) {
        const cancelled = await markEmailJobCancelled({
          jobId: job.id,
          leaseExpiresAt,
        });

        if (cancelled) {
          result.cancelled += 1;
        } else {
          result.skipped += 1;
        }

        continue;
      }

      const payload = getRecord(job.payload);

      const taskTitle =
        getString(payload.taskTitle) ??
        getString(context.metadata.taskTitle);

      const projectPath = context.projectId
        ? `/dashboard/${encodeURIComponent(context.organizationSlug)}/projects/${encodeURIComponent(context.projectId)}`
        : `/dashboard/${encodeURIComponent(context.organizationSlug)}`;

      const emailResult = await sendNotificationEmail({
        email: context.email,
        recipientName: context.recipientName || "there",
        notificationType: job.template,
        notificationTitle: context.notificationTitle,
        notificationMessage: context.notificationMessage,
        taskTitle,
        appUrl: projectPath,
      });

      if (!emailResult.success) {
        const updated = await markEmailJobFailed({
          jobId: job.id,
          leaseExpiresAt,
          attempts: job.attempts,
          error: `Notification email delivery failed: ${emailResult.reason}`,
        });

        if (updated) {
          result.failed += 1;
        } else {
          result.skipped += 1;
        }

        continue;
      }

      const updated = await markEmailJobSent({
        jobId: job.id,
        leaseExpiresAt,
        providerMessageId: emailResult.emailId,
      });

      if (updated) {
        result.sent += 1;
      } else {
        // The provider may have accepted the email, but this worker
        // no longer owns the lease and must not change the job.
        result.skipped += 1;
      }
    } catch (error) {
      console.error("Notification email processing failed.", {
        jobId: job.id,
        errorName:
          error instanceof Error ? error.name : "UnknownError",
      });

      try {
        const updated = await markEmailJobFailed({
          jobId: job.id,
          leaseExpiresAt,
          attempts: job.attempts,
          error: "Failed to prepare or process notification email",
        });

        if (updated) {
          result.failed += 1;
        } else {
          result.skipped += 1;
        }
      } catch {
        result.skipped += 1;
      }
    }
  }

  return result;
}
