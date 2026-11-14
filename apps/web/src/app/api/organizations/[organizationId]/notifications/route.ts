
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import { listNotifications } from "@/lib/notifications/service";
import { taskRouteError } from "@/lib/tasks/route-errors";

const uuidSchema = z.uuid();

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const { organizationId } = await params;
    const user = await ensureUser();

    if (!uuidSchema.safeParse(organizationId).success) {
      return NextResponse.json(
        { error: "Invalid organization ID" },
        { status: 400 },
      );
    }

    const rawLimit = request.nextUrl.searchParams.get("limit");
    let limit = 30;

    if (rawLimit !== null) {
      limit = Number(rawLimit);

      if (!Number.isInteger(limit) || limit < 1) {
        return NextResponse.json(
          { error: "Limit must be a positive integer" },
          { status: 400 },
        );
      }
    }

    const userNotifications = await listNotifications(
      organizationId,
      user.id,
      limit,
    );

    return NextResponse.json({
      success: true,
      notifications: userNotifications,
    });
  } catch (error) {
    return taskRouteError(error, "fetch notifications");
    
  }
}
