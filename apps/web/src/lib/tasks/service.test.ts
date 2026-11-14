
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),

  transaction: vi.fn(),
  txInsert: vi.fn(),
  txValues: vi.fn(),
  txUpdate: vi.fn(),
  txSet: vi.fn(),
  txWhere: vi.fn(),
  txReturning: vi.fn(),
  txDelete: vi.fn(),
  txDeleteWhere: vi.fn(),
  txDeleteReturning: vi.fn(),

  requireOrganizationPermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.delete,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/organizations/authorization", () => ({
  requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "./service";

const organizationId = "2508cbcc-c873-46c2-8fc9-148f378f2def";
const userId = "9f7849b6-c606-467b-beb9-1166ac7cff3b";
const projectId = "b9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";
const taskId = "a9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";
const assigneeId = "d9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";
const parentTaskId = "e9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";

const organization = {
  id: organizationId,
  name: "Boluski Workspace",
};

const project = {
  id: projectId,
  organizationId,
  status: "active" as const,
};

const actor = {
  name: "Test User",
};

const task = {
  id: taskId,
  organizationId,
  projectId,
  parentTaskId: null,
  title: "Implement authentication",
  description: "Build authentication functionality",
  status: "todo" as const,
  priority: "normal" as const,
  assigneeId: null,
  createdById: userId,
  dueDate: null,
  position: 0,
  createdAt: new Date("2026-11-09T09:00:00.000Z"),
  updatedAt: new Date("2026-11-09T09:00:00.000Z"),
  completedAt: null,
};

const assignedTask = {
  ...task,
  assigneeId,
};

