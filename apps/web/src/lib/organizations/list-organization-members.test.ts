
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  requireOrganizationMembership: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/lib/organizations/authorization", () => ({
  requireOrganizationMembership: mocks.requireOrganizationMembership,
}));

import { listOrganizationMembers } from "./list-organization-members";

const organizationId = "2508cbcc-c873-46c2-8fc9-148f378f2def";
const userId = "9f7849b6-c606-467b-beb9-1166ac7cff3b";

const members = [
  {
    id: userId,
    name: "Adebolu Babatunde",
    email: "bolu@example.com",
    avatarUrl: null,
    role: "owner",
    joinedAt: new Date("2026-11-04T22:57:07.900Z"),
  },
  {
    id: "a1b2c3d4-e5f6-4789-8123-456789abcdef",
    name: "Another Member",
    email: "member@example.com",
    avatarUrl: "https://example.com/avatar.png",
    role: "member",
    joinedAt: new Date("2026-11-05T10:00:00.000Z"),
  },
];

describe("listOrganizationMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireOrganizationMembership.mockResolvedValue({
      id: organizationId,
    });

    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      innerJoin: mocks.innerJoin,
    });

    mocks.innerJoin.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      orderBy: mocks.orderBy,
    });

    mocks.orderBy.mockResolvedValue(members);
  });

  it("returns organization members with their required details", async () => {
    const result = await listOrganizationMembers(
      organizationId,
      userId,
    );

    expect(result).toEqual(members);
    expect(result).toHaveLength(2);

    expect(result[0]).toMatchObject({
      id: userId,
      name: "Adebolu Babatunde",
      email: "bolu@example.com",
      avatarUrl: null,
      role: "owner",
    });

    expect(result[1]).toMatchObject({
      name: "Another Member",
      role: "member",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  it("checks organization membership before querying members", async () => {
    await listOrganizationMembers(organizationId, userId);

    expect(mocks.requireOrganizationMembership).toHaveBeenCalledOnce();
    expect(mocks.requireOrganizationMembership).toHaveBeenCalledWith(
      organizationId,
      userId,
    );

    expect(mocks.select).toHaveBeenCalledOnce();
  });

  it("returns an empty array when the organization has no members", async () => {
    mocks.orderBy.mockResolvedValue([]);

    const result = await listOrganizationMembers(
      organizationId,
      userId,
    );

    expect(result).toEqual([]);
  });

  it("rejects users who are not organization members", async () => {
    mocks.requireOrganizationMembership.mockRejectedValue(
      new Error("Organization not found"),
    );

    await expect(
      listOrganizationMembers(organizationId, "another-user-id"),
    ).rejects.toThrow("Organization not found");

    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("does not expose database errors as successful results", async () => {
    mocks.orderBy.mockRejectedValue(
      new Error("Database connection failed"),
    );

    await expect(
      listOrganizationMembers(organizationId, userId),
    ).rejects.toThrow("Database connection failed");
  });
});
