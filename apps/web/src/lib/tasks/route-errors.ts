import { NextResponse } from "next/server";
import { OrganizationAccessError } from "@/lib/organizations/authorization";

export function taskRouteError(error: unknown, action: string) {
  if (error instanceof OrganizationAccessError) {
    return NextResponse.json(
      {
        success: false,
        message:
          error.code === "NOT_FOUND"
            ? "Organization not found"
            : "You do not have permission to access this task resource",
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

    if (error.message === "Your TeamFlow account has been deactivated") {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 },
      );
    }

    const conflictMessages = [
      "Cannot create tasks in an archived project",
      "Cannot update tasks in an archived project",
      "A task cannot be a parent of its own ancestor",
      "Circular task hierarchy detected",
      "Cannot delete tasks in an archived project",
      "Cannot delete a task that has subtasks",

        // Comment conflicts
      "Cannot comment on tasks in an archived project",
      "Cannot edit comments in an archived project",
      "Cannot delete comments in an archived project",
    ];

    if (conflictMessages.includes(error.message)) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 },
      );
    }

    const validationMessages = [
      "Assignee is not a member of this organization",
      "Parent task not found in this project",
    ];

    if (validationMessages.includes(error.message)) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }
  }

  console.error(`${action} failed:`, error);

  return NextResponse.json(
    {
      success: false,
      message: "Unable to complete task request",
    },
    { status: 500 },
  );
}