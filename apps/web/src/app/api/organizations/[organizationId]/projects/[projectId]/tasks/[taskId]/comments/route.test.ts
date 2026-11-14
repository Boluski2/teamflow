
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  listTaskComments: vi.fn(),
  createTaskComment: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/comments/service", () => ({
  listTaskComments: mocks.listTaskComments,
  createTaskComment: mocks.createTaskComment,
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
const taskId = "a9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";

const comment = {
  id: "c9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1",
  organizationId,
  projectId,
  taskId,
  authorId: user.id,
  authorName: "Test User",
  content: "This is a test comment",
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

function createPostRequest(body: unknown) {
  return new NextRequest(
    "http://localhost/api/tasks/comments",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("Task comments collection API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureUser.mockResolvedValue(user);
  });

  describe("GET", () => {
    it("returns comments for an authorized task", async () => {
      mocks.listTaskComments.mockResolvedValue([comment]);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.comments).toEqual([comment]);
      expect(mocks.listTaskComments).toHaveBeenCalledWith(
        organizationId,
        projectId,
        taskId,
        user.id,
      );
    });

    it("returns an empty comment list", async () => {
      mocks.listTaskComments.mockResolvedValue([]);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.comments).toEqual([]);
    });

    it("rejects invalid organization IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext({ organizationId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.listTaskComments).not.toHaveBeenCalled();
    });

    it("rejects invalid project IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext({ projectId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.listTaskComments).not.toHaveBeenCalled();
    });

    it("rejects invalid task IDs", async () => {
      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext({ taskId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.listTaskComments).not.toHaveBeenCalled();
    });

    it("returns 404 when the task does not exist", async () => {
      mocks.listTaskComments.mockResolvedValue(null);

      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext(),
      );

      expect(response.status).toBe(404);
    });

    it("returns 403 when permission is denied", async () => {
      mocks.listTaskComments.mockRejectedValue(
        new OrganizationAccessError("FORBIDDEN"),
      );

      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext(),
      );

      expect(response.status).toBe(403);
    });

    it("returns 401 for unauthenticated requests", async () => {
      mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

      const response = await GET(
        new NextRequest("http://localhost/api/tasks/comments"),
        createContext(),
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST", () => {
    it("creates a comment successfully", async () => {
      mocks.createTaskComment.mockResolvedValue(comment);

      const response = await POST(
        createPostRequest({
          content: "  This is a test comment  ",
        }),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.comment).toEqual(comment);

      expect(mocks.createTaskComment).toHaveBeenCalledWith(
        organizationId,
        projectId,
        taskId,
        user.id,
        {
          content: "This is a test comment",
        },
      );
    });

    it("rejects invalid route IDs", async () => {
      const response = await POST(
        createPostRequest({
          content: "This is a test comment",
        }),
        createContext({ taskId: "invalid" }),
      );

      expect(response.status).toBe(400);
      expect(mocks.createTaskComment).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON", async () => {
      const request = new NextRequest(
        "http://localhost/api/tasks/comments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{invalid-json",
        },
      );

      const response = await POST(request, createContext());

      expect(response.status).toBe(400);
      expect(mocks.createTaskComment).not.toHaveBeenCalled();
    });

    it("rejects empty comments", async () => {
      const response = await POST(
        createPostRequest({ content: "   " }),
        createContext(),
      );

      expect(response.status).toBe(400);
      expect(mocks.createTaskComment).not.toHaveBeenCalled();
    });

    it("rejects comments exceeding 5000 characters", async () => {
      const response = await POST(
        createPostRequest({ content: "a".repeat(5001) }),
        createContext(),
      );

      expect(response.status).toBe(400);
      expect(mocks.createTaskComment).not.toHaveBeenCalled();
    });

    it("rejects unexpected request fields", async () => {
      const response = await POST(
        createPostRequest({
          content: "This is a test comment",
          authorId: user.id,
        }),
        createContext(),
      );

      expect(response.status).toBe(400);
      expect(mocks.createTaskComment).not.toHaveBeenCalled();
    });

    it("returns 404 when the task does not exist", async () => {
      mocks.createTaskComment.mockResolvedValue(null);

      const response = await POST(
        createPostRequest({
          content: "This is a test comment",
        }),
        createContext(),
      );

      expect(response.status).toBe(404);
    });

    it("returns 403 when comment creation is forbidden", async () => {
      mocks.createTaskComment.mockRejectedValue(
        new OrganizationAccessError("FORBIDDEN"),
      );

      const response = await POST(
        createPostRequest({
          content: "This is a test comment",
        }),
        createContext(),
      );

      expect(response.status).toBe(403);
    });

    it("returns 409 when commenting on an archived project", async () => {
      mocks.createTaskComment.mockRejectedValue(
        new Error("Cannot comment on tasks in an archived project"),
      );

      const response = await POST(
        createPostRequest({
          content: "This is a test comment",
        }),
        createContext(),
      );

      expect(response.status).toBe(409);
    });

    it("returns 500 with a safe message for unexpected errors", async () => {
      mocks.createTaskComment.mockRejectedValue(
        new Error("Sensitive database details"),
      );

      const response = await POST(
        createPostRequest({
          content: "This is a test comment",
        }),
        createContext(),
      );

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.message).toBe("Unable to complete task request");
      expect(body.message).not.toContain("Sensitive database details");
    });
  });
});
