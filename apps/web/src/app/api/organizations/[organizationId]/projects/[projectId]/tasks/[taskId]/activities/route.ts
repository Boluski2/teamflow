
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import { listTaskActivities } from "@/lib/activities/service";
import { taskRouteError } from "@/lib/tasks/route-errors";

type RouteContext = {
  params: Promise<{
    organizationId: string;
    projectId: string;
    taskId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId, taskId } =
      await context.params;

    const organizationIdResult = z.uuid().safeParse(organizationId);
    const projectIdResult = z.uuid().safeParse(projectId);
    const taskIdResult = z.uuid().safeParse(taskId);

    if (
      !organizationIdResult.success ||
      !projectIdResult.success ||
      !taskIdResult.success
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization, project, or task ID",
        },
        { status: 400 },
      );
    }

    const activities = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      user.id,
    );

    if (activities === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Task not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        activities,
      },
      { status: 200 },
    );
  } catch (error) {
    return taskRouteError(error, "List task activities");
  }
}
