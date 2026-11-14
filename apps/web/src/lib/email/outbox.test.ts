
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockInsert,
  mockSelect,
  mockFrom,
  mockWhere,
  mockLimit,
  mockValues,
  mockOnConflictDoNothing,
  mockReturning,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockValues: vi.fn(),
  mockOnConflictDoNothing: vi.fn(),
  mockReturning: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => conditions),
  eq: vi.fn((...conditions) => conditions),
}));

vi.mock("@/lib/db/schema", () => ({
  emailOutbox: {
    id: "email_outbox.id",
  },
  userNotificationPreferences: {
    userId: "user_notification_preferences.user_id",
    emailEnabled: "user_notification_preferences.email_enabled",
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
  },
}));

import { enqueueNotificationEmail } from "./outbox";

describe("Email outbox service", () => {
  const notificationId = "notification-123";
  const recipientId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      from: mockFrom,
    });

    mockFrom.mockReturnValue({
      where: mockWhere,
    });

    mockWhere.mockReturnValue({
      limit: mockLimit,
    });

    mockLimit.mockResolvedValue([{ emailEnabled: true }]);

    mockInsert.mockReturnValue({
      values: mockValues,
    });

    mockValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
    });

    mockOnConflictDoNothing.mockReturnValue({
      returning: mockReturning,
    });

    mockReturning.mockResolvedValue([{ id: "email-job-123" }]);
  });

  it("queues an email when the recipient has opted in", async () => {
    const executor = {
      select: mockSelect,
      insert: mockInsert,
    } as never;

    const result = await enqueueNotificationEmail(executor, {
      notificationId,
      recipientId,
      template: "task_assigned",
      payload: {
        taskTitle: "Build dashboard",
      },
    });

    expect(result).toEqual({ id: "email-job-123" });

    expect(mockSelect).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(1);

    expect(mockValues).toHaveBeenCalledWith({
      notificationId,
      template: "task_assigned",
      payload: {
        taskTitle: "Build dashboard",
      },
    });
  });

  it("does not queue an email when the recipient has opted out", async () => {
    mockLimit.mockResolvedValue([{ emailEnabled: false }]);

    const result = await enqueueNotificationEmail(
      { select: mockSelect, insert: mockInsert } as never,
      {
        notificationId,
        recipientId,
        template: "task_assigned",
      },
    );

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("does not queue an email when no preference record exists", async () => {
    mockLimit.mockResolvedValue([]);

    const result = await enqueueNotificationEmail(
      { select: mockSelect, insert: mockInsert } as never,
      {
        notificationId,
        recipientId,
        template: "task_assigned",
      },
    );

    expect(result).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("uses an empty payload when none is provided", async () => {
    await enqueueNotificationEmail(
      { select: mockSelect, insert: mockInsert } as never,
      {
        notificationId,
        recipientId,
        template: "task_assigned",
      },
    );

    expect(mockValues).toHaveBeenCalledWith({
      notificationId,
      template: "task_assigned",
      payload: {},
    });
  });

  it("returns null when a duplicate job already exists", async () => {
    mockReturning.mockResolvedValue([]);

    const result = await enqueueNotificationEmail(
      { select: mockSelect, insert: mockInsert } as never,
      {
        notificationId,
        recipientId,
        template: "task_assigned",
      },
    );

    expect(result).toBeNull();
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
  });

  it("propagates preference lookup errors", async () => {
    mockLimit.mockRejectedValue(new Error("Database unavailable"));

    await expect(
      enqueueNotificationEmail(
        { select: mockSelect, insert: mockInsert } as never,
        {
          notificationId,
          recipientId,
          template: "task_assigned",
        },
      ),
    ).rejects.toThrow("Database unavailable");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("propagates outbox insertion errors", async () => {
    mockReturning.mockRejectedValue(
      new Error("Database unavailable"),
    );

    await expect(
      enqueueNotificationEmail(
        { select: mockSelect, insert: mockInsert } as never,
        {
          notificationId,
          recipientId,
          template: "task_assigned",
        },
      ),
    ).rejects.toThrow("Database unavailable");
  });
});
