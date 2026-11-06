
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: mocks,
}));

import {
  createInvitation,
  InvitationServiceError,
} from "./create-invitation";

function createSelectQuery(result: unknown[]) {
  const query: any = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };

  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);

  return query;
}

function createUpdateQuery(result: unknown[]) {
  const query: any = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(result),
  };

  query.set.mockReturnValue(query);
  query.where.mockReturnValue(query);

  return query;
}

function createInsertQuery(result: unknown[]) {
  const query: any = {
    values: vi.fn(),
    returning: vi.fn().mockResolvedValue(result),
  };

  query.values.mockReturnValue(query);

  return query;
}

const baseInput = {
  organizationId: "2508cbcc-c873-46c2-8fc9-148f378f2def",
  inviterId: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  inviterRole: "owner" as const,
  email: "person@example.com",
  role: "member" as const,
};

const invitationResult = {
  id: "7c6c50e0-6c88-4a5c-9eb7-2f7353c7b5f1",
  organizationId: baseInput.organizationId,
  email: baseInput.email,
  role: "member" as const,
  invitedById: baseInput.inviterId,
  expiresAt: new Date("2026-11-13T12:00:00.000Z"),
  createdAt: new Date("2026-11-06T12:00:00.000Z"),
};

function mockNoExistingRecords() {
  mocks.select
    .mockReturnValueOnce(createSelectQuery([]))
    .mockReturnValueOnce(createSelectQuery([]));
}

describe("createInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["member", "viewer"] as const)(
    "rejects %s users from inviting",
    async (inviterRole) => {
      await expect(
        createInvitation({
          ...baseInput,
          inviterRole,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN_ROLE",
      });

      expect(mocks.select).not.toHaveBeenCalled();
    },
  );

  it("prevents admins from inviting other admins", async () => {
    await expect(
      createInvitation({
        ...baseInput,
        inviterRole: "admin",
        role: "admin",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN_ROLE",
    });

    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("allows admins to invite members", async () => {
    mockNoExistingRecords();

    const updateQuery = createUpdateQuery([]);
    mocks.update.mockReturnValue(updateQuery);

    const insertQuery = createInsertQuery([invitationResult]);
    mocks.insert.mockReturnValue(insertQuery);

    const result = await createInvitation({
      ...baseInput,
      inviterRole: "admin",
    });

    expect(result.invitation).toEqual(invitationResult);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("rejects an email that already belongs to an organization member", async () => {
    mocks.select.mockReturnValueOnce(
      createSelectQuery([{ userId: "existing-user-id" }]),
    );

    await expect(
      createInvitation(baseInput),
    ).rejects.toMatchObject({
      code: "ALREADY_MEMBER",
    });

    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects an existing unexpired pending invitation", async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    mocks.select
      .mockReturnValueOnce(createSelectQuery([]))
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: "existing-invitation",
            expiresAt: futureDate,
          },
        ]),
      );

    await expect(
      createInvitation(baseInput),
    ).rejects.toMatchObject({
      code: "PENDING_INVITATION_EXISTS",
    });

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("reuses an expired pending invitation", async () => {
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    mocks.select
      .mockReturnValueOnce(createSelectQuery([]))
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: invitationResult.id,
            expiresAt: expiredDate,
          },
        ]),
      );

    const updateQuery = createUpdateQuery([invitationResult]);
    mocks.update.mockReturnValue(updateQuery);

    const result = await createInvitation(baseInput);

    expect(result.invitation).toEqual(invitationResult);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates a new invitation when no pending invitation exists", async () => {
    mockNoExistingRecords();

    const updateQuery = createUpdateQuery([]);
    mocks.update.mockReturnValue(updateQuery);

    const insertQuery = createInsertQuery([invitationResult]);
    mocks.insert.mockReturnValue(insertQuery);

    const result = await createInvitation({
      ...baseInput,
      email: "  PERSON@Example.COM ",
    });

    expect(result.invitation).toEqual(invitationResult);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const insertedValues = insertQuery.values.mock.calls[0][0];

    expect(insertedValues.email).toBe("person@example.com");
    expect(insertedValues.tokenHash).not.toBe(result.token);
    expect(insertedValues.role).toBe("member");
  });


it("converts a concurrent duplicate insert into a conflict error", async () => {
  mockNoExistingRecords();

  const updateQuery = createUpdateQuery([]);
  mocks.update.mockReturnValue(updateQuery);

  const insertQuery = createInsertQuery([]);
  insertQuery.returning.mockRejectedValue({
    code: "23505",
    message: "Unique constraint violation",
  });

  mocks.insert.mockReturnValue(insertQuery);

  await expect(
    createInvitation(baseInput),
  ).rejects.toMatchObject({
    code: "PENDING_INVITATION_EXISTS",
  });

  expect(mocks.insert).toHaveBeenCalledTimes(1);
});

});
