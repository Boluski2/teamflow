
import { NextResponse } from "next/server";

import { ensureUser } from "@/lib/auth/ensure-user";
import { createOrganization } from "@/lib/organizations/create-organization";
import { createOrganizationSchema } from "@/lib/organizations/schema";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";

export async function POST(request: Request) {
  // Validate JSON input.
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

  // Validate organization fields.
  const validation = createOrganizationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    // Resolve the authenticated TeamFlow user.
    const user = await ensureUser();

    // Create organization and owner membership.
    const organization = await createOrganization(
      validation.data,
      user.id,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Organization created successfully",
        organization,
      },
      { status: 201 },
    );
  } catch (error) {
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
    }

    console.error("Organization creation failed");

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create organization",
      },
      { status: 500 },
    );
  }
}


export async function GET() {
  try {
    const user = await ensureUser();

    const organizationList = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: organizations.description,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        role: memberships.role,
        joinedAt: memberships.joinedAt,
      })
      .from(memberships)
      .innerJoin(
        organizations,
        eq(memberships.organizationId, organizations.id),
      )
      .where(eq(memberships.userId, user.id))
      .orderBy(desc(memberships.joinedAt));

    return NextResponse.json({
      success: true,
      organizations: organizationList,
    });
  } catch (error) {
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
    }

    console.error("Organization listing failed");

    return NextResponse.json(
      {
        success: false,
        message: "Unable to retrieve organizations",
      },
      { status: 500 },
    );
  }
}