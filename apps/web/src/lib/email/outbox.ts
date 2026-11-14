
import "server-only";

import { and, eq } from "drizzle-orm";

import type { db } from "@/lib/db";
import {
  emailOutbox,
  userNotificationPreferences,
} from "@/lib/db/schema";
import type { NotificationType } from "@/lib/notifications/service";

type EmailOutboxExecutor = Pick<typeof db, "select" | "insert">;

type EnqueueNotificationEmailInput = {
  notificationId: string;
  recipientId: string;
  template: NotificationType;
  payload?: Record<string, unknown>;
};

export async function enqueueNotificationEmail(
  executor: EmailOutboxExecutor,
  input: EnqueueNotificationEmailInput,
) {
  const [preference] = await executor
    .select({
      emailEnabled: userNotificationPreferences.emailEnabled,
    })
    .from(userNotificationPreferences)
    .where(
      and(
        eq(userNotificationPreferences.userId, input.recipientId),
        eq(userNotificationPreferences.emailEnabled, true),
      ),
    )
    .limit(1);

  if (!preference?.emailEnabled) {
    return null;
  }

  const [job] = await executor
    .insert(emailOutbox)
    .values({
      notificationId: input.notificationId,
      template: input.template,
      payload: input.payload ?? {},
    })
    .onConflictDoNothing()
    .returning({
      id: emailOutbox.id,
    });

  return job ?? null;
}
