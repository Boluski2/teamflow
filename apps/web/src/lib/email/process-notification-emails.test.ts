
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  claimEmailJobs: vi.fn(),
  markEmailJobCancelled: vi.fn(),
  markEmailJobFailed: vi.fn(),
  markEmailJobSent: vi.fn(),
  sendNotificationEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/email/outbox-worker", () => ({
  claimEmailJobs: mocks.claimEmailJobs,
  markEmailJobCancelled: mocks.markEmailJobCancelled,
  markEmailJobFailed: mocks.markEmailJobFailed,
  markEmailJobSent: mocks.markEmailJobSent,
}));

vi.mock("@/lib/email/send-notification-email", () => ({
  sendNotificationEmail: mocks.sendNotificationEmail,
}));

import { processNotificationEmails } from "@/lib/email/process-notification-emails";

const leaseExpiresAt = new Date("2026-11-14T14:00:00.000Z");

const job = {
  id: "job-1",
  notificationId: "notification-1",
  template: "task_assigned",
  payload: {
    taskTitle: "Build dashboard",
  },
  attempts: 1,
  leaseExpiresAt,
};

const deliveryContext: {
  email: string;
  recipientName: string;
  isActive: boolean;
  emailEnabled: boolean | null;
  notificationType: string;
  notificationTitle: string;
  notificationMessage: string;
  metadata: Record<string, unknown>;
  organizationSlug: string;
  projectId: string | null;
} = {
  email: "member@example.com",
  recipientName: "Team Member",
  isActive: true,
  emailEnabled: true,
  notificationType: "task_assigned",
  notificationTitle: "You have been assigned a task",
  notificationMessage: "A task has been assigned to you.",
  metadata: {},
  organizationSlug: "acme-workspace",
  projectId: "project-1",
};

const queryBuilder = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  leftJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};

function configureDeliveryContext(
  context: typeof deliveryContext | null = deliveryContext,
) {
  queryBuilder.from.mockReturnThis();
  queryBuilder.innerJoin.mockReturnThis();
  queryBuilder.leftJoin.mockReturnThis();
  queryBuilder.where.mockReturnThis();
  queryBuilder.limit.mockResolvedValue(context ? [context] : []);

  mocks.select.mockReturnValue(queryBuilder);
}

describe("processNotificationEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.claimEmailJobs.mockResolvedValue([job]);
    mocks.markEmailJobCancelled.mockResolvedValue(true);
    mocks.markEmailJobFailed.mockResolvedValue(true);
    mocks.markEmailJobSent.mockResolvedValue(true);

    mocks.sendNotificationEmail.mockResolvedValue({
      success: true,
      emailId: "resend-message-123",
    });

    configureDeliveryContext();
  });

  it("sends eligible notification emails", async () => {
    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).toHaveBeenCalledWith({
      email: "member@example.com",
      recipientName: "Team Member",
      notificationType: "task_assigned",
      notificationTitle: "You have been assigned a task",
      notificationMessage: "A task has been assigned to you.",
      taskTitle: "Build dashboard",
      appUrl:
        "/dashboard/acme-workspace/projects/project-1",
    });

    expect(mocks.markEmailJobSent).toHaveBeenCalledWith({
      jobId: "job-1",
      leaseExpiresAt,
      providerMessageId: "resend-message-123",
    });

    expect(result).toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
      cancelled: 0,
      skipped: 0,
    });
  });

  it("cancels delivery when the user has not enabled email", async () => {
    configureDeliveryContext({
      ...deliveryContext,
      emailEnabled: false,
    });

    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).not.toHaveBeenCalled();
    expect(mocks.markEmailJobCancelled).toHaveBeenCalledWith({
      jobId: "job-1",
      leaseExpiresAt,
    });
    expect(result.cancelled).toBe(1);
  });

  it("cancels delivery when no preference record exists", async () => {
    configureDeliveryContext({
      ...deliveryContext,
      emailEnabled: null,
    });

    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("cancels delivery for inactive users", async () => {
    configureDeliveryContext({
      ...deliveryContext,
      isActive: false,
    });

    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("cancels delivery when the notification context is missing", async () => {
    configureDeliveryContext(null);

    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).not.toHaveBeenCalled();
    expect(mocks.markEmailJobCancelled).toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("cancels unsupported email templates", async () => {
    mocks.claimEmailJobs.mockResolvedValue([
      {
        ...job,
        template: "unknown_template",
      },
    ]);

    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).not.toHaveBeenCalled();
    expect(mocks.markEmailJobCancelled).toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("cancels jobs when the template does not match the notification type", async () => {
    mocks.claimEmailJobs.mockResolvedValue([
      {
        ...job,
        template: "task_assigned",
      },
    ]);

    configureDeliveryContext({
      ...deliveryContext,
      notificationType: "task_unassigned",
    });

    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("uses the workspace URL when the project no longer exists", async () => {
    configureDeliveryContext({
      ...deliveryContext,
      projectId: null,
    });

    await processNotificationEmails();

    expect(mocks.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        appUrl: "/dashboard/acme-workspace",
      }),
    );
  });

  it("uses metadata task title when the outbox payload has none", async () => {
    mocks.claimEmailJobs.mockResolvedValue([
      {
        ...job,
        payload: {},
      },
    ]);

    configureDeliveryContext({
      ...deliveryContext,
      metadata: {
        taskTitle: "Task from notification metadata",
      },
    });

    await processNotificationEmails();

    expect(mocks.sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        taskTitle: "Task from notification metadata",
      }),
    );
  });

  it("marks provider failures for retry", async () => {
    mocks.sendNotificationEmail.mockResolvedValue({
      success: false,
      reason: "provider",
    });

    const result = await processNotificationEmails();

    expect(mocks.markEmailJobFailed).toHaveBeenCalledWith({
      jobId: "job-1",
      leaseExpiresAt,
      attempts: 1,
      error: "Notification email delivery failed: provider",
    });

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("does not mark a job sent if the lease is no longer owned", async () => {
    mocks.markEmailJobSent.mockResolvedValue(false);

    const result = await processNotificationEmails();

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("does not count a job as cancelled if its lease is no longer owned", async () => {
    configureDeliveryContext({
      ...deliveryContext,
      emailEnabled: false,
    });

    mocks.markEmailJobCancelled.mockResolvedValue(false);

    const result = await processNotificationEmails();

    expect(result.cancelled).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("continues processing other jobs when one job throws", async () => {
    mocks.claimEmailJobs.mockResolvedValue([
      job,
      {
        ...job,
        id: "job-2",
        notificationId: "notification-2",
      },
    ]);

    queryBuilder.limit
      .mockRejectedValueOnce(new Error("Database unavailable"))
      .mockResolvedValueOnce([deliveryContext]);

    const result = await processNotificationEmails();

    expect(mocks.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(mocks.markEmailJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        attempts: 1,
      }),
    );

    expect(result.claimed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it("returns zero counts when no jobs are available", async () => {
    mocks.claimEmailJobs.mockResolvedValue([]);

    const result = await processNotificationEmails();

    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.sendNotificationEmail).not.toHaveBeenCalled();

    expect(result).toEqual({
      claimed: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0,
    });
  });
});
