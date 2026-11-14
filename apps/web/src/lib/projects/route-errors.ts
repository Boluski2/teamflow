
import { NextResponse } from "next/server";

import { OrganizationAccessError } from "@/lib/organizations/authorization";

export function projectRouteError(
  error: unknown,
  action: string,
) {
  if (error instanceof OrganizationAccessError) {
    return NextResponse.json(
      {
        success: false,
        message:
          error.code === "NOT_FOUND"
            ? "Organization not found"
            : "You do not have permission to access this project resource",
      },
      { status: error.code === "NOT_FOUND" ? 404 : 403 },
    );
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    if (
      error.message ===
      "Your TeamFlow account has been deactivated"
    ) {
      return NextResponse.json(
        { success: false, message: "Account deactivated" },
        { status: 403 },
      );
    }

    if (
      error.message ===
      "Due date cannot be earlier than start date"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 },
      );
    }
  }

  console.error(`${action} failed:`, error);

  return NextResponse.json(
    {
      success: false,
      message: "Unable to complete project request",
    },
    { status: 500 },
  );
}
