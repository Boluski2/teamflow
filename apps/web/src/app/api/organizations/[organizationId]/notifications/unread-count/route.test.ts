
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  taskRouteError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/notifications/service", () => ({
  getUnreadNotificationCount: mocks.getUnreadNotificationCount,
}));

vi.mock("@/lib/tasks/route-errors", () => ({
  taskRouteError: mocks.taskRouteError,
}));

import { GET } from "./route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const context = {
  params: Promise.resolve({ organizationId }),
};

describe("GET /api/organizations/[organizationId]/notifications/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue({ id: userId });
    mocks.getUnreadNotificationCount.mockResolvedValue(5);

    mocks.taskRouteError.mockImplementation(() =>
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    );
  });

  it("returns the unread notification count", async () => {
    const response = await GET(new Request("http://localhost"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      unreadCount: 5,
    });

    expect(mocks.getUnreadNotificationCount).toHaveBeenCalledWith(
      organizationId,
      userId,
    );
  });

  it("returns zero when there are no unread notifications", async () => {
    mocks.getUnreadNotificationCount.mockResolvedValue(0);

    const response = await GET(new Request("http://localhost"), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unreadCount).toBe(0);
  });

  it("rejects an invalid organization UUID", async () => {
    const invalidContext = {
      params: Promise.resolve({ organizationId: "invalid-id" }),
    };

    const response = await GET(
      new Request("http://localhost"),
      invalidContext,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid organization ID");
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.getUnreadNotificationCount).not.toHaveBeenCalled();
  });

  it("passes service errors to the route error handler", async () => {
    const error = new Error("Database failure");

    mocks.getUnreadNotificationCount.mockRejectedValue(error);

    const response = await GET(new Request("http://localhost"), context);

    expect(mocks.taskRouteError).toHaveBeenCalledWith(
      error,
      "fetch unread notification count",
    );
    expect(response.status).toBe(500);
  });

it("passes authentication errors to the route error handler", async () => {
  const error = new Error("Authentication failed");

  mocks.ensureUser.mockRejectedValue(error);

  await GET(new Request("http://localhost"), context);

  expect(mocks.taskRouteError).toHaveBeenCalledWith(
    error,
    "fetch unread notification count",
  );
});
});
