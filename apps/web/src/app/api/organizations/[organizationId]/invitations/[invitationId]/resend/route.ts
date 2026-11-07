
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  OrganizationAccessError,
  requireOrganizationPermission,
} from "@/lib/organizations/authorization";
import { resendInvitationEmail } from "@/lib/invitations/resend-invitation-email";

const uuidSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{
    organizationId: string;
    invitationId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    // 1. Authenticate and synchronize the current user.
    const user = await ensureUser();

    // 2. Validate route parameters.
    const { organizationId, invitationId } = await params;

    const parsedOrganizationId = uuidSchema.safeParse(organizationId);
    const parsedInvitationId = uuidSchema.safeParse(invitationId);

    if (!parsedOrganizationId.success || !parsedInvitationId.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization or invitation ID",
        },
        { status: 400 },
      );
    }

    // 3. Verify invitation permission and retrieve organization details.
    const organization = await requireOrganizationPermission(
      parsedOrganizationId.data,
      user.id,
      "members.invite",
    );

    // 4. Claim and resend the invitation.
    const result = await resendInvitationEmail({
      invitationId: parsedInvitationId.data,
      organizationId: parsedOrganizationId.data,
      inviterName: user.name,
      organizationName: organization.name,
    });

    // 5. Handle invitation state.
    if (result.status === "not_found") {
      return NextResponse.json(
        {
          success: false,
          message: "Invitation not found",
        },
        { status: 404 },
      );
    }

    if (result.status === "already_accepted") {
      return NextResponse.json(
        {
          success: false,
          message: "This invitation has already been accepted",
        },
        { status: 409 },
      );
    }

    if (
      result.status === "sending" ||
      result.status === "not_claimed"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "An invitation email delivery attempt is already in progress",
        },
        { status: 409 },
      );
    }

    // 6. Handle email delivery results.
    if (result.status === "failed") {
      return NextResponse.json(
        {
          success: false,
          message: "Invitation renewed, but email delivery failed",
          emailDelivery: {
            status: "failed",
            reason: result.reason,
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.recorded
          ? "Invitation renewed and email sent successfully"
          : "Invitation renewed, but email delivery status could not be saved",
        emailDelivery: {
          status: result.recorded ? "sent" : "unconfirmed",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof OrganizationAccessError) {
      return NextResponse.json(
        {
          success: false,
          message:
            error.code === "NOT_FOUND"
              ? "Organization not found"
              : "You do not have permission to resend invitations",
        },
        {
          status: error.code === "NOT_FOUND" ? 404 : 403,
        },
      );
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Your TeamFlow account has been deactivated"
    ) {
      return NextResponse.json(
        { success: false, message: "Account deactivated" },
        { status: 403 },
      );
    }

    console.error("Invitation resend request failed");

    return NextResponse.json(
      {
        success: false,
        message: "Unable to complete invitation resend request",
      },
      { status: 500 },
    );
  }
}
