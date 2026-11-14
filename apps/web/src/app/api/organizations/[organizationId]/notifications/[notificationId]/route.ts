
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/auth/ensure-user";
import { markNotificationAsRead } from "@/lib/notifications/service";
import { taskRouteError } from "@/lib/tasks/route-errors";

const uuidSchema = z.uuid();

type RouteContext = {
  params: Promise<{
    organizationId: string;
    notificationId: string;
  }>;
};

export async function PATCH(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { organizationId, notificationId } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(notificationId).success
    ) {
      return NextResponse.json(
        { error: "Invalid organization or notification ID" },
        { status: 400 },
      );
    }

    const user = await ensureUser();

    const notification = await markNotificationAsRead(
      organizationId,
      notificationId,
      user.id,
    );

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    return taskRouteError(error, "mark notification as read");
  }
}
