
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureUser } from "@/lib/auth/ensure-user";
import {
  OrganizationAccessError,
  requireOrganizationPermission,
} from "@/lib/organizations/authorization";
import {
  createInvitation,
  InvitationServiceError,
} from "@/lib/invitations/create-invitation";
import { createInvitationSchema } from "@/lib/invitations/schema";
import { deliverInvitationEmail } from "@/lib/invitations/deliver-invitation-email";

type RouteContext = {
  params: Promise<{
    organizationId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  try {
    // 1. Authenticate and synchronize the current user.
    const user = await ensureUser();

    // 2. Validate the organization ID.
    const { organizationId } = await params;
    const parsedId = z.string().uuid().safeParse(organizationId);

    if (!parsedId.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization ID",
        },
        { status: 400 },
      );
    }

    // 3. Verify invitation permission and retrieve organization details.
    const organization = await requireOrganizationPermission(
      parsedId.data,
      user.id,
      "members.invite",
    );

    // 4. Parse the request body.
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

    // 5. Validate and normalize invitation details.
    const validation = createInvitationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid invitation data",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // 6. Create the invitation.
    const result = await createInvitation({
      organizationId: parsedId.data,
      inviterId: user.id,
      inviterRole: organization.role,
      email: validation.data.email,
      role: validation.data.role,
    });

    // 7. Attempt email delivery.
    const delivery = await deliverInvitationEmail({
      invitationId: result.invitation.id,
      token: result.token,
      inviterName: user.name,
      organizationName: organization.name,
    });

    // 8. Return safe invitation and delivery information.
    // const emailDeliveryStatus =
    //   delivery.status === "sent"
    //     ? delivery.recorded
    //       ? "sent"
    //       : "unconfirmed"
    //     : delivery.status;

    // const message =
    //   delivery.status === "sent"
    //     ? delivery.recorded
    //       ? "Invitation created and email sent successfully"
    //       : "Invitation created, but email delivery status could not be saved"
    //     : delivery.status === "failed"
    //       ? "Invitation created, but email delivery failed"
    //       : "Invitation created, but email delivery was not started";

    // return NextResponse.json(
    //   {
    //     success: true,
    //     message,
    //     invitation: result.invitation,
    //     emailDelivery: {
    //       status: emailDeliveryStatus,
    //     },
    //   },
    //   { status: 201 },
    // 8. Return safe invitation and delivery information.
const emailDeliveryStatus =
  delivery.status === "sent"
    ? delivery.recorded
      ? "sent"
      : "unconfirmed"
    : delivery.status;

const message =
  delivery.status === "sent"
    ? delivery.recorded
      ? "Invitation created and email sent successfully"
      : "Invitation created, but email delivery status could not be saved"
    : delivery.status === "failed"
      ? "Invitation created, but email delivery failed"
      : "Invitation created, but email delivery was not started";

// 9. Expose an acceptance URL only in development.
const development =
  process.env.NODE_ENV === "development"
    ? {
        acceptanceUrl: (() => {
          const url = new URL("/invitations/accept", request.url);
          url.searchParams.set("token", result.token);
          return url.toString();
        })(),
      }
    : undefined;

return NextResponse.json(
  {
    success: true,
    message,
    invitation: result.invitation,
    emailDelivery: {
      status: emailDeliveryStatus,
    },
    ...(development ? { development } : {}),
  },
  { status: 201 },
);
  } catch (error) {
    if (error instanceof OrganizationAccessError) {
      return NextResponse.json(
        {
          success: false,
          message:
            error.code === "NOT_FOUND"
              ? "Organization not found"
              : "You do not have permission to invite members",
        },
        {
          status: error.code === "NOT_FOUND" ? 404 : 403,
        },
      );
    }

    if (error instanceof InvitationServiceError) {
      const responses = {
        FORBIDDEN_ROLE: {
          message: "You cannot invite a user with this role",
          status: 403,
        },
        ALREADY_MEMBER: {
          message: "This user is already a member of the organization",
          status: 409,
        },
        PENDING_INVITATION_EXISTS: {
          message: "A pending invitation already exists for this email",
          status: 409,
        },
      } as const;

      const response = responses[error.code];

      return NextResponse.json(
        {
          success: false,
          message: response.message,
        },
        { status: response.status },
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

    console.error("Invitation creation or email delivery failed");

    return NextResponse.json(
      {
        success: false,
        message: "Unable to complete invitation request",
      },
      { status: 500 },
    );
  }
}
