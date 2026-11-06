
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  requireOrganizationMembership: vi.fn(),
  requireOrganizationPermission: vi.fn(),
  updateOrganization: vi.fn(),
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
  requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

vi.mock("@/lib/organizations/update-organization", () => ({
  updateOrganization: mocks.updateOrganization,
}));

import { GET, PATCH } from "./route";
import { OrganizationAccessError } from "@/lib/organizations/authorization";

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
  createdById: user.id,
  createdAt: new Date("2026-11-04T22:57:07.900Z"),
  updatedAt: new Date("2026-11-04T22:57:07.900Z"),
  role: "owner",
  joinedAt: new Date("2026-11-04T22:57:07.900Z"),
};

const organizationId = organization.id;

function createContext(id: string) {
  return {
    params: Promise.resolve({
      organizationId: id,
    }),
  };
}

function createPatchRequest(
  body: unknown,
  id = organizationId,
) {
  return new Request(
    `http://localhost/api/organizations/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("GET /api/organizations/[organizationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.requireOrganizationMembership.mockResolvedValue(organization);
  });

  it("returns organization details for an authorized member", async () => {
    const response = await GET(
      new Request(`http://localhost/api/organizations/${organizationId}`),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.organization.id).toBe(organizationId);
    expect(body.organization.role).toBe("owner");

    expect(mocks.ensureUser).toHaveBeenCalledOnce();
    expect(mocks.requireOrganizationMembership).toHaveBeenCalledWith(
      organizationId,
      user.id,
    );
  });

  it("returns 400 for an invalid organization ID", async () => {
    const response = await GET(
      new Request("http://localhost/api/organizations/invalid"),
      createContext("invalid"),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid organization ID");

    expect(mocks.requireOrganizationMembership).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not a member", async () => {
    mocks.requireOrganizationMembership.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await GET(
      new Request(`http://localhost/api/organizations/${organizationId}`),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe("Organization not found");
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await GET(
      new Request(`http://localhost/api/organizations/${organizationId}`),
      createContext(organizationId),
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await GET(
      new Request(`http://localhost/api/organizations/${organizationId}`),
      createContext(organizationId),
    );

    expect(response.status).toBe(403);
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.requireOrganizationMembership.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await GET(
      new Request(`http://localhost/api/organizations/${organizationId}`),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});

describe("PATCH /api/organizations/[organizationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.requireOrganizationPermission.mockResolvedValue(organization);
    mocks.updateOrganization.mockResolvedValue({
      id: organizationId,
      name: "Updated Workspace",
      slug: organization.slug,
      description: "Updated description",
      createdById: user.id,
      createdAt: organization.createdAt,
      updatedAt: new Date(),
    });
  });

  it.each(["owner", "admin"] as const)(
    "allows an organization %s to update settings",
    async (role) => {
      const response = await PATCH(
        createPatchRequest({
          name: "Updated Workspace",
          description: "Updated description",
        }),
        createContext(organizationId),
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.organization.name).toBe("Updated Workspace");

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        user.id,
        "organization.update",
      );

      expect(mocks.updateOrganization).toHaveBeenCalledWith(
        organizationId,
        {
          name: "Updated Workspace",
          description: "Updated description",
        },
      );

      void role;
    },
  );

  it.each(["member", "viewer"] as const)(
    "rejects an organization %s from updating settings",
    async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new OrganizationAccessError("FORBIDDEN"),
      );

      const response = await PATCH(
        createPatchRequest({ name: "Unauthorized update" }),
        createContext(organizationId),
      );

      expect(response.status).toBe(403);
      expect(mocks.updateOrganization).not.toHaveBeenCalled();
    },
  );

  it("returns 400 for an invalid organization ID", async () => {
    const response = await PATCH(
      createPatchRequest({ name: "Updated Workspace" }, "invalid"),
      createContext("invalid"),
    );

    expect(response.status).toBe(400);
    expect(mocks.requireOrganizationPermission).not.toHaveBeenCalled();
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const request = new Request(
      `http://localhost/api/organizations/${organizationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{invalid-json",
      },
    );

    const response = await PATCH(
      request,
      createContext(organizationId),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("returns 400 when the organization data is invalid", async () => {
    const response = await PATCH(
      createPatchRequest({ name: "A" }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid organization data");
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("rejects an empty update request", async () => {
    const response = await PATCH(
      createPatchRequest({}),
      createContext(organizationId),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not a member", async () => {
    mocks.requireOrganizationPermission.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await PATCH(
      createPatchRequest({ name: "Updated Workspace" }),
      createContext(organizationId),
    );

    expect(response.status).toBe(404);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await PATCH(
      createPatchRequest({ name: "Updated Workspace" }),
      createContext(organizationId),
    );

    expect(response.status).toBe(401);
    expect(mocks.requireOrganizationPermission).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await PATCH(
      createPatchRequest({ name: "Updated Workspace" }),
      createContext(organizationId),
    );

    expect(response.status).toBe(403);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("returns 404 when the organization disappears before the update", async () => {
    mocks.updateOrganization.mockResolvedValue(null);

    const response = await PATCH(
      createPatchRequest({ name: "Updated Workspace" }),
      createContext(organizationId),
    );

    expect(response.status).toBe(404);
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.updateOrganization.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await PATCH(
      createPatchRequest({ name: "Updated Workspace" }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});
