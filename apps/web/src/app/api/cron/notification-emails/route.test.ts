
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processNotificationEmails: vi.fn(),
}));

vi.mock("@/lib/email/process-notification-emails", () => ({
  processNotificationEmails: mocks.processNotificationEmails,
}));

import { GET } from "./route";

describe("GET /api/cron/notification-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    mocks.processNotificationEmails.mockResolvedValue({
      claimed: 3,
      sent: 2,
      failed: 1,
      cancelled: 0,
      skipped: 0,
    });
  });

  it("returns 500 when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await GET(
      new Request("http://localhost/api/cron/notification-emails"),
    );

    expect(response.status).toBe(500);
    expect(mocks.processNotificationEmails).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization is missing", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/notification-emails"),
    );

    expect(response.status).toBe(401);
    expect(mocks.processNotificationEmails).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret is incorrect", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/notification-emails", {
        headers: {
          authorization: "Bearer wrong-secret",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.processNotificationEmails).not.toHaveBeenCalled();
  });

  it("processes notification emails with valid authorization", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/notification-emails", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Notification email processing completed",
      result: {
        claimed: 3,
        sent: 2,
        failed: 1,
        cancelled: 0,
        skipped: 0,
      },
    });

    expect(mocks.processNotificationEmails).toHaveBeenCalledOnce();
  });

  it("returns 500 when email processing fails", async () => {
    mocks.processNotificationEmails.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const response = await GET(
      new Request("http://localhost/api/cron/notification-emails", {
        headers: {
          authorization: "Bearer test-cron-secret",
        },
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Notification email processing failed",
    });
  });
});