describe("Task service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireOrganizationPermission.mockReset();
    mocks.requireOrganizationPermission.mockResolvedValue(organization);

    // Standard select chain
    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      orderBy: mocks.orderBy,
      limit: mocks.limit,
      returning: mocks.returning,
    });

    mocks.orderBy.mockResolvedValue([task]);
    mocks.limit.mockResolvedValue([project]);
    mocks.returning.mockResolvedValue([task]);

    // Standard insert chain
    mocks.insert.mockReturnValue({
      values: mocks.values,
    });

    mocks.values.mockReturnValue({
      returning: mocks.returning,
    });

    // Standard update chain
    mocks.update.mockReturnValue({
      set: mocks.set,
    });

    mocks.set.mockReturnValue({
      where: mocks.where,
    });

    // Standard delete chain
    mocks.delete.mockReturnValue({
      where: mocks.where,
    });

    // Transaction mock
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        insert: mocks.txInsert,
        update: mocks.txUpdate,
        delete: mocks.txDelete,
      }),
    );

    // Transaction insert chain
    mocks.txInsert.mockReturnValue({
      values: mocks.txValues,
    });

    mocks.txValues.mockReturnValue({
      returning: mocks.txReturning,
    });

    // Transaction update chain
    mocks.txUpdate.mockReturnValue({
      set: mocks.txSet,
    });

    mocks.txSet.mockReturnValue({
      where: mocks.txWhere,
    });

    mocks.txWhere.mockReturnValue({
      returning: mocks.txReturning,
    });

    // Transaction delete chain
    mocks.txDelete.mockReturnValue({
      where: mocks.txDeleteWhere,
    });

    mocks.txDeleteWhere.mockReturnValue({
      returning: mocks.txDeleteReturning,
    });

    mocks.txDeleteReturning.mockResolvedValue([task]);
    mocks.txReturning.mockResolvedValue([task]);
  });

  describe("createTask", () => {
    const input = {
      title: "Implement authentication",
      description: "Build authentication functionality",
      status: "todo" as const,
      priority: "normal" as const,
      assigneeId: null,
      parentTaskId: null,
      dueDate: null,
    };

    it("creates a task within an authorized active project", async () => {
      mocks.limit
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([actor]);

      const result = await createTask(
        organizationId,
        projectId,
        userId,
        input,
      );

      expect(result).toEqual(task);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "tasks.create",
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          organizationId,
          projectId,
          title: input.title,
          description: input.description,
          status: "todo",
          priority: "normal",
          createdById: userId,
          parentTaskId: null,
          assigneeId: null,
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
          type: "task_created",
        }),
      );
    });

    it("notifies the assignee when creating an assigned task", async () => {
      const newlyAssignedTask = {
        ...task,
        assigneeId,
      };

      mocks.limit
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([{ userId: assigneeId }])
        .mockResolvedValueOnce([actor]);

      mocks.txReturning.mockResolvedValueOnce([newlyAssignedTask]);

      const result = await createTask(
        organizationId,
        projectId,
        userId,
        {
          ...input,
          assigneeId,
        },
      );

      expect(result).toEqual(newlyAssignedTask);

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          organizationId,
          recipientId: assigneeId,
          actorId: userId,
          projectId,
          taskId,
          type: "task_assigned",
          title: "Task assigned to you",
        }),
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("rejects task creation when permission is denied", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        createTask(organizationId, projectId, userId, input),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("returns null when the project does not exist", async () => {
      mocks.limit.mockResolvedValueOnce([]);

      const result = await createTask(
        organizationId,
        projectId,
        userId,
        input,
      );

      expect(result).toBeNull();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects task creation in an archived project", async () => {
      mocks.limit.mockResolvedValueOnce([
        { ...project, status: "archived" },
      ]);

      await expect(
        createTask(organizationId, projectId, userId, input),
      ).rejects.toThrow("Cannot create tasks in an archived project");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("requires assignment permission when assigning a task", async () => {
      mocks.requireOrganizationPermission
        .mockResolvedValueOnce(organization)
        .mockRejectedValueOnce(new Error("FORBIDDEN"));

      await expect(
        createTask(organizationId, projectId, userId, {
          ...input,
          assigneeId,
        }),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.requireOrganizationPermission).toHaveBeenNthCalledWith(
        2,
        organizationId,
        userId,
        "tasks.assign",
      );

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects an assignee who is not an organization member", async () => {
      mocks.limit
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([]);

      await expect(
        createTask(organizationId, projectId, userId, {
          ...input,
          assigneeId,
        }),
      ).rejects.toThrow(
        "Assignee is not a member of this organization",
      );

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects a parent task outside the project", async () => {
      mocks.limit
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([]);

      await expect(
        createTask(organizationId, projectId, userId, {
          ...input,
          parentTaskId,
        }),
      ).rejects.toThrow("Parent task not found in this project");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("listTasks", () => {
    it("lists tasks for an authorized project", async () => {
      const result = await listTasks(
        organizationId,
        projectId,
        userId,
      );

      expect(result).toEqual([task]);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "tasks.view",
      );

      expect(mocks.orderBy).toHaveBeenCalledOnce();
    });

    it("returns null when the project does not exist", async () => {
      mocks.limit.mockResolvedValueOnce([]);

      const result = await listTasks(
        organizationId,
        projectId,
        userId,
      );

      expect(result).toBeNull();
      expect(mocks.orderBy).not.toHaveBeenCalled();
    });

    it("rejects listing when permission is denied", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        listTasks(organizationId, projectId, userId),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.select).not.toHaveBeenCalled();
    });
  });

  describe("getTask", () => {
    it("retrieves a task within the requested project", async () => {
      mocks.limit.mockResolvedValueOnce([task]);

      const result = await getTask(
        organizationId,
        projectId,
        taskId,
        userId,
      );

      expect(result).toEqual(task);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "tasks.view",
      );
    });

    it("returns null when the task does not exist", async () => {
      mocks.limit.mockResolvedValueOnce([]);

      const result = await getTask(
        organizationId,
        projectId,
        taskId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("rejects retrieval when permission is denied", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        getTask(organizationId, projectId, taskId, userId),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.select).not.toHaveBeenCalled();
    });
  });

  describe("updateTask", () => {
    it("updates task details and records activity", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([actor]);

      const result = await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { title: "Updated authentication task" },
      );

      expect(result).toEqual(task);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "tasks.update",
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();

      expect(mocks.txSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated authentication task",
          updatedAt: expect.any(Date),
          completedAt: null,
        }),
      );

      expect(mocks.txValues).toHaveBeenCalledWith([
        expect.objectContaining({
          organizationId,
          projectId,
          taskId,
          actorId: userId,
          actorName: actor.name,
          type: "task_updated",
        }),
      ]);
    });

    it("notifies the new assignee when a task is assigned", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([{ userId: assigneeId }])
        .mockResolvedValueOnce([actor]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { assigneeId },
      );

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          organizationId,
          recipientId: assigneeId,
          actorId: userId,
          taskId,
          type: "task_assigned",
          title: "Task assigned to you",
        }),
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("notifies the previous assignee when a task is unassigned", async () => {
      mocks.limit
        .mockResolvedValueOnce([assignedTask])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([actor]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { assigneeId: null },
      );

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          organizationId,
          recipientId: assigneeId,
          actorId: userId,
          taskId,
          type: "task_unassigned",
          title: "Task unassigned",
        }),
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("notifies the assignee when task status changes", async () => {
      const updatedTask = {
        ...assignedTask,
        status: "in_progress" as const,
      };

      mocks.limit
        .mockResolvedValueOnce([assignedTask])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([actor]);

      mocks.txReturning.mockResolvedValueOnce([updatedTask]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { status: "in_progress" },
      );

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          organizationId,
          recipientId: assigneeId,
          actorId: userId,
          taskId,
          type: "task_status_changed",
          title: "Task status changed",
          metadata: expect.objectContaining({
            previousStatus: "todo",
            newStatus: "in_progress",
          }),
        }),
      );
    });

    it("notifies the assignee when task priority changes", async () => {
      const updatedTask = {
        ...assignedTask,
        priority: "urgent" as const,
      };

      mocks.limit
        .mockResolvedValueOnce([assignedTask])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([actor]);

      mocks.txReturning.mockResolvedValueOnce([updatedTask]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { priority: "urgent" },
      );

      expect(mocks.txValues).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          organizationId,
          recipientId: assigneeId,
          actorId: userId,
          taskId,
          type: "task_priority_changed",
          title: "Task priority changed",
          metadata: expect.objectContaining({
            previousPriority: "normal",
            newPriority: "urgent",
          }),
        }),
      );
    });

    it("does not notify a user when they assign a task to themselves", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([{ userId }])
        .mockResolvedValueOnce([actor]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { assigneeId: userId },
      );

      // Only the task activity should be inserted.
      expect(mocks.txValues).toHaveBeenCalledOnce();

      expect(mocks.transaction).toHaveBeenCalledOnce();
    });

    it("does not record activity when supplied values have not changed", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { title: task.title },
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
      expect(mocks.txInsert).not.toHaveBeenCalled();
    });

    it("returns null when the task does not exist", async () => {
      mocks.limit.mockResolvedValueOnce([]);

      const result = await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { title: "Updated task" },
      );

      expect(result).toBeNull();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects updates when permission is denied", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        updateTask(
          organizationId,
          projectId,
          taskId,
          userId,
          { title: "Updated task" },
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects updates in archived projects", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([
          { ...project, status: "archived" },
        ]);

      await expect(
        updateTask(
          organizationId,
          projectId,
          taskId,
          userId,
          { title: "Updated task" },
        ),
      ).rejects.toThrow("Cannot update tasks in an archived project");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("requires assignment permission when changing assignee", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project]);

      mocks.requireOrganizationPermission
        .mockResolvedValueOnce(organization)
        .mockRejectedValueOnce(new Error("FORBIDDEN"));

      await expect(
        updateTask(
          organizationId,
          projectId,
          taskId,
          userId,
          { assigneeId },
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("prevents circular subtask relationships", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([
          {
            id: parentTaskId,
            parentTaskId: taskId,
          },
        ]);

      await expect(
        updateTask(
          organizationId,
          projectId,
          taskId,
          userId,
          { parentTaskId },
        ),
      ).rejects.toThrow(
        "A task cannot be a parent of its own ancestor",
      );

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("sets completedAt when a task becomes done", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([actor]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { status: "done" },
      );

      expect(mocks.txSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "done",
          completedAt: expect.any(Date),
        }),
      );

      expect(mocks.txValues).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "task_status_changed",
        }),
      ]);
    });

    it("clears completedAt when a task leaves done status", async () => {
      const completedTask = {
        ...task,
        status: "done" as const,
        completedAt: new Date("2026-11-09T09:00:00.000Z"),
      };

      mocks.limit
        .mockResolvedValueOnce([completedTask])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([actor]);

      await updateTask(
        organizationId,
        projectId,
        taskId,
        userId,
        { status: "in_progress" },
      );

      expect(mocks.txSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "in_progress",
          completedAt: null,
        }),
      );

      expect(mocks.txValues).toHaveBeenCalledWith([
        expect.objectContaining({
          type: "task_status_changed",
        }),
      ]);
    });
  });

  describe("deleteTask", () => {
    it("deletes a task and records its activity", async () => {
      mocks.limit
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([actor]);

      const result = await deleteTask(
        organizationId,
        projectId,
        taskId,
        userId,
      );

      expect(result).toEqual(task);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "tasks.delete",
      );

      expect(mocks.transaction).toHaveBeenCalledOnce();
      expect(mocks.txDelete).toHaveBeenCalledOnce();

      expect(mocks.txValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          projectId,
          taskId: null,
          actorId: userId,
          actorName: actor.name,
          type: "task_deleted",
          metadata: expect.objectContaining({
            taskId,
            taskTitle: task.title,
            taskStatus: task.status,
            taskPriority: task.priority,
          }),
        }),
      );
    });

    it("returns null when the task does not exist", async () => {
      mocks.limit.mockResolvedValueOnce([]);

      const result = await deleteTask(
        organizationId,
        projectId,
        taskId,
        userId,
      );

      expect(result).toBeNull();
      expect(mocks.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting a task that has subtasks", async () => {
      mocks.limit
        .mockResolvedValueOnce([{ id: taskId }])
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([{ id: parentTaskId }]);

      await expect(
        deleteTask(organizationId, projectId, taskId, userId),
      ).rejects.toThrow("Cannot delete a task that has subtasks");

      expect(mocks.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting tasks in archived projects", async () => {
      mocks.limit
        .mockResolvedValueOnce([{ id: taskId }])
        .mockResolvedValueOnce([{ ...project, status: "archived" }]);

      await expect(
        deleteTask(organizationId, projectId, taskId, userId),
      ).rejects.toThrow("Cannot delete tasks in an archived project");

      expect(mocks.delete).not.toHaveBeenCalled();
    });

    it("does not query tasks when delete permission is denied", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        deleteTask(organizationId, projectId, taskId, userId),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.select).not.toHaveBeenCalled();
      expect(mocks.delete).not.toHaveBeenCalled();
    });
  });
});
