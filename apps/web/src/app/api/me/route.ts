
import { NextResponse } from "next/server";

import { ensureUser } from "@/lib/auth/ensure-user";

export async function GET() {
  try {
    const user = await ensureUser();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
      },
    });
  } catch (error) {
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

    console.error("TeamFlow user synchronization failed", {
  errorName: error instanceof Error ? error.name : "UnknownError",
});

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
