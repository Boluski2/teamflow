
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),

  transaction: vi.fn(),

  txInsert: vi.fn(),
  txValues: vi.fn(),
  txReturning: vi.fn(),

  txUpdate: vi.fn(),
  txSet: vi.fn(),
  txWhere: vi.fn(),

  txDelete: vi.fn(),
  txDeleteWhere: vi.fn(),
  txDeleteReturning: vi.fn(),

  requireOrganizationMembership: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/organizations/authorization", () => ({
  requireOrganizationMembership:
    mocks.requireOrganizationMembership,

  OrganizationAccessError: class OrganizationAccessError extends Error {
    code: string;

    constructor(code: string) {
      super(code);
      this.name = "OrganizationAccessError";
      this.code = code;
    }
  },
}));

import {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  updateTaskComment,
} from "./service";

const organizationId = "2508cbcc-c873-46c2-8fc9-148f378f2def";
const userId = "9f7849b6-c606-467b-beb9-1166ac7cff3b";
const otherUserId = "d9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";
const projectId = "b9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";
const taskId = "a9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";
const commentId = "e9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";

const organization = {
  id: organizationId,
  role: "member" as const,
};

const taskContext = {
  id: taskId,
  title: "Implement authentication",
  assigneeId: null as string | null,
  projectStatus: "active" as const,
};

const actor = {
  name: "Test User",
};

const comment = {
  id: commentId,
  organizationId,
  projectId,
  taskId,
  authorId: userId,
  authorName: actor.name,
  content: "This is a test comment",
  editedAt: null,
  createdAt: new Date("2026-11-09T09:00:00.000Z"),
  updatedAt: new Date("2026-11-09T09:00:00.000Z"),
};

