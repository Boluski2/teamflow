
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  OrganizationAccessError,
  requireOrganizationMembership,
} from "@/lib/organizations/authorization";
import { listOrganizationMembers } from "@/lib/organizations/list-organization-members";

type RouteContext = {
  params: Promise<{ organizationId: string }>;
};

const organizationIdSchema = z.string().uuid();

function errorResponse(error: unknown) {
  if (error instanceof OrganizationAccessError) {
    if (error.code === "NOT_FOUND") {
      return NextResponse.json(
        { success: false, message: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: false, message: "You do not have access to this organization" },
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
    { success: false, message: "Unable to retrieve organization members" },
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

    // Explicit membership check before retrieving member data.
    await requireOrganizationMembership(organizationId, user.id);

    const members = await listOrganizationMembers(
      organizationId,
      user.id,
    );

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (error) {
    const response = errorResponse(error);

    if (response.status === 500) {
      console.error("Organization members retrieval failed:", error);
    }

    return response;
  }
}
