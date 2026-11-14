
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  deleteTaskComment,
  updateTaskComment,
} from "@/lib/comments/service";
import { updateCommentSchema } from "@/lib/comments/schema";
import { taskRouteError } from "@/lib/tasks/route-errors";

const uuidSchema = z.uuid();

type RouteContext = {
  params: Promise<{
    organizationId: string;
    projectId: string;
    taskId: string;
    commentId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();

    const {
      organizationId,
      projectId,
      taskId,
      commentId,
    } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(projectId).success ||
      !uuidSchema.safeParse(taskId).success ||
      !uuidSchema.safeParse(commentId).success
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization, project, task, or comment ID",
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

    const parsed = updateCommentSchema.safeParse(body);

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

    const comment = await updateTaskComment(
      organizationId,
      projectId,
      taskId,
      commentId,
      user.id,
      parsed.data,
    );

    if (!comment) {
      return NextResponse.json(
        { success: false, message: "Comment or task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Comment updated successfully",
      comment,
    });
  } catch (error) {
    return taskRouteError(error, "Update task comment");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();

    const {
      organizationId,
      projectId,
      taskId,
      commentId,
    } = await params;

    if (
      !uuidSchema.safeParse(organizationId).success ||
      !uuidSchema.safeParse(projectId).success ||
      !uuidSchema.safeParse(taskId).success ||
      !uuidSchema.safeParse(commentId).success
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization, project, task, or comment ID",
        },
        { status: 400 },
      );
    }

    const comment = await deleteTaskComment(
      organizationId,
      projectId,
      taskId,
      commentId,
      user.id,
    );

    if (!comment) {
      return NextResponse.json(
        { success: false, message: "Comment or task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    return taskRouteError(error, "Delete task comment");
  }
}