describe("Comment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireOrganizationMembership.mockResolvedValue(
      organization,
    );

    // Standard select chain.
    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      innerJoin: mocks.innerJoin,
      where: mocks.where,
    });

    mocks.innerJoin.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      limit: mocks.limit,
      orderBy: mocks.orderBy,
    });

    mocks.limit.mockResolvedValue([taskContext]);
    mocks.orderBy.mockResolvedValue([comment]);

    // Transaction chain.
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        insert: mocks.txInsert,
        update: mocks.txUpdate,
        delete: mocks.txDelete,
      }),
    );

    mocks.txInsert.mockReturnValue({
      values: mocks.txValues,
    });

    mocks.txValues.mockReturnValue({
      returning: mocks.txReturning,
    });

    mocks.txReturning.mockResolvedValue([comment]);

    mocks.txUpdate.mockReturnValue({
      set: mocks.txSet,
    });

    mocks.txSet.mockReturnValue({
      where: mocks.txWhere,
    });

    mocks.txWhere.mockReturnValue({
      returning: mocks.txReturning,
    });

    mocks.txDelete.mockReturnValue({
      where: mocks.txDeleteWhere,
    });

    mocks.txDeleteWhere.mockReturnValue({
      returning: mocks.txDeleteReturning,
    });

    mocks.txDeleteReturning.mockResolvedValue([comment]);
  });

  describe("listTaskComments", () => {
    it("lists comments for an organization member", async () => {
      mocks.limit.mockResolvedValueOnce([taskContext]);

      const result = await listTaskComments(
        organizationId,
        projectId,
        taskId,
        userId,
      );

      expect(result).toEqual([comment]);

      expect(
        mocks.requireOrganizationMembership,
      ).toHaveBeenCalledWith(organizationId, userId);

      expect(mocks.orderBy).toHaveBeenCalledOnce();
    });

    it("allows viewers to read comments", async () => {
      mocks.requireOrganizationMembership.mockResolvedValue({
        ...organization,
        role: "viewer",
      });

      mocks.limit.mockResolvedValueOnce([taskContext]);

      const result = await listTaskComments(
        organizationId,
        projectId,
        taskId,
        userId,
      );

      expect(result).toEqual([comment]);
    });

    it("returns null when the task does not belong to the project", async () => {
      mocks.limit.mockResolvedValueOnce([]);

      const result = await listTaskComments(
        organizationId,
        projectId,
        taskId,
        userId,
      );

      expect(result).toBeNull();
      expect(mocks.orderBy).not.toHaveBeenCalled();
    });

    it("rejects users who are not organization members", async () => {
      mocks.requireOrganizationMembership.mockRejectedValue(
        new Error("NOT_FOUND"),
      );

      await expect(
        listTaskComments(
          organizationId,
          projectId,
          taskId,
          userId,
        ),
      ).rejects.toThrow("NOT_FOUND");

      expect(mocks.select).not.toHaveBeenCalled();
    });
  });

  describe("createTaskComment", () => {
    it.each(["owner", "admin", "member"] as const)(
      "allows %s to create a comment",
      async (role) => {
        mocks.requireOrganizationMembership.mockResolvedValue({
          ...organization,
          role,
        });

        mocks.limit
          .mockResolvedValueOnce([taskContext])
          .mockResolvedValueOnce([actor]);

        const result = await createTaskComment(
          organizationId,
          projectId,
          taskId,
          userId,
          { content: "  New comment  " },
        );

        expect(result).toEqual(comment);
        expect(mocks.transaction).toHaveBeenCalledOnce();

        expect(mocks.txValues).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            organizationId,
            projectId,
            taskId,
            authorId: userId,
            authorName: actor.name,
            content: "New comment",
          }),
        );

        expect(mocks.txValues).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            organizationId,
            projectId,
            taskId,
            actorId: userId,
            actorName: actor.name,
            type: "comment_created",
            metadata: expect.objectContaining({
              commentId,
              taskTitle: taskContext.title,
            }),
          }),
        );
      },
    );

    it("notifies the task assignee when another member comments", async () => {
      const assignedTaskContext = {
        ...taskContext,
        assigneeId: otherUserId,
      };

      mocks.limit
        .mockResolvedValueOnce([assignedTaskContext])
        .mockResolvedValueOnce([actor]);

      const result = await createTaskComment(
        organizationId,
        projectId,
        taskId,
        userId,
        { content: "Please review this implementation" },
      );

      expect(result).toEqual(comment);

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          organizationId,
          recipientId: otherUserId,
          actorId: userId,
          projectId,
          taskId,
          type: "task_comment_created",
          title: "New comment on your task",
          message: `${actor.name} commented on "${taskContext.title}".`,
          metadata: expect.objectContaining({
            commentId,
            taskTitle: taskContext.title,
            contentPreview: comment.content,
          }),
        }),
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("does not notify the assignee when they comment on their own task", async () => {
      const assignedTaskContext = {
        ...taskContext,
        assigneeId: userId,
      };

      mocks.limit
        .mockResolvedValueOnce([assignedTaskContext])
        .mockResolvedValueOnce([actor]);

      await createTaskComment(
        organizationId,
        projectId,
        taskId,
        userId,
        { content: "I have an update on this task" },
      );

      // Comment and activity are inserted, but no notification.
      expect(mocks.txValues).toHaveBeenCalledTimes(2);

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          authorId: userId,
          content: "I have an update on this task",
        }),
      );

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: "comment_created",
        }),
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("does not create a notification for an unassigned task", async () => {
      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([actor]);

      await createTaskComment(
        organizationId,
        projectId,
        taskId,
        userId,
        { content: "This task has no assignee" },
      );

      // Only the comment and activity are inserted.
      expect(mocks.txValues).toHaveBeenCalledTimes(2);

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: "comment_created",
        }),
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("rejects viewers from creating comments", async () => {
      mocks.requireOrganizationMembership.mockResolvedValue({
        ...organization,
        role: "viewer",
      });

      await expect(
        createTaskComment(
          organizationId,
          projectId,
          taskId,
          userId,
          { content: "New comment" },
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("returns null when the task does not exist", async () => {
      mocks.limit.mockResolvedValueOnce([]);

      const result = await createTaskComment(
        organizationId,
        projectId,
        taskId,
        userId,
        { content: "New comment" },
      );

      expect(result).toBeNull();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects comments on archived projects", async () => {
      mocks.limit.mockResolvedValueOnce([
        {
          ...taskContext,
          projectStatus: "archived",
        },
      ]);

      await expect(
        createTaskComment(
          organizationId,
          projectId,
          taskId,
          userId,
          { content: "New comment" },
        ),
      ).rejects.toThrow(
        "Cannot comment on tasks in an archived project",
      );

      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("updateTaskComment", () => {
    it("allows an author to edit their own comment", async () => {
      const updatedComment = {
        ...comment,
        content: "Updated comment",
        editedAt: new Date(),
      };

      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([comment])
        .mockResolvedValueOnce([actor]);

      mocks.txReturning.mockResolvedValueOnce([updatedComment]);

      const result = await updateTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
        { content: "Updated comment" },
      );

      expect(result).toEqual(updatedComment);
      expect(mocks.transaction).toHaveBeenCalledOnce();

      expect(mocks.txSet).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Updated comment",
          editedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      );

      expect(mocks.txValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "comment_updated",
          actorId: userId,
          metadata: expect.objectContaining({
            commentId,
            taskTitle: taskContext.title,
          }),
        }),
      );
    });

    it("allows owners to edit another member's comment", async () => {
      mocks.requireOrganizationMembership.mockResolvedValue({
        ...organization,
        role: "owner",
      });

      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([
          { ...comment, authorId: otherUserId },
        ])
        .mockResolvedValueOnce([actor]);

      await updateTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
        { content: "Moderated comment" },
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("allows admins to edit another member's comment", async () => {
      mocks.requireOrganizationMembership.mockResolvedValue({
        ...organization,
        role: "admin",
      });

      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([
          { ...comment, authorId: otherUserId },
        ])
        .mockResolvedValueOnce([actor]);

      await updateTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
        { content: "Moderated comment" },
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("rejects members editing another member's comment", async () => {
      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([
          { ...comment, authorId: otherUserId },
        ]);

      await expect(
        updateTaskComment(
          organizationId,
          projectId,
          taskId,
          commentId,
          userId,
          { content: "Unauthorized edit" },
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects viewers from editing comments", async () => {
      mocks.requireOrganizationMembership.mockResolvedValue({
        ...organization,
        role: "viewer",
      });

      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([comment]);

      await expect(
        updateTaskComment(
          organizationId,
          projectId,
          taskId,
          commentId,
          userId,
          { content: "Unauthorized edit" },
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("does not record activity when content is unchanged", async () => {
      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([comment]);

      const result = await updateTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
        { content: comment.content },
      );

      expect(result).toEqual(comment);
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("returns null when the comment does not exist", async () => {
      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([]);

      const result = await updateTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
        { content: "Updated comment" },
      );

      expect(result).toBeNull();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects editing comments in archived projects", async () => {
      mocks.limit
        .mockResolvedValueOnce([
          { ...taskContext, projectStatus: "archived" },
        ])
        .mockResolvedValueOnce([comment]);

      await expect(
        updateTaskComment(
          organizationId,
          projectId,
          taskId,
          commentId,
          userId,
          { content: "Updated comment" },
        ),
      ).rejects.toThrow(
        "Cannot edit comments in an archived project",
      );

      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("deleteTaskComment", () => {
    it("allows an author to delete their own comment", async () => {
      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([comment])
        .mockResolvedValueOnce([actor]);

      const result = await deleteTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
      );

      expect(result).toEqual(comment);
      expect(mocks.transaction).toHaveBeenCalledOnce();

      expect(mocks.txDelete).toHaveBeenCalledOnce();

      expect(mocks.txValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          projectId,
          taskId,
          actorId: userId,
          actorName: actor.name,
          type: "comment_deleted",
          metadata: expect.objectContaining({
            commentId,
            taskTitle: taskContext.title,
          }),
        }),
      );
    });

    it("allows an admin to delete another member's comment", async () => {
      mocks.requireOrganizationMembership.mockResolvedValue({
        ...organization,
        role: "admin",
      });

      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([
          { ...comment, authorId: otherUserId },
        ])
        .mockResolvedValueOnce([actor]);

      await deleteTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("rejects members deleting another member's comment", async () => {
      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([
          { ...comment, authorId: otherUserId },
        ]);

      await expect(
        deleteTaskComment(
          organizationId,
          projectId,
          taskId,
          commentId,
          userId,
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects viewers from deleting comments", async () => {
      mocks.requireOrganizationMembership.mockResolvedValue({
        ...organization,
        role: "viewer",
      });

      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([comment]);

      await expect(
        deleteTaskComment(
          organizationId,
          projectId,
          taskId,
          commentId,
          userId,
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("returns null when the comment does not exist", async () => {
      mocks.limit
        .mockResolvedValueOnce([taskContext])
        .mockResolvedValueOnce([]);

      const result = await deleteTaskComment(
        organizationId,
        projectId,
        taskId,
        commentId,
        userId,
      );

      expect(result).toBeNull();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects deleting comments in archived projects", async () => {
      mocks.limit
        .mockResolvedValueOnce([
          { ...taskContext, projectStatus: "archived" },
        ])
        .mockResolvedValueOnce([comment]);

      await expect(
        deleteTaskComment(
          organizationId,
          projectId,
          taskId,
          commentId,
          userId,
        ),
      ).rejects.toThrow(
        "Cannot delete comments in an archived project",
      );

      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });
});
