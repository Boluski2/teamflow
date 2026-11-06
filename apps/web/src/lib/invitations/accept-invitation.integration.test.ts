
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  invitations,
  memberships,
  organizations,
  users,
} from "@/lib/db/schema";

import {
  acceptInvitation,
  AcceptInvitationError,
} from "./accept-invitation";

import {
  generateInvitationToken,
  hashInvitationToken,
} from "./token";

type TestData = {
  inviterUserId: string;
  inviteeUserId: string;
  concurrentUserId: string;
  inviteeEmail: string;
  concurrentEmail: string;
  organizationId: string;
  invitationToken: string;
  concurrentInvitationToken: string;
};

let testData: TestData | undefined;

describe("acceptInvitation - Neon integration", () => {
  beforeAll(async () => {
    const suffix = randomUUID();

    const inviterUserId = randomUUID();
    const inviteeUserId = randomUUID();
    const concurrentUserId = randomUUID();
    const organizationId = randomUUID();

    const inviterEmail = `inviter-${suffix}@example.com`;
    const inviteeEmail = `invitee-${suffix}@example.com`;
    const concurrentEmail = `concurrent-${suffix}@example.com`;

    const invitationToken = generateInvitationToken();
    const concurrentInvitationToken = generateInvitationToken();

    // Create test users.
    await db.insert(users).values([
      {
        id: inviterUserId,
        clerkUserId: `clerk_${randomUUID()}`,
        email: inviterEmail,
        name: "Integration Test Inviter",
      },
      {
        id: inviteeUserId,
        clerkUserId: `clerk_${randomUUID()}`,
        email: inviteeEmail,
        name: "Integration Test Invitee",
      },
      {
        id: concurrentUserId,
        clerkUserId: `clerk_${randomUUID()}`,
        email: concurrentEmail,
        name: "Integration Test Concurrent Invitee",
      },
    ]);

    // Create a test organization.
    await db.insert(organizations).values({
      id: organizationId,
      name: `Invitation Integration Test ${suffix}`,
      slug: `invitation-test-${suffix}`,
      createdById: inviterUserId,
    });

    // Create two independent invitations.
    await db.insert(invitations).values([
      {
        organizationId,
        email: inviteeEmail,
        role: "member",
        tokenHash: hashInvitationToken(invitationToken),
        invitedById: inviterUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        organizationId,
        email: concurrentEmail,
        role: "member",
        tokenHash: hashInvitationToken(concurrentInvitationToken),
        invitedById: inviterUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ]);

    testData = {
      inviterUserId,
      inviteeUserId,
      concurrentUserId,
      inviteeEmail,
      concurrentEmail,
      organizationId,
      invitationToken,
      concurrentInvitationToken,
    };
  }, 30000);

  afterAll(async () => {
    if (!testData) {
      return;
    }

    const userIds = [
      testData.inviterUserId,
      testData.inviteeUserId,
      testData.concurrentUserId,
    ];

    // Delete dependent records before their referenced records.
    await db
      .delete(invitations)
      .where(eq(invitations.organizationId, testData.organizationId));

    await db
      .delete(memberships)
      .where(eq(memberships.organizationId, testData.organizationId));

    await db
      .delete(organizations)
      .where(eq(organizations.id, testData.organizationId));

    await db
      .delete(users)
      .where(inArray(users.id, userIds));
  }, 30000);

  it("creates membership and marks the invitation as accepted", async () => {
    if (!testData) {
      throw new Error("Integration test data was not initialized");
    }

    const result = await acceptInvitation({
      token: testData.invitationToken,
      userId: testData.inviteeUserId,
      userEmail: testData.inviteeEmail,
    });

    expect(result.organizationId).toBe(testData.organizationId);
    expect(result.role).toBe("member");
    expect(result.joinedAt).toBeInstanceOf(Date);

    const membership = await db.execute(sql`
      SELECT organization_id, user_id, role
      FROM memberships
      WHERE organization_id = ${testData.organizationId}::uuid
        AND user_id = ${testData.inviteeUserId}::uuid
    `);

    expect(membership.rows).toHaveLength(1);
    expect(membership.rows[0].role).toBe("member");

    const invitation = await db.execute(sql`
      SELECT accepted_at
      FROM invitations
      WHERE token_hash = ${hashInvitationToken(testData.invitationToken)}
    `);

    expect(invitation.rows).toHaveLength(1);
    expect(invitation.rows[0].accepted_at).not.toBeNull();
  });

  it("rejects a second acceptance attempt", async () => {
    if (!testData) {
      throw new Error("Integration test data was not initialized");
    }

    await expect(
      acceptInvitation({
        token: testData.invitationToken,
        userId: testData.inviteeUserId,
        userEmail: testData.inviteeEmail,
      }),
    ).rejects.toMatchObject({
      code: "ALREADY_ACCEPTED",
    });
  });

  it("allows only one of two concurrent acceptance attempts", async () => {
    if (!testData) {
      throw new Error("Integration test data was not initialized");
    }

    const results = await Promise.allSettled([
      acceptInvitation({
        token: testData.concurrentInvitationToken,
        userId: testData.concurrentUserId,
        userEmail: testData.concurrentEmail,
      }),
      acceptInvitation({
        token: testData.concurrentInvitationToken,
        userId: testData.concurrentUserId,
        userEmail: testData.concurrentEmail,
      }),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );

    const rejected = results.filter(
      (result) => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(AcceptInvitationError);
      expect(rejected[0].reason.code).toBe("ALREADY_ACCEPTED");
    }

    const membership = await db.execute(sql`
      SELECT organization_id, user_id, role
      FROM memberships
      WHERE organization_id = ${testData.organizationId}::uuid
        AND user_id = ${testData.concurrentUserId}::uuid
    `);

    expect(membership.rows).toHaveLength(1);
    expect(membership.rows[0].role).toBe("member");
  });
});
