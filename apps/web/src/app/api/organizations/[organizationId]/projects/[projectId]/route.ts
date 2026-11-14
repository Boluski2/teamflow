
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  getProject,
  updateProject,
  updateProjectStatus,
} from "@/lib/projects/service";
import {
  updateProjectSchema,
  updateProjectStatusSchema,
} from "@/lib/projects/schema";
import { projectRouteError } from "@/lib/projects/route-errors";

type RouteContext = {
  params: Promise<{
    organizationId: string;
    projectId: string;
  }>;
};

const uuidSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId } = await params;

    const parsedOrganizationId = uuidSchema.safeParse(organizationId);
    const parsedProjectId = uuidSchema.safeParse(projectId);

    if (!parsedOrganizationId.success || !parsedProjectId.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization or project ID",
        },
        { status: 400 },
      );
    }

    const project = await getProject(
      parsedOrganizationId.data,
      parsedProjectId.data,
      user.id,
    );

    if (!project) {
      return NextResponse.json(
        { success: false, message: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    return projectRouteError(error, "Project retrieval");
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();
    const { organizationId, projectId } = await params;

    const parsedOrganizationId = uuidSchema.safeParse(organizationId);
    const parsedProjectId = uuidSchema.safeParse(projectId);

    if (!parsedOrganizationId.success || !parsedProjectId.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization or project ID",
        },
        { status: 400 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request body",
        },
        { status: 400 },
      );
    }

    // Status changes must be requested separately from project edits.
    if (
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      "status" in body
    ) {
      const validation = updateProjectStatusSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid project status data",
            errors: validation.error.flatten().fieldErrors,
          },
          { status: 400 },
        );
      }

      const project = await updateProjectStatus(
        parsedOrganizationId.data,
        parsedProjectId.data,
        user.id,
        validation.data,
      );

      if (!project) {
        return NextResponse.json(
          { success: false, message: "Project not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        message:
          validation.data.status === "archived"
            ? "Project archived successfully"
            : "Project reactivated successfully",
        project,
      });
    }

    const validation = updateProjectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid project data",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const project = await updateProject(
      parsedOrganizationId.data,
      parsedProjectId.data,
      user.id,
      validation.data,
    );

    if (!project) {
      return NextResponse.json(
        { success: false, message: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    return projectRouteError(error, "Project update");
  }
}
