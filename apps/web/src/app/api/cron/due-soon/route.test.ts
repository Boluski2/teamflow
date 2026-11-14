
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { mockProcessDueSoonNotifications } = vi.hoisted(() => ({
  mockProcessDueSoonNotifications: vi.fn(),
}));

vi.mock("@/lib/notifications/due-soon", () => ({
  processDueSoonNotifications: mockProcessDueSoonNotifications,
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

const cronSecret = "test-cron-secret";

function createRequest(authorization?: string) {
  return new NextRequest(
    "http://localhost:3000/api/cron/due-soon",
    {
      method: "GET",
      headers: authorization
        ? { authorization }
        : undefined,
    },
  );
}

describe("Due-soon cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubEnv("CRON_SECRET", cronSecret);

    mockProcessDueSoonNotifications.mockResolvedValue({
      scannedTasks: 5,
      notificationsCreated: 3,
      windowHours: 24,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without an authorization header", async () => {
    const response = await GET(createRequest());

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });

    expect(mockProcessDueSoonNotifications).not.toHaveBeenCalled();
  });

  it("rejects an incorrect cron secret", async () => {
    const response = await GET(
      createRequest("Bearer incorrect-secret"),
    );

    expect(response.status).toBe(401);

    expect(mockProcessDueSoonNotifications).not.toHaveBeenCalled();
  });

  it("rejects a secret without the Bearer prefix", async () => {
    const response = await GET(
      createRequest(cronSecret),
    );

    expect(response.status).toBe(401);

    expect(mockProcessDueSoonNotifications).not.toHaveBeenCalled();
  });

  it("returns a configuration error when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await GET(
      createRequest("Bearer test-cron-secret"),
    );

    expect(response.status).toBe(500);

    expect(await response.json()).toEqual({
      error: "Cron endpoint is not configured",
    });

    expect(mockProcessDueSoonNotifications).not.toHaveBeenCalled();
  });

  it("processes notifications when the correct secret is supplied", async () => {
    const response = await GET(
      createRequest(`Bearer ${cronSecret}`),
    );

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      success: true,
      message: "Due-soon notifications processed",
      scannedTasks: 5,
      notificationsCreated: 3,
      windowHours: 24,
    });

    expect(mockProcessDueSoonNotifications).toHaveBeenCalledOnce();
  });

  it("returns a safe error when notification processing fails", async () => {
    mockProcessDueSoonNotifications.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const response = await GET(
      createRequest(`Bearer ${cronSecret}`),
    );

    expect(response.status).toBe(500);

    expect(await response.json()).toEqual({
      error: "Failed to process due-soon notifications",
    });
  });
});
