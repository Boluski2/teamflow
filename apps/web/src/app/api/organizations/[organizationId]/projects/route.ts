
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  createProject,
  listProjects,
} from "@/lib/projects/service";
import { createProjectSchema } from "@/lib/projects/schema";
import { projectRouteError } from "@/lib/projects/route-errors";

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

const organizationIdSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();

    const { organizationId } = await params;
    const parsedId =
      organizationIdSchema.safeParse(organizationId);

    if (!parsedId.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization ID",
        },
        { status: 400 },
      );
    }

    const projects = await listProjects(
      parsedId.data,
      user.id,
    );

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    return projectRouteError(error, "Project listing");
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await ensureUser();

    const { organizationId } = await params;
    const parsedId =
      organizationIdSchema.safeParse(organizationId);

    if (!parsedId.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization ID",
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

    const validation = createProjectSchema.safeParse(body);

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

    const project = await createProject(
      parsedId.data,
      user.id,
      validation.data,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Project created successfully",
        project,
      },
      { status: 201 },
    );
  } catch (error) {
    return projectRouteError(error, "Project creation");
  }
}
