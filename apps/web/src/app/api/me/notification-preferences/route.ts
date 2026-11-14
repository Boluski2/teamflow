
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import { db } from "@/lib/db";
import {
  emailOutbox,
  notifications,
  userNotificationPreferences,
} from "@/lib/db/schema";

const updatePreferencesSchema = z
  .object({
    emailEnabled: z.boolean(),
  })
  .strict();

function handleAuthError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    if (error.message === "Your TeamFlow account has been deactivated") {
      return NextResponse.json(
        { success: false, message: "Account deactivated" },
        { status: 403 },
      );
    }
  }

  return null;
}

export async function GET() {
  try {
    const user = await ensureUser();

    const [preferences] = await db
      .select({
        emailEnabled: userNotificationPreferences.emailEnabled,
      })
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, user.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      preferences: {
        emailEnabled: preferences?.emailEnabled ?? false,
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);

    if (authResponse) return authResponse;

    console.error("Failed to retrieve notification preferences", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await ensureUser();

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const validation = updatePreferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid notification preferences",
          errors: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const preferences = await db.transaction(async (tx) => {
      const [updatedPreferences] = await tx
        .insert(userNotificationPreferences)
        .values({
          userId: user.id,
          emailEnabled: validation.data.emailEnabled,
        })
        .onConflictDoUpdate({
          target: userNotificationPreferences.userId,
          set: {
            emailEnabled: validation.data.emailEnabled,
            updatedAt: new Date(),
          },
        })
        .returning({
          emailEnabled: userNotificationPreferences.emailEnabled,
        });

      if (!updatedPreferences) {
        throw new Error("Failed to update notification preferences");
      }

      // When opting out, cancel all queued and currently leased jobs.
      // The notification recipient relationship scopes this to this user.
      if (!validation.data.emailEnabled) {
        const userNotificationIds = tx
          .select({
            id: notifications.id,
          })
          .from(notifications)
          .where(eq(notifications.recipientId, user.id));

        await tx
          .update(emailOutbox)
          .set({
            status: "cancelled",
            leaseExpiresAt: null,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(emailOutbox.notificationId, userNotificationIds),
              inArray(emailOutbox.status, ["pending", "processing"]),
            ),
          );
      }

      return updatedPreferences;
    });

    return NextResponse.json({
      success: true,
      message: "Notification preferences updated",
      preferences,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);

    if (authResponse) return authResponse;

    console.error("Failed to update notification preferences", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
