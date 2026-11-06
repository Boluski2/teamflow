import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  OrganizationAccessError,
  requireOrganizationMembership,
  requireOrganizationPermission,
} from "@/lib/organizations/authorization";
import { updateOrganization } from "@/lib/organizations/update-organization";
import { updateOrganizationSchema } from "@/lib/organizations/schema";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

const organizationIdSchema = z.string().uuid();

function accessErrorResponse(error: unknown) {
  if (error instanceof OrganizationAccessError) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json(
        { success: false, message: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: false, message: "You do not have permission to update this organization" },
      { status: 403 },
    );
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    if (error.message === "Your TeamFlow account has been deactivated") {
      return NextResponse.json(
        { success: false, message: "Account deactivated" },
        { status: 403 },
      );
    }
  }

  return NextResponse.json(
    { success: false, message: "Unable to retrieve organization" },
    { status: 500 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    if (!organizationIdSchema.safeParse(organizationId).success) {
      return NextResponse.json(
        { success: false, message: "Invalid organization ID" },
        { status: 400 },
      );
    }

    const user = await ensureUser();
    const organization = await requireOrganizationMembership(
      organizationId,
      user.id,
    );

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { organizationId } = await context.params;
    if (!organizationIdSchema.safeParse(organizationId).success) {
      return NextResponse.json(
        { success: false, message: "Invalid organization ID" },
        { status: 400 },
      );
    }

    const user = await ensureUser();
    await requireOrganizationPermission(
      organizationId,
      user.id,
      "organization.update",
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    const validation = updateOrganizationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: "Invalid organization data" },
        { status: 400 },
      );
    }

    const organization = await updateOrganization(
      organizationId,
      validation.data,
    );
    if (!organization) {
      return NextResponse.json(
        { success: false, message: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    const response = accessErrorResponse(error);
    if (response.status === 500) {
      console.error("Organization update failed:", error);
    }
    return response;
  }
}
