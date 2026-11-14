
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTransaction,
  mockUpdate,
  mockSet,
  mockWhere,
  mockReturning,
  mockSelect,
  mockFrom,
  mockSelectWhere,
  mockOrderBy,
  mockLimit,
  mockFor,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
  mockReturning: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockOrderBy: vi.fn(),
  mockLimit: vi.fn(),
  mockFor: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/schema", () => ({
  emailOutbox: {
    id: "email_outbox.id",
    notificationId: "email_outbox.notification_id",
    template: "email_outbox.template",
    payload: "email_outbox.payload",
    attempts: "email_outbox.attempts",
    status: "email_outbox.status",
    leaseExpiresAt: "email_outbox.lease_expires_at",
    nextAttemptAt: "email_outbox.next_attempt_at",
    providerMessageId: "email_outbox.provider_message_id",
    sentAt: "email_outbox.sent_at",
    lastError: "email_outbox.last_error",
    updatedAt: "email_outbox.updated_at",
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: mockTransaction,
    update: mockUpdate,
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ conditions })),
  asc: vi.fn((column) => ({ column })),
  eq: vi.fn((column, value) => ({ column, value })),
  gt: vi.fn((column, value) => ({ column, value })),
  inArray: vi.fn((column, values) => ({ column, values })),
  lte: vi.fn((column, value) => ({ column, value })),
  or: vi.fn((...conditions) => ({ conditions })),
  sql: Object.assign(
    vi.fn((strings, ...values) => ({ strings, values })),
    { raw: vi.fn() },
  ),
}));

import {
  claimEmailJobs,
  markEmailJobFailed,
  markEmailJobSent,
  markEmailJobCancelled
} from "./outbox-worker";

