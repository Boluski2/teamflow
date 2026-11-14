
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  requireOrganizationMembership: vi.fn(),
  listOrganizationMembers: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/organizations/authorization", () => ({
  OrganizationAccessError: class OrganizationAccessError extends Error {
    constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
      this.name = "OrganizationAccessError";
    }
  },
  requireOrganizationMembership: mocks.requireOrganizationMembership,
}));

vi.mock("@/lib/organizations/list-organization-members", () => ({
  listOrganizationMembers: mocks.listOrganizationMembers,
}));

import { GET } from "./route";
import { OrganizationAccessError } from "@/lib/organizations/authorization";

const user = {
  id: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  clerkUserId: "user_test123",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
  isActive: true,
};

const organizationId = "2508cbcc-c873-46c2-8fc9-148f378f2def";

const members = [
  {
    id: user.id,
    name: "Test User",
    email: "test@example.com",
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

function createContext(id: string) {
  return {
    params: Promise.resolve({
      organizationId: id,
    }),
  };
}

function createRequest(id = organizationId) {
  return new Request(
    `http://localhost/api/organizations/${id}/members`,
  );
}

describe("GET /api/organizations/[organizationId]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.requireOrganizationMembership.mockResolvedValue({
      id: organizationId,
      role: "owner",
    });
    mocks.listOrganizationMembers.mockResolvedValue(members);
  });

  it("returns organization members for an authorized member", async () => {
    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.members).toHaveLength(2);
    expect(body.members[0].id).toBe(user.id);

    expect(mocks.ensureUser).toHaveBeenCalledOnce();
    expect(mocks.requireOrganizationMembership).toHaveBeenCalledWith(
      organizationId,
      user.id,
    );
    expect(mocks.listOrganizationMembers).toHaveBeenCalledWith(
      organizationId,
      user.id,
    );
  });

  it("returns an empty member list when the organization has no members", async () => {
    mocks.listOrganizationMembers.mockResolvedValue([]);

    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.members).toEqual([]);
  });

  it("returns 400 for an invalid organization ID", async () => {
    const response = await GET(
      createRequest("invalid"),
      createContext("invalid"),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid organization ID");
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.listOrganizationMembers).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not an organization member", async () => {
    mocks.requireOrganizationMembership.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe("Organization not found");
    expect(mocks.listOrganizationMembers).not.toHaveBeenCalled();
  });

  it("returns 403 when organization access is forbidden", async () => {
    mocks.requireOrganizationMembership.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    expect(response.status).toBe(403);
    expect(mocks.listOrganizationMembers).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Unauthorized"),
    );

    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    expect(response.status).toBe(401);
    expect(mocks.requireOrganizationMembership).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    expect(response.status).toBe(403);
    expect(mocks.listOrganizationMembers).not.toHaveBeenCalled();
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.listOrganizationMembers.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });

  it("does not retrieve members when membership verification fails", async () => {
    mocks.requireOrganizationMembership.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const response = await GET(
      createRequest(),
      createContext(organizationId),
    );

    expect(response.status).toBe(500);
    expect(mocks.listOrganizationMembers).not.toHaveBeenCalled();
  });
});
