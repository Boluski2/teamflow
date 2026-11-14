import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  createProject: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/projects/service", () => ({
  createProject: mocks.createProject,
  listProjects: mocks.listProjects,
}));

vi.mock("@/lib/organizations/authorization", () => ({
  OrganizationAccessError: class OrganizationAccessError extends Error {
    constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
      this.name = "OrganizationAccessError";
    }
  },
}));

import { GET, POST } from "./route";
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

const project = {
  id: "d47b6f1e-4f9c-4c52-a9df-43a71e8e8e15",
  organizationId,
  name: "Website Redesign",
  description: "Redesign the company website",
  status: "active",
  createdById: user.id,
  startDate: new Date("2026-11-09T00:00:00.000Z"),
  dueDate: new Date("2026-12-09T00:00:00.000Z"),
  createdAt: new Date("2026-11-09T00:00:00.000Z"),
  updatedAt: new Date("2026-11-09T00:00:00.000Z"),
};

function createContext(id = organizationId) {
  return {
    params: Promise.resolve({
      organizationId: id,
    }),
  };
}

function createPostRequest(body: unknown, id = organizationId) {
  return new Request(
    `http://localhost/api/organizations/${id}/projects`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("GET /api/organizations/[organizationId]/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.listProjects.mockResolvedValue([project]);
  });

  it("returns projects for an authorized organization member", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/projects`,
      ),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].id).toBe(project.id);

    expect(mocks.ensureUser).toHaveBeenCalledOnce();
    expect(mocks.listProjects).toHaveBeenCalledWith(
      organizationId,
      user.id,
    );
  });

  it("returns an empty project list when the organization has no projects", async () => {
    mocks.listProjects.mockResolvedValue([]);

    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/projects`,
      ),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.projects).toEqual([]);
  });

  it("returns 400 for an invalid organization ID", async () => {
    const response = await GET(
      new Request("http://localhost/api/organizations/invalid/projects"),
      createContext("invalid"),
    );

    expect(response.status).toBe(400);
    expect(mocks.listProjects).not.toHaveBeenCalled();
  });

  it("returns 404 when the organization does not exist or the user is not a member", async () => {
    mocks.listProjects.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/projects`,
      ),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe("Organization not found");
  });

  it("returns 403 when the user lacks permission to view projects", async () => {
    mocks.listProjects.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/projects`,
      ),
      createContext(),
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/projects`,
      ),
      createContext(),
    );

    expect(response.status).toBe(401);
    expect(mocks.listProjects).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/projects`,
      ),
      createContext(),
    );

    expect(response.status).toBe(403);
    expect(mocks.listProjects).not.toHaveBeenCalled();
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.listProjects.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/organizations/${organizationId}/projects`,
      ),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});

describe("POST /api/organizations/[organizationId]/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.createProject.mockResolvedValue(project);
  });

  it("creates a project with valid data", async () => {
    const input = {
      name: "Website Redesign",
      description: "Redesign the company website",
      startDate: "2026-11-09T00:00:00.000Z",
      dueDate: "2026-12-09T00:00:00.000Z",
    };

    const response = await POST(
      createPostRequest(input),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.project.id).toBe(project.id);

    expect(mocks.createProject).toHaveBeenCalledWith(
      organizationId,
      user.id,
      input,
    );
  });

  it("creates a project when optional fields are omitted", async () => {
    const input = {
      name: "Internal Tools",
    };

    const response = await POST(
      createPostRequest(input),
      createContext(),
    );

    expect(response.status).toBe(201);

    expect(mocks.createProject).toHaveBeenCalledWith(
      organizationId,
      user.id,
      input,
    );
  });

  it("returns 400 for an invalid organization ID", async () => {
    const response = await POST(
      createPostRequest({ name: "Website Redesign" }, "invalid"),
      createContext("invalid"),
    );

    expect(response.status).toBe(400);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const request = new Request(
      `http://localhost/api/organizations/${organizationId}/projects`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid-json",
      },
    );

    const response = await POST(request, createContext());

    expect(response.status).toBe(400);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("returns 400 when the project name is invalid", async () => {
    const response = await POST(
      createPostRequest({ name: "A" }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("returns 400 when the due date is earlier than the start date", async () => {
    const response = await POST(
      createPostRequest({
        name: "Website Redesign",
        startDate: "2026-12-09T00:00:00.000Z",
        dueDate: "2026-11-09T00:00:00.000Z",
      }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("rejects unexpected fields", async () => {
    const response = await POST(
      createPostRequest({
        name: "Website Redesign",
        status: "archived",
      }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("returns 404 when the organization does not exist or the user is not a member", async () => {
    mocks.createProject.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await POST(
      createPostRequest({ name: "Website Redesign" }),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the user lacks permission to create projects", async () => {
    mocks.createProject.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await POST(
      createPostRequest({ name: "Website Redesign" }),
      createContext(),
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await POST(
      createPostRequest({ name: "Website Redesign" }),
      createContext(),
    );

    expect(response.status).toBe(401);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await POST(
      createPostRequest({ name: "Website Redesign" }),
      createContext(),
    );

    expect(response.status).toBe(403);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.createProject.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await POST(
      createPostRequest({ name: "Website Redesign" }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});