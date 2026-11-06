import { NextResponse } from "next/server";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  AcceptInvitationError,
  acceptInvitation,
} from "@/lib/invitations/accept-invitation";
import { acceptInvitationSchema } from "@/lib/invitations/schema";

export async function POST(request: Request) {
  try {
    // 1. Authenticate and synchronize the Clerk user.
    // ensureUser also enforces a verified primary email.
    const user = await ensureUser();

    // 2. Parse request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    // 3. Validate the invitation token.
    const validation = acceptInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid invitation token",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // 4. Accept using trusted server-side identity.
    const result = await acceptInvitation({
      token: validation.data.token,
      userId: user.id,
      userEmail: user.email,
    });

    // 5. Return only safe acceptance details.
    return NextResponse.json(
      {
        message: "Invitation accepted successfully",
        organizationId: result.organizationId,
        role: result.role,
        joinedAt: result.joinedAt.toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    // Invitation-specific errors.
    if (error instanceof AcceptInvitationError) {
      switch (error.code) {
        case "NOT_FOUND":
          return NextResponse.json(
            { error: "Invitation not found" },
            { status: 404 },
          );

        case "EXPIRED":
          return NextResponse.json(
            { error: "This invitation has expired" },
            { status: 410 },
          );

        case "ALREADY_ACCEPTED":
          return NextResponse.json(
            { error: "This invitation has already been accepted" },
            { status: 409 },
          );

        case "EMAIL_MISMATCH":
          return NextResponse.json(
            {
              error:
                "This invitation was sent to a different email address",
            },
            { status: 403 },
          );

        case "ALREADY_MEMBER":
          return NextResponse.json(
            {
              error:
                "You are already a member of this organization",
            },
            { status: 409 },
          );
      }
    }

    // Authentication and account-state errors.
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      if (
        error.message ===
        "Your TeamFlow account has been deactivated"
      ) {
        return NextResponse.json(
          { error: "Your account has been deactivated" },
          { status: 403 },
        );
      }
    }

    // Never expose internal database or server errors.
    console.error("Invitation acceptance failed:", error);

    return NextResponse.json(
      { error: "Unable to accept invitation" },
      { status: 500 },
    );
  }
}