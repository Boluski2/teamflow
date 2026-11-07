import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: mocks,
}));

import {
  acceptInvitation,
} from "./accept-invitation";

import { hashInvitationToken } from "./token";

const baseInput = {
  token: "a".repeat(43),
  userId: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  userEmail: "person@example.com",
};

const joinedAt = new Date("2026-11-06T12:00:00.000Z");

const acceptedResult = {
  status: "ACCEPTED",
  organizationId: "2508cbcc-c873-46c2-8fc9-148f378f2def",
  role: "member",
  joinedAt,
};

function mockAcceptanceResult(
  status: string,
  overrides: Record<string, unknown> = {},
) {
  mocks.execute.mockResolvedValue({
    rows: [
      {
        status,
        organizationId: null,
        role: null,
        joinedAt: null,
        ...overrides,
      },
    ],
  });
}

describe("acceptInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid invitation and returns its assigned role", async () => {
    mockAcceptanceResult("ACCEPTED", {
      organizationId: acceptedResult.organizationId,
      role: "member",
      joinedAt,
    });

    const result = await acceptInvitation(baseInput);

    expect(result).toEqual({
      organizationId: acceptedResult.organizationId,
      role: "member",
      joinedAt,
    });

    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("normalizes the authenticated user's email", async () => {
    mockAcceptanceResult("ACCEPTED", {
      organizationId: acceptedResult.organizationId,
      role: "member",
      joinedAt,
    });

    await acceptInvitation({
      ...baseInput,
      userEmail: " PERSON@EXAMPLE.COM ",
    });

    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["invalid invitation", "NOT_FOUND"],
    ["expired invitation", "EXPIRED"],
    ["already accepted invitation", "ALREADY_ACCEPTED"],
    ["email mismatch", "EMAIL_MISMATCH"],
    ["existing membership", "ALREADY_MEMBER"],
  ] as const)(
    "rejects an invitation when there is %s",
    async (_description, status) => {
      mockAcceptanceResult(status);

      await expect(
        acceptInvitation(baseInput),
      ).rejects.toMatchObject({
        code: status,
      });

      expect(mocks.execute).toHaveBeenCalledTimes(1);
    },
  );

  it("uses a hashed token rather than the raw invitation token", async () => {
    mockAcceptanceResult("ACCEPTED", {
      organizationId: acceptedResult.organizationId,
      role: "member",
      joinedAt,
    });

    await acceptInvitation(baseInput);

    const query = mocks.execute.mock.calls[0][0];

    expect(query).toBeDefined();

    const expectedHash = hashInvitationToken(baseInput.token);

    expect(expectedHash).not.toBe(baseInput.token);
    expect(expectedHash).toHaveLength(64);
  });

  it("rejects malformed tokens before executing a database query", async () => {
    await expect(
      acceptInvitation({
        ...baseInput,
        token: "invalid-token",
      }),
    ).rejects.toThrow("Invalid invitation token format");

    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rejects a missing database result", async () => {
    mocks.execute.mockResolvedValue({
      rows: [],
    });

    await expect(
      acceptInvitation(baseInput),
    ).rejects.toThrow("Invitation acceptance failed");
  });

  it("does not return the invitation token or token hash", async () => {
    mockAcceptanceResult("ACCEPTED", {
      organizationId: acceptedResult.organizationId,
      role: "member",
      joinedAt,
    });

    const result = await acceptInvitation(baseInput);
    const serializedResult = JSON.stringify(result);

    expect(serializedResult).not.toContain(baseInput.token);
    expect(serializedResult).not.toContain(
      hashInvitationToken(baseInput.token),
    );
  });
});
