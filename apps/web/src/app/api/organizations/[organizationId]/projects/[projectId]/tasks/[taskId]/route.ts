import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import { getTask, updateTask, deleteTask, } from "@/lib/tasks/service";
import { updateTaskSchema } from "@/lib/tasks/schema";
import { taskRouteError } from "@/lib/tasks/route-errors";

const uuidSchema = z.uuid();

type RouteContext = {
  params: Promise<{
    organizationId: string;
    projectId: string;
    taskId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId, taskId } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(projectId).success ||
      !uuidSchema.safeParse(taskId).success
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid organization, project, or task ID" },
        { status: 400 },
      );
    }

    const task = await getTask(
      organizationId,
      projectId,
      taskId,
      user.id,
    );

    if (!task) {
      return NextResponse.json(
        { success: false, message: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    return taskRouteError(error, "Get task");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId, taskId } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(projectId).success ||
      !uuidSchema.safeParse(taskId).success
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid organization, project, or task ID" },
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

    const parsed = updateTaskSchema.safeParse(body);

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

    const task = await updateTask(
      organizationId,
      projectId,
      taskId,
      user.id,
      parsed.data,
    );

    if (!task) {
      return NextResponse.json(
        { success: false, message: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    return taskRouteError(error, "Update task");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId, taskId } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(projectId).success ||
      !uuidSchema.safeParse(taskId).success
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid organization, project, or task ID" },
        { status: 400 },
      );
    }

    const task = await deleteTask(
      organizationId,
      projectId,
      taskId,
      user.id,
    );

    if (!task) {
      return NextResponse.json(
        { success: false, message: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    return taskRouteError(error, "Delete task");
  }
}