describe("Email outbox worker", () => {
  const now = new Date("2026-11-14T10:00:00.000Z");
  const leaseExpiresAt = new Date("2026-11-14T10:05:00.000Z");

  const claimedJobs = [
    {
      id: "email-job-123",
      notificationId: "notification-123",
      template: "task_assigned",
      payload: { taskTitle: "Build dashboard" },
      attempts: 1,
      leaseExpiresAt,
    },
  ];

  let whereCallCount: number;

  function setupDirectUpdate() {
    mockUpdate.mockReturnValue({
      set: mockSet,
    });

    mockSet.mockReturnValue({
      where: mockWhere,
    });

    mockWhere.mockReturnValue({
      returning: mockReturning,
    });

    mockReturning.mockResolvedValue([{ id: "email-job-123" }]);
  }

  beforeEach(() => {
    vi.clearAllMocks();

    whereCallCount = 0;

    mockSet.mockReturnValue({ where: mockWhere });

    mockWhere.mockImplementation(() => {
      whereCallCount += 1;

      if (whereCallCount === 3) {
        return { returning: mockReturning };
      }

      return Promise.resolve();
    });

    mockUpdate.mockReturnValue({ set: mockSet });

    mockFor.mockResolvedValue([{ id: "email-job-123" }]);
    mockLimit.mockReturnValue({ for: mockFor });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockReturning.mockResolvedValue(claimedJobs);

    mockTransaction.mockImplementation(async (callback) =>
      callback({
        update: mockUpdate,
        select: mockSelect,
      }),
    );
  });

  describe("claimEmailJobs", () => {
    it("claims eligible email jobs", async () => {
      const result = await claimEmailJobs({ now });

      expect(result).toEqual(claimedJobs);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledTimes(3);
      expect(mockFor).toHaveBeenCalledWith("update", {
        skipLocked: true,
      });
    });

    it("returns an empty array when no eligible jobs exist", async () => {
      mockFor.mockResolvedValue([]);

      const result = await claimEmailJobs({ now });

      expect(result).toEqual([]);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockReturning).not.toHaveBeenCalled();
    });

    it("uses the configured lease duration", async () => {
      await claimEmailJobs({ now, leaseMinutes: 10 });

      expect(mockSet.mock.calls[2][0].leaseExpiresAt).toEqual(
        new Date("2026-11-14T10:10:00.000Z"),
      );
    });

    it("uses the default lease duration", async () => {
      await claimEmailJobs({ now });

      expect(mockSet.mock.calls[2][0].leaseExpiresAt).toEqual(
        leaseExpiresAt,
      );
    });

    it("rejects an invalid batch size", async () => {
      await expect(claimEmailJobs({ batchSize: 0 })).rejects.toThrow(
        "batchSize must be a positive integer",
      );

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("rejects an invalid lease duration", async () => {
      await expect(claimEmailJobs({ leaseMinutes: 0 })).rejects.toThrow(
        "leaseMinutes must be a positive integer",
      );
    });

    it("rejects an invalid maximum attempt count", async () => {
      await expect(claimEmailJobs({ maxAttempts: 0 })).rejects.toThrow(
        "maxAttempts must be a positive integer",
      );
    });

    it("propagates database errors", async () => {
      mockTransaction.mockRejectedValue(
        new Error("Database unavailable"),
      );

      await expect(claimEmailJobs({ now })).rejects.toThrow(
        "Database unavailable",
      );
    });
  });

  describe("markEmailJobSent", () => {
    it("marks a job as sent", async () => {
      setupDirectUpdate();

      const result = await markEmailJobSent({
        jobId: "email-job-123",
        leaseExpiresAt,
        now,
      });

      expect(result).toBe(true);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "sent",
          sentAt: now,
          leaseExpiresAt: null,
          lastError: null,
          updatedAt: now,
        }),
      );
    });

    it("records the provider message ID", async () => {
      setupDirectUpdate();

      await markEmailJobSent({
        jobId: "email-job-123",
        leaseExpiresAt,
        providerMessageId: "resend-message-123",
        now,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMessageId: "resend-message-123",
        }),
      );
    });

    it("returns false when the lease is no longer owned", async () => {
      setupDirectUpdate();
      mockReturning.mockResolvedValue([]);

      const result = await markEmailJobSent({
        jobId: "email-job-123",
        leaseExpiresAt,
        now,
      });

      expect(result).toBe(false);
    });

    it("propagates database errors", async () => {
      setupDirectUpdate();
      mockReturning.mockRejectedValue(
        new Error("Database unavailable"),
      );

      await expect(
        markEmailJobSent({
          jobId: "email-job-123",
          leaseExpiresAt,
          now,
        }),
      ).rejects.toThrow("Database unavailable");
    });
  });


  describe("markEmailJobCancelled", () => {
    it("cancels a job owned by the current worker", async () => {
      setupDirectUpdate();

      const result = await markEmailJobCancelled({
        jobId: "email-job-123",
        leaseExpiresAt,
        now,
      });

      expect(result).toBe(true);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          leaseExpiresAt: null,
          lastError: null,
          updatedAt: now,
        }),
      );
    });

    it("returns false when the lease is no longer owned", async () => {
      setupDirectUpdate();
      mockReturning.mockResolvedValue([]);

      const result = await markEmailJobCancelled({
        jobId: "email-job-123",
        leaseExpiresAt,
        now,
      });

      expect(result).toBe(false);
    });

    it("propagates database errors", async () => {
      setupDirectUpdate();
      mockReturning.mockRejectedValue(
        new Error("Database unavailable"),
      );

      await expect(
        markEmailJobCancelled({
          jobId: "email-job-123",
          leaseExpiresAt,
          now,
        }),
      ).rejects.toThrow("Database unavailable");
    });
  });


  describe("markEmailJobFailed", () => {
    it("schedules the first retry after five minutes", async () => {
      setupDirectUpdate();

      const result = await markEmailJobFailed({
        jobId: "email-job-123",
        leaseExpiresAt,
        attempts: 1,
        error: new Error("Temporary provider error"),
        now,
      });

      expect(result).toBe(true);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
          nextAttemptAt: new Date("2026-11-14T10:05:00.000Z"),
          leaseExpiresAt: null,
          lastError: "Temporary provider error",
        }),
      );
    });

    it("uses exponential retry delays", async () => {
      setupDirectUpdate();

      await markEmailJobFailed({
        jobId: "email-job-123",
        leaseExpiresAt,
        attempts: 3,
        error: "Provider unavailable",
        now,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          nextAttemptAt: new Date("2026-11-14T10:20:00.000Z"),
        }),
      );
    });

    it("permanently fails a job after the maximum attempts", async () => {
      setupDirectUpdate();

      await markEmailJobFailed({
        jobId: "email-job-123",
        leaseExpiresAt,
        attempts: 5,
        error: "Delivery rejected",
        now,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          nextAttemptAt: now,
          lastError: "Delivery rejected",
        }),
      );
    });

    it("returns false when the lease is no longer owned", async () => {
      setupDirectUpdate();
      mockReturning.mockResolvedValue([]);

      const result = await markEmailJobFailed({
        jobId: "email-job-123",
        leaseExpiresAt,
        attempts: 1,
        error: "Temporary error",
        now,
      });

      expect(result).toBe(false);
    });

    it("rejects invalid attempt counts", async () => {
      await expect(
        markEmailJobFailed({
          jobId: "email-job-123",
          leaseExpiresAt,
          attempts: 0,
          error: "Temporary error",
          now,
        }),
      ).rejects.toThrow("attempts must be a positive integer");
    });

    it("rejects invalid maximum attempts", async () => {
      await expect(
        markEmailJobFailed({
          jobId: "email-job-123",
          leaseExpiresAt,
          attempts: 1,
          error: "Temporary error",
          maxAttempts: 0,
          now,
        }),
      ).rejects.toThrow("maxAttempts must be a positive integer");
    });

    it("propagates database errors", async () => {
      setupDirectUpdate();
      mockReturning.mockRejectedValue(
        new Error("Database unavailable"),
      );

      await expect(
        markEmailJobFailed({
          jobId: "email-job-123",
          leaseExpiresAt,
          attempts: 1,
          error: "Temporary error",
          now,
        }),
      ).rejects.toThrow("Database unavailable");
    });
  });
});
