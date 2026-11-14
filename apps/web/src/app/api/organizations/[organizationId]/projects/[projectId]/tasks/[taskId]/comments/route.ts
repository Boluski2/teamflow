
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  createTaskComment,
  listTaskComments,
} from "@/lib/comments/service";
import { createCommentSchema } from "@/lib/comments/schema";
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
        {
          success: false,
          message: "Invalid organization, project, or task ID",
        },
        { status: 400 },
      );
    }

    const comments = await listTaskComments(
      organizationId,
      projectId,
      taskId,
      user.id,
    );

    if (!comments) {
      return NextResponse.json(
        { success: false, message: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    return taskRouteError(error, "List task comments");
  }
}

export async function POST(
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
        {
          success: false,
          message: "Invalid organization, project, or task ID",
        },
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

    const parsed = createCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid comment data",
          errors: z.flattenError(parsed.error).fieldErrors,
        },
        { status: 400 },
      );
    }

    const comment = await createTaskComment(
      organizationId,
      projectId,
      taskId,
      user.id,
      parsed.data,
    );

    if (!comment) {
      return NextResponse.json(
        { success: false, message: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Comment created successfully",
        comment,
      },
      { status: 201 },
    );
  } catch (error) {
    return taskRouteError(error, "Create task comment");
  }
}
