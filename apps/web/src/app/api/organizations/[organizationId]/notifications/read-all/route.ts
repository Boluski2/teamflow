
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/auth/ensure-user";
import { markAllNotificationsAsRead } from "@/lib/notifications/service";
import { taskRouteError } from "@/lib/tasks/route-errors";

const uuidSchema = z.uuid();

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function PATCH(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { organizationId } = await params;

    if (!uuidSchema.safeParse(organizationId).success) {
      return NextResponse.json(
        { error: "Invalid organization ID" },
        { status: 400 },
      );
    }

    const user = await ensureUser();

    const updatedCount = await markAllNotificationsAsRead(
      organizationId,
      user.id,
    );

    return NextResponse.json({
      success: true,
      updatedCount,
    });
  } catch (error) {
    return taskRouteError(error, "mark all notifications as read");
  }
}
