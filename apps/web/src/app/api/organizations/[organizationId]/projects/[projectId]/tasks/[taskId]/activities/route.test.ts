
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockEnsureUser, mockListTaskActivities } = vi.hoisted(() => ({
  mockEnsureUser: vi.fn(),
  mockListTaskActivities: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mockEnsureUser,
}));

vi.mock("@/lib/activities/service", () => ({
  listTaskActivities: mockListTaskActivities,
}));

vi.mock("@/lib/organizations/authorization", () => {
  class OrganizationAccessError extends Error {
    code: "NOT_FOUND" | "FORBIDDEN";

    constructor(code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
      this.name = "OrganizationAccessError";
      this.code = code;
    }
  }

  return { OrganizationAccessError };
});

import { GET } from "./route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";
const userId = "55555555-5555-4555-8555-555555555555";

const activities = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    organizationId,
    projectId,
    taskId,
    actorId: userId,
    actorName: "Test User",
    type: "task_created",
    metadata: {
      taskTitle: "Prepare project documentation",
    },
    createdAt: new Date("2026-11-10T09:00:00.000Z"),
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    organizationId,
    projectId,
    taskId,
    actorId: userId,
    actorName: "Test User",
    type: "task_status_changed",
    metadata: {
      previousStatus: "todo",
      newStatus: "in_progress",
    },
    createdAt: new Date("2026-11-10T10:00:00.000Z"),
  },
];

function createContext(
  overrides: Partial<{
    organizationId: string;
    projectId: string;
    taskId: string;
  }> = {},
) {
  return {
    params: Promise.resolve({
      organizationId: overrides.organizationId ?? organizationId,
      projectId: overrides.projectId ?? projectId,
      taskId: overrides.taskId ?? taskId,
    }),
  };
}

function createRequest() {
  return new NextRequest(
    `http://localhost/api/organizations/${organizationId}/projects/${projectId}/tasks/${taskId}/activities`,
  );
}

describe("GET /api/organizations/[organizationId]/projects/[projectId]/tasks/[taskId]/activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEnsureUser.mockResolvedValue({ id: userId });
    mockListTaskActivities.mockResolvedValue(activities);
  });

  it("returns task activities successfully", async () => {
    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      activities: activities.map((activity) => ({
        ...activity,
        createdAt: activity.createdAt.toISOString(),
      })),
    });

    expect(mockListTaskActivities).toHaveBeenCalledWith(
      organizationId,
      projectId,
      taskId,
      userId,
    );
  });

  it("returns an empty activity list when no activities exist", async () => {
    mockListTaskActivities.mockResolvedValue([]);

    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      activities: [],
    });
  });

  it("rejects an invalid organization ID", async () => {
    const response = await GET(
      createRequest(),
      createContext({ organizationId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockListTaskActivities).not.toHaveBeenCalled();
  });

  it("rejects an invalid project ID", async () => {
    const response = await GET(
      createRequest(),
      createContext({ projectId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockListTaskActivities).not.toHaveBeenCalled();
  });

  it("rejects an invalid task ID", async () => {
    const response = await GET(
      createRequest(),
      createContext({ taskId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockListTaskActivities).not.toHaveBeenCalled();
  });

  it("returns 404 when the task does not exist", async () => {
    mockListTaskActivities.mockResolvedValue(null);

    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "Task not found",
    });
  });

  it("returns 403 when the user is forbidden", async () => {
    const { OrganizationAccessError } = await import(
      "@/lib/organizations/authorization"
    );

    mockListTaskActivities.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(403);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mockEnsureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(401);
    expect(mockListTaskActivities).not.toHaveBeenCalled();
  });

  it("returns a safe 500 response for unexpected errors", async () => {
    mockListTaskActivities.mockRejectedValue(
      new Error("Unexpected database failure"),
    );

    const response = await GET(createRequest(), createContext());

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.message).not.toContain("Unexpected database failure");
  });
});
