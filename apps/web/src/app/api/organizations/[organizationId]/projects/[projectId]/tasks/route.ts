import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import { createTask, listTasks } from "@/lib/tasks/service";
import { createTaskSchema } from "@/lib/tasks/schema";
import { taskRouteError } from "@/lib/tasks/route-errors";

const uuidSchema = z.uuid();

type RouteContext = {
  params: Promise<{
    organizationId: string;
    projectId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(projectId).success
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid organization or project ID" },
        { status: 400 },
      );
    }

    const tasks = await listTasks(
      organizationId,
      projectId,
      user.id,
    );

    if (!tasks) {
      return NextResponse.json(
        { success: false, message: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      tasks,
    });
  } catch (error) {
    return taskRouteError(error, "List tasks");
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(projectId).success
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid organization or project ID" },
        { status: 400 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid task data",
          errors: z.flattenError(parsed.error).fieldErrors,
        },
        { status: 400 },
      );
    }

    const task = await createTask(
      organizationId,
      projectId,
      user.id,
      parsed.data,
    );

    if (!task) {
      return NextResponse.json(
        { success: false, message: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Task created successfully",
        task,
      },
      { status: 201 },
    );
  } catch (error) {
    return taskRouteError(error, "Create task");
  }
}