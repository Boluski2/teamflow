
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockEnsureUser,
  mockUpdateTaskComment,
  mockDeleteTaskComment,
} = vi.hoisted(() => ({
  mockEnsureUser: vi.fn(),
  mockUpdateTaskComment: vi.fn(),
  mockDeleteTaskComment: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mockEnsureUser,
}));

vi.mock("@/lib/comments/service", () => ({
  updateTaskComment: mockUpdateTaskComment,
  deleteTaskComment: mockDeleteTaskComment,
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

import { PATCH, DELETE } from "./route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";
const commentId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";

const comment = {
  id: commentId,
  organizationId,
  projectId,
  taskId,
  authorId: userId,
  authorName: "Test User",
  content: "Updated comment",
  editedAt: new Date("2026-11-10T10:00:00.000Z"),
  createdAt: new Date("2026-11-10T09:00:00.000Z"),
  updatedAt: new Date("2026-11-10T10:00:00.000Z"),
};

function createContext(
  overrides: Partial<{
    organizationId: string;
    projectId: string;
    taskId: string;
    commentId: string;
  }> = {},
) {
  return {
    params: Promise.resolve({
      organizationId: overrides.organizationId ?? organizationId,
      projectId: overrides.projectId ?? projectId,
      taskId: overrides.taskId ?? taskId,
      commentId: overrides.commentId ?? commentId,
    }),
  };
}

function createPatchRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/organizations/${organizationId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function createMalformedPatchRequest() {
  return new NextRequest(
    `http://localhost/api/organizations/${organizationId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    },
  );
}

function createDeleteRequest() {
  return new NextRequest(
    `http://localhost/api/organizations/${organizationId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    { method: "DELETE" },
  );
}

describe("PATCH /api/organizations/[organizationId]/projects/[projectId]/tasks/[taskId]/comments/[commentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEnsureUser.mockResolvedValue({ id: userId });
    mockUpdateTaskComment.mockResolvedValue(comment);
  });

  it("updates a comment successfully", async () => {
    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Comment updated successfully",
      comment: {
        ...comment,
        editedAt: comment.editedAt.toISOString(),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      },
    });

    expect(mockUpdateTaskComment).toHaveBeenCalledWith(
      organizationId,
      projectId,
      taskId,
      commentId,
      userId,
      { content: "Updated comment" },
    );
  });

  it("trims comment content before calling the service", async () => {
    await PATCH(
      createPatchRequest({ content: "  Updated comment  " }),
      createContext(),
    );

    expect(mockUpdateTaskComment).toHaveBeenCalledWith(
      organizationId,
      projectId,
      taskId,
      commentId,
      userId,
      { content: "Updated comment" },
    );
  });

  it("rejects invalid organization IDs", async () => {
    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext({ organizationId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("rejects invalid project IDs", async () => {
    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext({ projectId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("rejects invalid task IDs", async () => {
    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext({ taskId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("rejects invalid comment IDs", async () => {
    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext({ commentId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await PATCH(
      createMalformedPatchRequest(),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("rejects empty comment content", async () => {
    const response = await PATCH(
      createPatchRequest({ content: "   " }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("rejects content exceeding 5000 characters", async () => {
    const response = await PATCH(
      createPatchRequest({ content: "a".repeat(5001) }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("rejects unexpected request fields", async () => {
    const response = await PATCH(
      createPatchRequest({
        content: "Updated comment",
        authorId: userId,
      }),
      createContext(),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateTaskComment).not.toHaveBeenCalled();
  });

  it("returns 404 when the comment or task does not exist", async () => {
    mockUpdateTaskComment.mockResolvedValue(null);

    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the user is forbidden", async () => {
    mockUpdateTaskComment.mockRejectedValue(
      new Error("FORBIDDEN"),
    );

    const { OrganizationAccessError } = await import(
      "@/lib/organizations/authorization"
    );

    mockUpdateTaskComment.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext(),
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when the project is archived", async () => {
    mockUpdateTaskComment.mockRejectedValue(
      new Error("Cannot edit comments in an archived project"),
    );

    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext(),
    );

    expect(response.status).toBe(409);
  });

  it("returns a safe 500 response for unexpected errors", async () => {
    mockUpdateTaskComment.mockRejectedValue(
      new Error("Unexpected database failure"),
    );

    const response = await PATCH(
      createPatchRequest({ content: "Updated comment" }),
      createContext(),
    );

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.message).not.toContain("Unexpected database failure");
  });
});

describe("DELETE /api/organizations/[organizationId]/projects/[projectId]/tasks/[taskId]/comments/[commentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEnsureUser.mockResolvedValue({ id: userId });
    mockDeleteTaskComment.mockResolvedValue(comment);
  });

  it("deletes a comment successfully", async () => {
    const response = await DELETE(
      createDeleteRequest(),
      createContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "Comment deleted successfully",
    });

    expect(mockDeleteTaskComment).toHaveBeenCalledWith(
      organizationId,
      projectId,
      taskId,
      commentId,
      userId,
    );
  });

  it("rejects invalid organization IDs", async () => {
    const response = await DELETE(
      createDeleteRequest(),
      createContext({ organizationId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockDeleteTaskComment).not.toHaveBeenCalled();
  });

  it("rejects invalid project IDs", async () => {
    const response = await DELETE(
      createDeleteRequest(),
      createContext({ projectId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockDeleteTaskComment).not.toHaveBeenCalled();
  });

  it("rejects invalid task IDs", async () => {
    const response = await DELETE(
      createDeleteRequest(),
      createContext({ taskId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockDeleteTaskComment).not.toHaveBeenCalled();
  });

  it("rejects invalid comment IDs", async () => {
    const response = await DELETE(
      createDeleteRequest(),
      createContext({ commentId: "invalid-id" }),
    );

    expect(response.status).toBe(400);
    expect(mockDeleteTaskComment).not.toHaveBeenCalled();
  });

  it("returns 404 when the comment or task does not exist", async () => {
    mockDeleteTaskComment.mockResolvedValue(null);

    const response = await DELETE(
      createDeleteRequest(),
      createContext(),
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the user is forbidden", async () => {
    const { OrganizationAccessError } = await import(
      "@/lib/organizations/authorization"
    );

    mockDeleteTaskComment.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(),
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when the project is archived", async () => {
    mockDeleteTaskComment.mockRejectedValue(
      new Error("Cannot delete comments in an archived project"),
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(),
    );

    expect(response.status).toBe(409);
  });

  it("returns a safe 500 response for unexpected errors", async () => {
    mockDeleteTaskComment.mockRejectedValue(
      new Error("Unexpected database failure"),
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(),
    );

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.message).not.toContain("Unexpected database failure");
  });
});
