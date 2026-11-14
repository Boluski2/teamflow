import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  getTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/tasks/service", () => ({
  deleteTask: mocks.deleteTask,
  getTask: mocks.getTask,
  updateTask: mocks.updateTask,
}));

vi.mock("@/lib/organizations/authorization", () => ({
  OrganizationAccessError: class OrganizationAccessError extends Error {
    constructor(public code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
    }
  },
}));

import { DELETE, GET, PATCH } from "./route";
import { OrganizationAccessError } from "@/lib/organizations/authorization";

const user = {
  id: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
};

const organizationId = "2508cbcc-c873-46c2-8fc9-148f378f2def";
const projectId = "b9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";
const taskId = "a9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";

const task = {
  id: taskId,
  organizationId,
  projectId,
  title: "Build task API",
  description: null,
  status: "todo",
  priority: "normal",
};

function createContext(
  overrides: Record<string, string> = {},
) {
  return {
    params: Promise.resolve({
      organizationId,
      projectId,
      taskId,
      ...overrides,
    }),
  };
}

function createPatchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Task detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureUser.mockResolvedValue(user);
  });

  describe("GET", () => {
    it("returns a task successfully", async () => {
      mocks.getTask.mockResolvedValue(task);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.task).toEqual(task);
      expect(mocks.getTask).toHaveBeenCalledWith(
        organizationId,
        projectId,
        taskId,
        user.id,
      );
    });

    it("returns 404 when the task does not exist", async () => {
      mocks.getTask.mockResolvedValue(null);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      expect(response.status).toBe(404);
    });

    it("rejects invalid organization IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext({ organizationId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.getTask).not.toHaveBeenCalled();
    });

    it("rejects invalid project IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext({ projectId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.getTask).not.toHaveBeenCalled();
    });

    it("rejects invalid task IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext({ taskId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.getTask).not.toHaveBeenCalled();
    });

    it("returns 403 when permission is denied", async () => {
      mocks.getTask.mockRejectedValue(
        new OrganizationAccessError("FORBIDDEN"),
      );

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      expect(response.status).toBe(403);
    });

    it("returns 401 when the user is unauthenticated", async () => {
      mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      expect(response.status).toBe(401);
    });
  });

  describe("PATCH", () => {
    it("updates a task successfully", async () => {
      const updatedTask = {
        ...task,
        title: "Updated task title",
      };

      mocks.updateTask.mockResolvedValue(updatedTask);

      const response = await PATCH(
        createPatchRequest({ title: "Updated task title" }),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.task).toEqual(updatedTask);
      expect(mocks.updateTask).toHaveBeenCalledWith(
        organizationId,
        projectId,
        taskId,
        user.id,
        { title: "Updated task title" },
      );
    });

    it("returns 404 when the task does not exist", async () => {
      mocks.updateTask.mockResolvedValue(null);

      const response = await PATCH(
        createPatchRequest({ title: "Updated task title" }),
        createContext(),
      );

      expect(response.status).toBe(404);
    });

    it("rejects invalid IDs", async () => {
      const response = await PATCH(
        createPatchRequest({ title: "Updated task title" }),
        createContext({ taskId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.updateTask).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON", async () => {
      const request = new NextRequest("http://localhost/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{invalid-json",
      });

      const response = await PATCH(request, createContext());

      expect(response.status).toBe(400);
      expect(mocks.updateTask).not.toHaveBeenCalled();
    });

    it("rejects an empty update payload", async () => {
      const response = await PATCH(
        createPatchRequest({}),
        createContext(),
      );

      expect(response.status).toBe(400);
      expect(mocks.updateTask).not.toHaveBeenCalled();
    });

    it("rejects unexpected request fields", async () => {
      const response = await PATCH(
        createPatchRequest({
          title: "Updated task title",
          organizationId,
        }),
        createContext(),
      );

      expect(response.status).toBe(400);
      expect(mocks.updateTask).not.toHaveBeenCalled();
    });

    it("returns 403 when update permission is denied", async () => {
      mocks.updateTask.mockRejectedValue(
        new OrganizationAccessError("FORBIDDEN"),
      );

      const response = await PATCH(
        createPatchRequest({ title: "Updated task title" }),
        createContext(),
      );

      expect(response.status).toBe(403);
    });

    it("returns 409 when updating a task in an archived project", async () => {
      mocks.updateTask.mockRejectedValue(
        new Error("Cannot update tasks in an archived project"),
      );

      const response = await PATCH(
        createPatchRequest({ title: "Updated task title" }),
        createContext(),
      );

      expect(response.status).toBe(409);
    });

    it("returns 500 with a safe message for unexpected errors", async () => {
      mocks.updateTask.mockRejectedValue(
        new Error("Sensitive database details"),
      );

      const response = await PATCH(
        createPatchRequest({ title: "Updated task title" }),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.message).toBe("Unable to complete task request");
      expect(body.message).not.toContain("Sensitive database details");
    });
  });
});

describe("DELETE", () => {
  it("deletes a task successfully", async () => {
    mocks.deleteTask.mockResolvedValue(task);

    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks", {
        method: "DELETE",
      }),
      createContext(),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Task deleted successfully");
    expect(mocks.deleteTask).toHaveBeenCalledWith(
      organizationId,
      projectId,
      taskId,
      user.id,
    );
  });

  it("returns 404 when the task does not exist", async () => {
    mocks.deleteTask.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks", {
        method: "DELETE",
      }),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("rejects invalid task IDs", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks", {
        method: "DELETE",
      }),
      createContext({ taskId: "invalid" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.deleteTask).not.toHaveBeenCalled();
  });

  it("returns 409 when the task has subtasks", async () => {
    mocks.deleteTask.mockRejectedValue(
      new Error("Cannot delete a task that has subtasks"),
    );

    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks", {
        method: "DELETE",
      }),
      createContext(),
    );

    expect(response.status).toBe(409);
  });

  it("returns 403 when deletion permission is denied", async () => {
    mocks.deleteTask.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks", {
        method: "DELETE",
      }),
      createContext(),
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await DELETE(
      new NextRequest("http://localhost/api/tasks", {
        method: "DELETE",
      }),
      createContext(),
    );

    expect(response.status).toBe(401);
  });
});