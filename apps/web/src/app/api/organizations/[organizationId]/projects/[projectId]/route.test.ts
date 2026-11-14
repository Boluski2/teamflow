
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
  updateProjectStatus: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/projects/service", () => ({
  getProject: mocks.getProject,
  updateProject: mocks.updateProject,
  updateProjectStatus: mocks.updateProjectStatus,
}));

vi.mock("@/lib/organizations/authorization", () => ({
  OrganizationAccessError: class OrganizationAccessError extends Error {
    constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
      this.name = "OrganizationAccessError";
    }
  },
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

const organizationId = "2508cbcc-c873-46c2-8fc9-148f378f2def";
const projectId = "a508cbcc-c873-46c2-8fc9-148f378f2def";

const project = {
  id: projectId,
  organizationId,
  name: "Website Redesign",
  description: "Redesign the company website",
  status: "active",
  createdById: user.id,
  startDate: new Date("2026-11-01T00:00:00.000Z"),
  dueDate: new Date("2026-12-01T00:00:00.000Z"),
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  updatedAt: new Date("2026-11-01T00:00:00.000Z"),
};

function createContext(
  orgId = organizationId,
  projId = projectId,
) {
  return {
    params: Promise.resolve({
      organizationId: orgId,
      projectId: projId,
    }),
  };
}

function createPatchRequest(body: unknown) {
  return new Request(
    `http://localhost/api/organizations/${organizationId}/projects/${projectId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("GET /api/organizations/[organizationId]/projects/[projectId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.getProject.mockResolvedValue(project);
  });

  it("returns project details for an authorized organization member", async () => {
    const response = await GET(
      new Request("http://localhost"),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.project.id).toBe(projectId);
    expect(body.project.organizationId).toBe(organizationId);

    expect(mocks.getProject).toHaveBeenCalledWith(
      organizationId,
      projectId,
      user.id,
    );
  });

  it("returns 400 for an invalid organization ID", async () => {
    const response = await GET(
      new Request("http://localhost"),
      createContext("invalid", projectId),
    );

    expect(response.status).toBe(400);
    expect(mocks.getProject).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid project ID", async () => {
    const response = await GET(
      new Request("http://localhost"),
      createContext(organizationId, "invalid"),
    );

    expect(response.status).toBe(400);
    expect(mocks.getProject).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist in the organization", async () => {
    mocks.getProject.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost"),
      createContext(),
    );

    expect(response.status).toBe(404);
    expect(mocks.getProject).toHaveBeenCalledWith(
      organizationId,
      projectId,
      user.id,
    );
  });

  it("returns 404 when the user is not a member of the organization", async () => {
    mocks.getProject.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await GET(
      new Request("http://localhost"),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the user lacks permission to view projects", async () => {
    mocks.getProject.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await GET(
      new Request("http://localhost"),
      createContext(),
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await GET(
      new Request("http://localhost"),
      createContext(),
    );

    expect(response.status).toBe(401);
    expect(mocks.getProject).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await GET(
      new Request("http://localhost"),
      createContext(),
    );

    expect(response.status).toBe(403);
    expect(mocks.getProject).not.toHaveBeenCalled();
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.getProject.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await GET(
      new Request("http://localhost"),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});

describe("PATCH /api/organizations/[organizationId]/projects/[projectId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.updateProject.mockResolvedValue({
      ...project,
      name: "Updated Website",
    });
        mocks.updateProjectStatus.mockImplementation(
        async (_orgId, _projId, _userId, input) => ({
            ...project,
            status: input.status,
        }),
        );
  });

  it("updates project details with valid data", async () => {
    const response = await PATCH(
      createPatchRequest({
        name: "Updated Website",
        description: "Updated project description",
      }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(mocks.updateProject).toHaveBeenCalledWith(
      organizationId,
      projectId,
      user.id,
      {
        name: "Updated Website",
        description: "Updated project description",
      },
    );

    expect(mocks.updateProjectStatus).not.toHaveBeenCalled();
  });

  it("allows clearing the project description", async () => {
    mocks.updateProject.mockResolvedValue({
      ...project,
      description: null,
    });

    const response = await PATCH(
      createPatchRequest({ description: null }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.project.description).toBeNull();
  });

  it("returns 400 for an invalid organization ID", async () => {
    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext("invalid", projectId),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid project ID", async () => {
    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext(organizationId, "invalid"),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const request = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    });

    const response = await PATCH(request, createContext());

    expect(response.status).toBe(400);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("rejects an invalid project name", async () => {
    const response = await PATCH(
      createPatchRequest({ name: "A" }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("rejects an empty update request", async () => {
    const response = await PATCH(
      createPatchRequest({}),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("rejects unexpected fields", async () => {
    const response = await PATCH(
      createPatchRequest({
        name: "Updated Website",
        organizationId: "another-organization",
      }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("rejects a due date earlier than the start date", async () => {
    const response = await PATCH(
      createPatchRequest({
        startDate: "2026-12-10T00:00:00.000Z",
        dueDate: "2026-12-01T00:00:00.000Z",
      }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("archives a project", async () => {
    const response = await PATCH(
      createPatchRequest({ status: "archived" }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(mocks.updateProjectStatus).toHaveBeenCalledWith(
      organizationId,
      projectId,
      user.id,
      { status: "archived" },
    );

    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("reactivates an archived project", async () => {
    const response = await PATCH(
      createPatchRequest({ status: "active" }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(mocks.updateProjectStatus).toHaveBeenCalledWith(
      organizationId,
      projectId,
      user.id,
      { status: "active" },
    );
  });

  it("rejects an invalid project status", async () => {
    const response = await PATCH(
      createPatchRequest({ status: "deleted" }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProjectStatus).not.toHaveBeenCalled();
  });

  it("rejects status updates mixed with other project fields", async () => {
    const response = await PATCH(
      createPatchRequest({
        status: "archived",
        name: "Updated Website",
      }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.updateProjectStatus).not.toHaveBeenCalled();
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist during an update", async () => {
    mocks.updateProject.mockResolvedValue(null);

    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the project does not exist during a status update", async () => {
    mocks.updateProjectStatus.mockResolvedValue(null);

    const response = await PATCH(
      createPatchRequest({ status: "archived" }),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the user is not a member of the organization", async () => {
    mocks.updateProject.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the user lacks permission to update projects", async () => {
    mocks.updateProject.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext(),
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext(),
    );

    expect(response.status).toBe(401);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext(),
    );

    expect(response.status).toBe(403);
    expect(mocks.updateProject).not.toHaveBeenCalled();
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.updateProject.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await PATCH(
      createPatchRequest({ name: "Updated Website" }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});
