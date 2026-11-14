
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireOrganizationMembership,
  mockInsertValues,
  mockInsertReturning,
  mockSelectFrom,
  mockSelectWhere,
  mockSelectOrderBy,
  mockSelectLimit,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
} = vi.hoisted(() => ({
  mockRequireOrganizationMembership: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockSelectFrom: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockSelectOrderBy: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockUpdateReturning: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/organizations/authorization", () => ({
  requireOrganizationMembership: mockRequireOrganizationMembership,
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
    update: vi.fn(() => ({
      set: mockUpdateSet,
    })),
  },
}));

import {
  createNotification,
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./service";

const organizationId = "org-123";
const userId = "user-123";
const notificationId = "notification-123";

const notification = {
  id: notificationId,
  organizationId,
  recipientId: userId,
  actorId: "actor-123",
  projectId: "project-123",
  taskId: "task-123",
  type: "task_assigned" as const,
  title: "New task assigned",
  message: "A task has been assigned to you.",
  metadata: {},
  readAt: null,
  createdAt: new Date("2026-11-13T10:00:00.000Z"),
};

describe("Notification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireOrganizationMembership.mockResolvedValue({
      organizationId,
      userId,
      role: "member",
    });

    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    });

    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
    });

    mockSelectWhere.mockReturnValue({
      orderBy: mockSelectOrderBy,
      limit: mockSelectLimit,
    });

    mockSelectOrderBy.mockReturnValue({
      limit: mockSelectLimit,
    });

    mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere,
    });

    mockUpdateWhere.mockReturnValue({
      returning: mockUpdateReturning,
    });
  });

  describe("createNotification", () => {
    it("creates a notification for a valid organization member", async () => {
      mockInsertReturning.mockResolvedValue([notification]);

      const result = await createNotification({
        organizationId,
        recipientId: userId,
        actorId: "actor-123",
        projectId: "project-123",
        taskId: "task-123",
        type: "task_assigned",
        title: "New task assigned",
        message: "A task has been assigned to you.",
      });

      expect(result).toEqual(notification);

      expect(mockRequireOrganizationMembership).toHaveBeenCalledWith(
        organizationId,
        userId,
      );

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          recipientId: userId,
          type: "task_assigned",
        }),
      );
    });

    it("rejects recipients who are not organization members", async () => {
      mockRequireOrganizationMembership.mockRejectedValue(
        new Error("Organization membership required"),
      );

      await expect(
        createNotification({
          organizationId,
          recipientId: userId,
          type: "task_assigned",
          title: "New task",
          message: "A task was assigned.",
        }),
      ).rejects.toThrow("Organization membership required");

      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("uses empty metadata when none is provided", async () => {
      mockInsertReturning.mockResolvedValue([notification]);

      await createNotification({
        organizationId,
        recipientId: userId,
        type: "task_assigned",
        title: "New task",
        message: "A task was assigned.",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {},
        }),
      );
    });

    it("throws when the database does not return a created notification", async () => {
      mockInsertReturning.mockResolvedValue([]);

      await expect(
        createNotification({
          organizationId,
          recipientId: userId,
          type: "task_assigned",
          title: "New task",
          message: "A task was assigned.",
        }),
      ).rejects.toThrow("Failed to create notification");
    });
  });

  describe("listNotifications", () => {
    it("returns notifications for the requested member", async () => {
      mockSelectLimit.mockResolvedValue([notification]);

      const result = await listNotifications(
        organizationId,
        userId,
      );

      expect(result).toEqual([notification]);

      expect(mockRequireOrganizationMembership).toHaveBeenCalledWith(
        organizationId,
        userId,
      );
    });

    it("uses the default limit of 30", async () => {
      mockSelectLimit.mockResolvedValue([]);

      await listNotifications(organizationId, userId);

      expect(mockSelectLimit).toHaveBeenCalledWith(30);
    });

    it("caps the requested limit at 100", async () => {
      mockSelectLimit.mockResolvedValue([]);

      await listNotifications(organizationId, userId, 500);

      expect(mockSelectLimit).toHaveBeenCalledWith(100);
    });

    it("enforces a minimum limit of 1", async () => {
      mockSelectLimit.mockResolvedValue([]);

      await listNotifications(organizationId, userId, 0);

      expect(mockSelectLimit).toHaveBeenCalledWith(1);
    });

    it("rejects users without organization membership", async () => {
      mockRequireOrganizationMembership.mockRejectedValue(
        new Error("Organization membership required"),
      );

      await expect(
        listNotifications(organizationId, userId),
      ).rejects.toThrow("Organization membership required");

      expect(mockSelectFrom).not.toHaveBeenCalled();
    });
  });

  describe("getUnreadNotificationCount", () => {
    it("returns the unread notification count", async () => {
      mockSelectWhere.mockResolvedValue([{ total: 5 }]);

      const result = await getUnreadNotificationCount(
        organizationId,
        userId,
      );

      expect(result).toBe(5);
    });

    it("returns zero when no unread notifications exist", async () => {
      mockSelectWhere.mockResolvedValue([{ total: 0 }]);

      const result = await getUnreadNotificationCount(
        organizationId,
        userId,
      );

      expect(result).toBe(0);
    });

    it("returns zero when the database returns no result", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const result = await getUnreadNotificationCount(
        organizationId,
        userId,
      );

      expect(result).toBe(0);
    });

    it("rejects users without organization membership", async () => {
      mockRequireOrganizationMembership.mockRejectedValue(
        new Error("Organization membership required"),
      );

      await expect(
        getUnreadNotificationCount(organizationId, userId),
      ).rejects.toThrow("Organization membership required");

      expect(mockSelectFrom).not.toHaveBeenCalled();
    });
  });

  describe("markNotificationAsRead", () => {
    it("marks an unread notification as read", async () => {
      const updated = {
        ...notification,
        readAt: new Date(),
      };

      mockUpdateReturning.mockResolvedValue([updated]);

      const result = await markNotificationAsRead(
        organizationId,
        notificationId,
        userId,
      );

      expect(result).toEqual(updated);
      expect(mockUpdateSet).toHaveBeenCalledWith({
        readAt: expect.any(Date),
      });
    });

    it("returns the existing notification when already read", async () => {
      const alreadyRead = {
        ...notification,
        readAt: new Date(),
      };

      mockUpdateReturning.mockResolvedValue([]);
      mockSelectLimit.mockResolvedValue([alreadyRead]);

      const result = await markNotificationAsRead(
        organizationId,
        notificationId,
        userId,
      );

      expect(result).toEqual(alreadyRead);
    });

    it("returns null when the notification does not belong to the user", async () => {
      mockUpdateReturning.mockResolvedValue([]);
      mockSelectLimit.mockResolvedValue([]);

      const result = await markNotificationAsRead(
        organizationId,
        notificationId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("rejects users without organization membership", async () => {
      mockRequireOrganizationMembership.mockRejectedValue(
        new Error("Organization membership required"),
      );

      await expect(
        markNotificationAsRead(
          organizationId,
          notificationId,
          userId,
        ),
      ).rejects.toThrow("Organization membership required");

      expect(mockUpdateSet).not.toHaveBeenCalled();
    });
  });

  describe("markAllNotificationsAsRead", () => {
    it("marks all unread notifications as read", async () => {
      mockUpdateReturning.mockResolvedValue([
        { id: "notification-1" },
        { id: "notification-2" },
      ]);

      const result = await markAllNotificationsAsRead(
        organizationId,
        userId,
      );

      expect(result).toBe(2);
      expect(mockUpdateSet).toHaveBeenCalledWith({
        readAt: expect.any(Date),
      });
    });

    it("returns zero when there are no unread notifications", async () => {
      mockUpdateReturning.mockResolvedValue([]);

      const result = await markAllNotificationsAsRead(
        organizationId,
        userId,
      );

      expect(result).toBe(0);
    });

    it("rejects users without organization membership", async () => {
      mockRequireOrganizationMembership.mockRejectedValue(
        new Error("Organization membership required"),
      );

      await expect(
        markAllNotificationsAsRead(organizationId, userId),
      ).rejects.toThrow("Organization membership required");

      expect(mockUpdateSet).not.toHaveBeenCalled();
    });
  });
});
