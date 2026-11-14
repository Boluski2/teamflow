
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  markNotificationAsRead: vi.fn(),
  taskRouteError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/notifications/service", () => ({
  markNotificationAsRead: mocks.markNotificationAsRead,
}));

vi.mock("@/lib/tasks/route-errors", () => ({
  taskRouteError: mocks.taskRouteError,
}));

import { PATCH } from "./route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const notificationId = "33333333-3333-4333-8333-333333333333";
const userId = "22222222-2222-4222-8222-222222222222";

const notification = {
  id: notificationId,
  organizationId,
  recipientId: userId,
  type: "task_assigned",
  title: "Task assigned",
  message: "You have been assigned a task",
  readAt: new Date(),
};

const context = {
  params: Promise.resolve({ organizationId, notificationId }),
};

describe("PATCH /api/organizations/[organizationId]/notifications/[notificationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue({ id: userId });
    mocks.markNotificationAsRead.mockResolvedValue(notification);

    mocks.taskRouteError.mockImplementation(() =>
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    );
  });

  it("marks the notification as read", async () => {
    const response = await PATCH(
      new Request("http://localhost"),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.notification.id).toBe(notificationId);
    expect(body.notification.readAt).toBeTruthy();

    expect(mocks.markNotificationAsRead).toHaveBeenCalledWith(
      organizationId,
      notificationId,
      userId,
    );
  });

  it("returns the notification when it is already read", async () => {
    mocks.markNotificationAsRead.mockResolvedValue(notification);

    const response = await PATCH(
      new Request("http://localhost"),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.notification.id).toBe(notificationId);
  });

  it("returns 404 when the notification does not belong to the user", async () => {
    mocks.markNotificationAsRead.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost"),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Notification not found");
  });

  it("rejects an invalid organization UUID", async () => {
    const invalidContext = {
      params: Promise.resolve({
        organizationId: "invalid-id",
        notificationId,
      }),
    };

    const response = await PATCH(
      new Request("http://localhost"),
      invalidContext,
    );

    expect(response.status).toBe(400);
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.markNotificationAsRead).not.toHaveBeenCalled();
  });

  it("rejects an invalid notification UUID", async () => {
    const invalidContext = {
      params: Promise.resolve({
        organizationId,
        notificationId: "invalid-id",
      }),
    };

    const response = await PATCH(
      new Request("http://localhost"),
      invalidContext,
    );

    expect(response.status).toBe(400);
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.markNotificationAsRead).not.toHaveBeenCalled();
  });

  it("passes service errors to the route error handler", async () => {
    const error = new Error("Database failure");

    mocks.markNotificationAsRead.mockRejectedValue(error);

    await PATCH(new Request("http://localhost"), context);

    expect(mocks.taskRouteError).toHaveBeenCalledWith(
      error,
      "mark notification as read",
    );
  });

  it("passes authentication errors to the route error handler", async () => {
    const error = new Error("Authentication failed");

    mocks.ensureUser.mockRejectedValue(error);

    await PATCH(new Request("http://localhost"), context);

    expect(mocks.taskRouteError).toHaveBeenCalledWith(
      error,
      "mark notification as read",
    );
  });
});
