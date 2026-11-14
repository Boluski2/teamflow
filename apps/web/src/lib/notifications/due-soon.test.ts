
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelectFrom,
  mockSelectInnerJoin,
  mockSelectWhere,
  mockInsertValues,
  mockOnConflictDoNothing,
  mockInsertReturning,
} = vi.hoisted(() => ({
  mockSelectFrom: vi.fn(),
  mockSelectInnerJoin: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockInsertValues: vi.fn(),
  mockOnConflictDoNothing: vi.fn(),
  mockInsertReturning: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
  },
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

    mockInsertValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
    });

    mockOnConflictDoNothing.mockReturnValue({
      returning: mockInsertReturning,
    });

    mockInsertReturning.mockResolvedValue([
      { id: "notification-123" },
    ]);
  });

  describe("processDueSoonNotifications", () => {
    it("creates a due-soon notification for an eligible task", async () => {
      const result = await processDueSoonNotifications({ now });

      expect(result).toEqual({
        scannedTasks: 1,
        notificationsCreated: 1,
        windowHours: 24,
      });

      expect(mockInsertValues).toHaveBeenCalledWith([
        expect.objectContaining({
          organizationId: "org-123",
          recipientId: "user-123",
          projectId: "project-123",
          taskId: "task-123",
          type: "task_due_soon",
          title: "Task due soon",
        }),
      ]);
    });

    it("uses a 24-hour reminder window by default", async () => {
      await processDueSoonNotifications({ now });

      expect(mockInsertValues).toHaveBeenCalledWith([
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

      expect(mockInsertValues).toHaveBeenCalledWith([
        expect.objectContaining({
          dedupeKey:
            "task_due_soon:task-123:user-123:2026-11-13T18:00:00.000Z",
        }),
      ]);
    });

    it("uses conflict handling to prevent duplicate reminders", async () => {
      await processDueSoonNotifications({ now });

      expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
      expect(mockInsertReturning).toHaveBeenCalledOnce();
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

      expect(mockInsertValues).toHaveBeenCalledWith([
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

      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("supports a custom reminder window", async () => {
      const result = await processDueSoonNotifications({
        now,
        windowHours: 12,
      });

      expect(result.windowHours).toBe(12);

      expect(mockInsertValues).toHaveBeenCalledWith([
        expect.objectContaining({
          message: expect.stringContaining("12 hours"),
          metadata: expect.objectContaining({
            reminderWindowHours: 12,
          }),
        }),
      ]);
    });

    it("returns the number of notifications actually created", async () => {
      mockInsertReturning.mockResolvedValue([
        { id: "notification-1" },
        { id: "notification-2" },
      ]);

      const result = await processDueSoonNotifications({ now });

      expect(result.scannedTasks).toBe(1);
      expect(result.notificationsCreated).toBe(2);
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
  });
});
