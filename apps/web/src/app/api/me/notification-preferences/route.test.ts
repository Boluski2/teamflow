
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  returning: vi.fn(),
  eq: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  updateWhere: vi.fn(),
  selectFrom: vi.fn(),
  selectWhere: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq,
  and: vi.fn((...conditions) => conditions),
  inArray: vi.fn((...conditions) => conditions),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  userNotificationPreferences: {
    userId: "userId",
    emailEnabled: "emailEnabled",
  },
  notifications: {
    id: "notificationId",
    recipientId: "recipientId",
  },
  emailOutbox: {
    notificationId: "outboxNotificationId",
    status: "outboxStatus",
    leaseExpiresAt: "leaseExpiresAt",
    lastError: "lastError",
    updatedAt: "updatedAt",
  },
}));

import { GET, PATCH } from "./route";

const user = {
  id: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  clerkUserId: "user_test123",
  email: "test@example.com",
  name: "Test User",
  avatarUrl: null,
  isActive: true,
};

const createRequest = (body: string) =>
  new Request(
    "http://localhost/api/me/notification-preferences",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    },
  );

describe("GET /api/me/notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.eq.mockReturnValue("user-filter");

    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      limit: mocks.limit,
    });

    mocks.limit.mockResolvedValue([]);
  });

  it("returns false when no preferences record exists", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      preferences: {
        emailEnabled: false,
      },
    });

    expect(mocks.ensureUser).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith(
      "userId",
      user.id,
    );
  });

  it("returns the existing email preference", async () => {
    mocks.limit.mockResolvedValue([
      { emailEnabled: true },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preferences.emailEnabled).toBe(true);
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Unauthorized"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      message: "Unauthorized",
    });

    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Account deactivated");
  });

  it("does not expose unexpected database errors", async () => {
    mocks.limit.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Internal server error");

    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});

describe("PATCH /api/me/notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);

    mocks.insert.mockReturnValue({
      values: mocks.values,
    });

    mocks.values.mockReturnValue({
      onConflictDoUpdate: mocks.onConflictDoUpdate,
    });

    mocks.onConflictDoUpdate.mockReturnValue({
      returning: mocks.returning,
    });

    mocks.returning.mockResolvedValue([
      { emailEnabled: true },
    ]);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        insert: mocks.insert,
        update: mocks.update,
        select: vi.fn(() => ({
          from: mocks.selectFrom,
        })),
      }),
    );

    mocks.update.mockReturnValue({
      set: mocks.set,
    });

    mocks.set.mockReturnValue({
      where: mocks.updateWhere,
    });

    mocks.updateWhere.mockResolvedValue([]);

    mocks.selectFrom.mockReturnValue({
      where: mocks.selectWhere,
    });

    mocks.selectWhere.mockReturnValue("user-notification-subquery");
  });

  it("cancels pending and processing email jobs when disabling notifications", async () => {
    mocks.returning.mockResolvedValue([
      { emailEnabled: false },
    ]);

    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: false,
      })),
    );

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledOnce();

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        leaseExpiresAt: null,
        lastError: null,
      }),
    );
  });

  it("does not cancel email jobs when enabling notifications", async () => {
    mocks.returning.mockResolvedValue([
      { emailEnabled: true },
    ]);

    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: true,
      })),
    );

    expect(response.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("enables email notifications", async () => {
    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: true,
      })),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: "Notification preferences updated",
      preferences: {
        emailEnabled: true,
      },
    });

    expect(mocks.values).toHaveBeenCalledWith({
      userId: user.id,
      emailEnabled: true,
    });
  });

  it("disables email notifications", async () => {
    mocks.returning.mockResolvedValue([
      { emailEnabled: false },
    ]);

    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: false,
      })),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preferences.emailEnabled).toBe(false);

    expect(mocks.values).toHaveBeenCalledWith({
      userId: user.id,
      emailEnabled: false,
    });
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await PATCH(
      createRequest("{invalid json"),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid JSON body");

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 400 when emailEnabled is missing", async () => {
    const response = await PATCH(
      createRequest(JSON.stringify({})),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe(
      "Invalid notification preferences",
    );

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 400 when emailEnabled is not a boolean", async () => {
    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: "true",
      })),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects unexpected properties", async () => {
    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: true,
        userId: "another-user-id",
      })),
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Unauthorized"),
    );

    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: true,
      })),
    );

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: true,
      })),
    );

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Account deactivated");
  });

  it("does not expose database errors", async () => {
    mocks.returning.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await PATCH(
      createRequest(JSON.stringify({
        emailEnabled: true,
      })),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Internal server error");

    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });
});
