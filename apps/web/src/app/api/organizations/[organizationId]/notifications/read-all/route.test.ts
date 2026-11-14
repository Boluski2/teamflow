
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  taskRouteError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/notifications/service", () => ({
  markAllNotificationsAsRead: mocks.markAllNotificationsAsRead,
}));

vi.mock("@/lib/tasks/route-errors", () => ({
  taskRouteError: mocks.taskRouteError,
}));

import { PATCH } from "./route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const context = {
  params: Promise.resolve({ organizationId }),
};

describe("PATCH /api/organizations/[organizationId]/notifications/read-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue({ id: userId });
    mocks.markAllNotificationsAsRead.mockResolvedValue(5);

    mocks.taskRouteError.mockImplementation(() =>
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    );
  });

  it("marks all unread notifications as read", async () => {
    const response = await PATCH(new Request("http://localhost"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      updatedCount: 5,
    });

    expect(mocks.markAllNotificationsAsRead).toHaveBeenCalledWith(
      organizationId,
      userId,
    );
  });

  it("returns zero when there are no unread notifications", async () => {
    mocks.markAllNotificationsAsRead.mockResolvedValue(0);

    const response = await PATCH(new Request("http://localhost"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.updatedCount).toBe(0);
  });

  it("rejects an invalid organization UUID", async () => {
    const invalidContext = {
      params: Promise.resolve({ organizationId: "invalid-id" }),
    };

    const response = await PATCH(
      new Request("http://localhost"),
      invalidContext,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid organization ID");
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.markAllNotificationsAsRead).not.toHaveBeenCalled();
  });

  it("passes service errors to the route error handler", async () => {
    const error = new Error("Database failure");

    mocks.markAllNotificationsAsRead.mockRejectedValue(error);

    await PATCH(new Request("http://localhost"), context);

    expect(mocks.taskRouteError).toHaveBeenCalledWith(
      error,
      "mark all notifications as read",
    );
  });

  it("passes authentication errors to the route error handler", async () => {
    const error = new Error("Authentication failed");

    mocks.ensureUser.mockRejectedValue(error);

    await PATCH(new Request("http://localhost"), context);

    expect(mocks.taskRouteError).toHaveBeenCalledWith(
      error,
      "mark all notifications as read",
    );
  });
});
