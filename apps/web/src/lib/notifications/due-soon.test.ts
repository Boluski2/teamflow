
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelectFrom,
  mockSelectInnerJoin,
  mockSelectWhere,
  mockTransaction,
  mockInsert,
  mockValues,
  mockOnConflictDoNothing,
  mockReturning,
  mockEnqueueNotificationEmail,
} = vi.hoisted(() => ({
  mockSelectFrom: vi.fn(),
  mockSelectInnerJoin: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockTransaction: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockOnConflictDoNothing: vi.fn(),
  mockReturning: vi.fn(),
  mockEnqueueNotificationEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
    transaction: mockTransaction,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  notifications: {
    id: "notifications.id",
    recipientId: "notifications.recipient_id",
    taskId: "notifications.task_id",
  },
  projects: {
    id: "projects.id",
    organizationId: "projects.organization_id",
    status: "projects.status",
    name: "projects.name",
  },
  tasks: {
    id: "tasks.id",
    organizationId: "tasks.organization_id",
    projectId: "tasks.project_id",
    title: "tasks.title",
    assigneeId: "tasks.assignee_id",
    dueDate: "tasks.due_date",
    status: "tasks.status",
  },
}));

vi.mock("@/lib/email/outbox", () => ({
  enqueueNotificationEmail: mockEnqueueNotificationEmail,
}));

import { processDueSoonNotifications } from "./due-soon";

const now = new Date("2026-11-13T10:00:00.000Z");

const eligibleTask = {
  id: "task-123",
  organizationId: "org-123",
  projectId: "project-123",
  title: "Complete dashboard",
  assigneeId: "user-123",
  dueDate: new Date("2026-11-13T18:00:00.000Z"),
  projectName: "TeamFlow",
};

const createdNotification = {
  id: "notification-123",
  recipientId: "user-123",
  taskId: "task-123",
};

