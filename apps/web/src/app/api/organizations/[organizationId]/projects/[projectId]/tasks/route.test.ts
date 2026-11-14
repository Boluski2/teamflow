import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/tasks/service", () => ({
  listTasks: mocks.listTasks,
  createTask: mocks.createTask,
}));

vi.mock("@/lib/organizations/authorization", () => ({
  OrganizationAccessError: class OrganizationAccessError extends Error {
    constructor(public code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
    }
  },
}));

import { GET, POST } from "./route";
import { OrganizationAccessError } from "@/lib/organizations/authorization";

const user = {
  id: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
};

const organizationId = "2508cbcc-c873-46c2-8fc9-148f378f2def";
const projectId = "b9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";

const task = {
  id: "a9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1",
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
      ...overrides,
    }),
  };
}

function createPostRequest(body: unknown) {
  return new NextRequest(
    "http://localhost/api/tasks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("Task collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureUser.mockResolvedValue(user);
  });

  describe("GET", () => {
    it("returns tasks for an authorized project", async () => {
      mocks.listTasks.mockResolvedValue([task]);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.tasks).toEqual([task]);
      expect(mocks.listTasks).toHaveBeenCalledWith(
        organizationId,
        projectId,
        user.id,
      );
    });

    it("returns an empty task list", async () => {
      mocks.listTasks.mockResolvedValue([]);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.tasks).toEqual([]);
    });

    it("rejects invalid organization IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext({ organizationId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.listTasks).not.toHaveBeenCalled();
    });

    it("rejects invalid project IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext({ projectId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.listTasks).not.toHaveBeenCalled();
    });

    it("returns 404 when the project does not exist", async () => {
      mocks.listTasks.mockResolvedValue(null);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      expect(response.status).toBe(404);
    });

    it("returns 403 when permission is denied", async () => {
      mocks.listTasks.mockRejectedValue(
        new OrganizationAccessError("FORBIDDEN"),
      );

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      expect(response.status).toBe(403);
    });

    it("returns 401 for unauthenticated requests", async () => {
      mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

      const response = await GET(
        new NextRequest("http://localhost/api/tasks"),
        createContext(),
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST", () => {
    it("creates a task successfully", async () => {
      mocks.createTask.mockResolvedValue(task);

      const response = await POST(
        createPostRequest({
          title: "Build task API",
        }),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.task).toEqual(task);
      expect(mocks.createTask).toHaveBeenCalledWith(
        organizationId,
        projectId,
        user.id,
        expect.objectContaining({
          title: "Build task API",
          priority: "normal",
          status: "todo",
        }),
      );
    });

    it("rejects invalid organization or project IDs", async () => {
      const response = await POST(
        createPostRequest({ title: "Build task API" }),
        createContext({ projectId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.createTask).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON", async () => {
      const request = new NextRequest("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{invalid-json",
      });

      const response = await POST(request, createContext());

      expect(response.status).toBe(400);
      expect(mocks.createTask).not.toHaveBeenCalled();
    });

    it("rejects invalid task data", async () => {
      const response = await POST(
        createPostRequest({ title: "A" }),
        createContext(),
      );

      expect(response.status).toBe(400);
      expect(mocks.createTask).not.toHaveBeenCalled();
    });

    it("rejects unexpected request fields", async () => {
      const response = await POST(
        createPostRequest({
          title: "Build task API",
          organizationId,
          unexpected: true,
        }),
        createContext(),
      );

      expect(response.status).toBe(400);
      expect(mocks.createTask).not.toHaveBeenCalled();
    });

    it("returns 404 when the project does not exist", async () => {
      mocks.createTask.mockResolvedValue(null);

      const response = await POST(
        createPostRequest({ title: "Build task API" }),
        createContext(),
      );

      expect(response.status).toBe(404);
    });

    it("returns 403 when task creation permission is denied", async () => {
      mocks.createTask.mockRejectedValue(
        new OrganizationAccessError("FORBIDDEN"),
      );

      const response = await POST(
        createPostRequest({ title: "Build task API" }),
        createContext(),
      );

      expect(response.status).toBe(403);
    });

    it("returns 500 with a safe message for unexpected errors", async () => {
      mocks.createTask.mockRejectedValue(
        new Error("Sensitive database details"),
      );

      const response = await POST(
        createPostRequest({ title: "Build task API" }),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.message).toBe("Unable to complete task request");
      expect(body.message).not.toContain("Sensitive database details");
    });
  });
});