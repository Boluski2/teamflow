
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/auth/ensure-user";
import { getUnreadNotificationCount } from "@/lib/notifications/service";
import { taskRouteError } from "@/lib/tasks/route-errors";

const uuidSchema = z.uuid();

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

export async function GET(
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

    const unreadCount = await getUnreadNotificationCount(
      organizationId,
      user.id,
    );

    return NextResponse.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    return taskRouteError(error, "fetch unread notification count");
  }
}