describe("Due-soon notification processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelectFrom.mockReturnValue({
      innerJoin: mockSelectInnerJoin,
    });

    mockSelectInnerJoin.mockReturnValue({
      where: mockSelectWhere,
    });

    mockSelectWhere.mockResolvedValue([eligibleTask]);

    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          insert: mockInsert,
        };

        return callback(tx);
      },
    );

    mockInsert.mockReturnValue({
      values: mockValues,
    });

    mockValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
    });

    mockOnConflictDoNothing.mockReturnValue({
      returning: mockReturning,
    });

    mockReturning.mockResolvedValue([createdNotification]);

    mockEnqueueNotificationEmail.mockResolvedValue({
      id: "email-job-123",
    });
  });

  describe("processDueSoonNotifications", () => {
    it("creates a due-soon notification for an eligible task", async () => {
      const result = await processDueSoonNotifications({ now });

      expect(result).toEqual({
        scannedTasks: 1,
        notificationsCreated: 1,
        windowHours: 24,
      });

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({
          organizationId: "org-123",
          recipientId: "user-123",
          projectId: "project-123",
          taskId: "task-123",
          type: "task_due_soon",
          title: "Task due soon",
        }),
      ]);

      expect(mockTransaction).toHaveBeenCalledOnce();
    });

    it("queues email for a newly created notification", async () => {
      await processDueSoonNotifications({ now });

      expect(mockEnqueueNotificationEmail).toHaveBeenCalledWith(
        expect.any(Object),
        {
          notificationId: "notification-123",
          recipientId: "user-123",
          template: "task_due_soon",
          payload: {
            taskTitle: "Complete dashboard",
            projectName: "TeamFlow",
            dueDate: "2026-11-13T18:00:00.000Z",
            reminderWindowHours: 24,
          },
        },
      );
    });

    it("uses a 24-hour reminder window by default", async () => {
      await processDueSoonNotifications({ now });

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({
          message: expect.stringContaining("24 hours"),
          metadata: expect.objectContaining({
            reminderWindowHours: 24,
          }),
        }),
      ]);
    });

    it("creates a deterministic deduplication key", async () => {
      await processDueSoonNotifications({ now });

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({
          dedupeKey:
            "task_due_soon:task-123:user-123:2026-11-13T18:00:00.000Z",
        }),
      ]);
    });

    it("uses conflict handling to prevent duplicate reminders", async () => {
      await processDueSoonNotifications({ now });

      expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
      expect(mockReturning).toHaveBeenCalledOnce();
    });

    it("does not queue email when the notification already exists", async () => {
      mockReturning.mockResolvedValue([]);

      const result = await processDueSoonNotifications({ now });

      expect(result.notificationsCreated).toBe(0);
      expect(mockEnqueueNotificationEmail).not.toHaveBeenCalled();
    });

    it("allows a different deadline to generate a different reminder key", async () => {
      const changedDeadline = new Date(
        "2026-11-14T08:00:00.000Z",
      );

      mockSelectWhere.mockResolvedValue([
        {
          ...eligibleTask,
          dueDate: changedDeadline,
        },
      ]);

      await processDueSoonNotifications({ now });

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({
          dedupeKey:
            "task_due_soon:task-123:user-123:2026-11-14T08:00:00.000Z",
        }),
      ]);
    });

    it("returns zero when no eligible tasks exist", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const result = await processDueSoonNotifications({ now });

      expect(result).toEqual({
        scannedTasks: 0,
        notificationsCreated: 0,
        windowHours: 24,
      });

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockEnqueueNotificationEmail).not.toHaveBeenCalled();
    });

    it("supports a custom reminder window", async () => {
      const result = await processDueSoonNotifications({
        now,
        windowHours: 12,
      });

      expect(result.windowHours).toBe(12);

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({
          message: expect.stringContaining("12 hours"),
          metadata: expect.objectContaining({
            reminderWindowHours: 12,
          }),
        }),
      ]);
    });

    it("returns the number of notifications actually created", async () => {
      mockReturning.mockResolvedValue([
        createdNotification,
        {
          id: "notification-2",
          recipientId: "user-123",
          taskId: "task-123",
        },
      ]);

      const result = await processDueSoonNotifications({ now });

      expect(result.scannedTasks).toBe(1);
      expect(result.notificationsCreated).toBe(2);
      expect(mockEnqueueNotificationEmail).toHaveBeenCalledTimes(2);
    });

    it("rejects a zero-hour reminder window", async () => {
      await expect(
        processDueSoonNotifications({
          now,
          windowHours: 0,
        }),
      ).rejects.toThrow(
        "Reminder window must be between 0 and 168 hours",
      );

      expect(mockSelectFrom).not.toHaveBeenCalled();
    });

    it("rejects a reminder window greater than 168 hours", async () => {
      await expect(
        processDueSoonNotifications({
          now,
          windowHours: 200,
        }),
      ).rejects.toThrow(
        "Reminder window must be between 0 and 168 hours",
      );

      expect(mockSelectFrom).not.toHaveBeenCalled();
    });

    it("rejects an invalid reminder window", async () => {
      await expect(
        processDueSoonNotifications({
          now,
          windowHours: Number.NaN,
        }),
      ).rejects.toThrow(
        "Reminder window must be between 0 and 168 hours",
      );
    });

    it("rejects an invalid processing date", async () => {
      await expect(
        processDueSoonNotifications({
          now: new Date("invalid"),
        }),
      ).rejects.toThrow("Invalid processing date");

      expect(mockSelectFrom).not.toHaveBeenCalled();
    });

    it("propagates email enqueue errors so the transaction can roll back", async () => {
      mockEnqueueNotificationEmail.mockRejectedValue(
        new Error("Outbox unavailable"),
      );

      await expect(
        processDueSoonNotifications({ now }),
      ).rejects.toThrow("Outbox unavailable");
    });
  });
});
