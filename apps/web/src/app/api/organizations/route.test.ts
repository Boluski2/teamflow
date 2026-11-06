
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  createOrganization: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/organizations/create-organization", () => ({
  createOrganization: mocks.createOrganization,
}));
vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));



vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    execute: mocks.execute,
  },
}));

import { GET, POST } from "./route";

const user = {
  id: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  clerkUserId: "user_test123",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
  isActive: true,
};

const organization = {
  id: "2508cbcc-c873-46c2-8fc9-148f378f2def",
  name: "Boluski Workspace",
  slug: "boluski-workspace-c7871420",
  description: "My first TeamFlow organization",
  createdAt: new Date("2026-11-04T22:57:07.900Z"),
  updatedAt: new Date("2026-11-04T22:57:07.900Z"),
  role: "owner",
  joinedAt: new Date("2026-11-04T22:57:07.900Z"),
};

describe("GET /api/organizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);

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

    mocks.orderBy.mockResolvedValue([organization]);
  });

  it("returns the authenticated user's organizations", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.organizations).toEqual([
  {
    ...organization,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    joinedAt: organization.joinedAt.toISOString(),
  },
]);

    expect(mocks.ensureUser).toHaveBeenCalledOnce();
    expect(mocks.select).toHaveBeenCalledOnce();
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Unauthorized"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      message: "Unauthorized",
    });
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Account deactivated");
  });

  it("returns an empty list when the user has no organizations", async () => {
    mocks.orderBy.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      organizations: [],
    });
  });

  it("returns a generic 500 response for unexpected errors", async () => {
    mocks.orderBy.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      message: "Unable to retrieve organizations",
    });

    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});



describe("POST /api/organizations", () => {
  const validInput = {
    name: "TeamFlow Workspace",
    description: "A workspace for the team",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.createOrganization.mockResolvedValue(organization);
  });

  it("creates an organization successfully", async () => {
    const response = await POST(
      new Request("http://localhost/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validInput),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Organization created successfully");
    expect(body.organization.id).toBe(organization.id);

    expect(mocks.ensureUser).toHaveBeenCalledOnce();
    expect(mocks.createOrganization).toHaveBeenCalledWith(
      validInput,
      user.id,
    );
  });

  it("returns 400 when the request body contains invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid json",
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid JSON request body");

    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("returns 400 when organization input fails validation", async () => {
    const response = await POST(
      new Request("http://localhost/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "A",
          description: "Invalid organization",
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Validation failed");
    expect(body.errors.name).toBeDefined();

    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Unauthorized"),
    );

    const response = await POST(
      new Request("http://localhost/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validInput),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");

    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await POST(
      new Request("http://localhost/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validInput),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Account deactivated");

    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.createOrganization.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await POST(
      new Request("http://localhost/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validInput),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      message: "Unable to create organization",
    });

    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});
