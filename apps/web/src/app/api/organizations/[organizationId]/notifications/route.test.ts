
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  listNotifications: vi.fn(),
  taskRouteError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/notifications/service", () => ({
  listNotifications: mocks.listNotifications,
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

function createRequest(url = "") {
  return new NextRequest(
    `http://localhost/api/organizations/${organizationId}/notifications${url}`,
  );
}

describe("GET /api/organizations/[organizationId]/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue({
      id: userId,
    });

    mocks.listNotifications.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "task_assigned",
        title: "Task assigned",
        message: "You have been assigned a task",
        readAt: null,
      },
    ]);

    mocks.taskRouteError.mockImplementation(() =>
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    );
  });

  it("returns the user's notifications successfully", async () => {
    const response = await GET(createRequest(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.notifications).toHaveLength(1);

    expect(mocks.listNotifications).toHaveBeenCalledWith(
      organizationId,
      userId,
      30,
    );
  });

  it("uses the default limit of 30 when no limit is provided", async () => {
    await GET(createRequest(), context);

    expect(mocks.listNotifications).toHaveBeenCalledWith(
      organizationId,
      userId,
      30,
    );
  });

  it("accepts a custom positive integer limit", async () => {
    await GET(createRequest("?limit=15"), context);

    expect(mocks.listNotifications).toHaveBeenCalledWith(
      organizationId,
      userId,
      15,
    );
  });

  it("rejects an invalid organization UUID", async () => {
    const invalidContext = {
      params: Promise.resolve({
        organizationId: "invalid-id",
      }),
    };

    const response = await GET(
      createRequest(),
      invalidContext,
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid organization ID");
    expect(mocks.listNotifications).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "abc"])(
    "rejects an invalid limit: %s",
    async (limit) => {
      const response = await GET(
        createRequest(`?limit=${limit}`),
        context,
      );

      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe(
        "Limit must be a positive integer",
      );
      expect(mocks.listNotifications).not.toHaveBeenCalled();
    },
  );

  it("passes service errors to the route error handler", async () => {
    const error = new Error("Database failure");

    mocks.listNotifications.mockRejectedValue(error);

    const response = await GET(createRequest(), context);

    expect(mocks.taskRouteError).toHaveBeenCalledWith(
      error,
      "fetch notifications",
    );

    expect(response.status).toBe(500);
  });
});
