
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  requireOrganizationMembership: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/lib/organizations/authorization", () => ({
  requireOrganizationMembership: mocks.requireOrganizationMembership,
}));

import { listTaskActivities } from "./service";

const organizationId = "organization-1";
const projectId = "project-1";
const taskId = "task-1";
const userId = "user-1";

const activity = {
  id: "activity-1",
  organizationId,
  projectId,
  taskId,
  actorId: userId,
  actorName: "Test User",
  type: "task_created",
  metadata: {
    taskTitle: "Build dashboard",
  },
  createdAt: new Date("2026-11-10T08:00:00.000Z"),
};

function setupTaskQuery(taskExists = true) {
  mocks.limit.mockResolvedValue(
    taskExists ? [{ id: taskId }] : [],
  );
}

function setupActivityQuery(activities = [activity]) {
  mocks.orderBy.mockResolvedValue(activities);
}

describe("listTaskActivities", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireOrganizationMembership.mockResolvedValue({
      role: "member",
    });

    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      innerJoin: mocks.innerJoin,
      where: mocks.where,
    });

    mocks.innerJoin.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      limit: mocks.limit,
      orderBy: mocks.orderBy,
    });

    setupTaskQuery();
    setupActivityQuery();
  });

  it("allows organization members to read task activities", async () => {
    const result = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      userId,
    );

    expect(result).toEqual([activity]);

    expect(
      mocks.requireOrganizationMembership,
    ).toHaveBeenCalledWith(organizationId, userId);
  });

  it("allows viewers to read task activities", async () => {
    mocks.requireOrganizationMembership.mockResolvedValue({
      role: "viewer",
    });

    const result = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      userId,
    );

    expect(result).toEqual([activity]);
  });

  it("allows owners to read task activities", async () => {
    mocks.requireOrganizationMembership.mockResolvedValue({
      role: "owner",
    });

    const result = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      userId,
    );

    expect(result).toEqual([activity]);
  });

  it("allows admins to read task activities", async () => {
    mocks.requireOrganizationMembership.mockResolvedValue({
      role: "admin",
    });

    const result = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      userId,
    );

    expect(result).toEqual([activity]);
  });

  it("rejects users who are not organization members", async () => {
    mocks.requireOrganizationMembership.mockRejectedValue(
      new Error("Organization access denied"),
    );

    await expect(
      listTaskActivities(
        organizationId,
        projectId,
        taskId,
        userId,
      ),
    ).rejects.toThrow("Organization access denied");

    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("returns null when the task does not belong to the project", async () => {
    setupTaskQuery(false);

    const result = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      userId,
    );

    expect(result).toBeNull();
    expect(mocks.orderBy).not.toHaveBeenCalled();
  });

  it("returns an empty array when a task has no activities", async () => {
    setupActivityQuery([]);

    const result = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      userId,
    );

    expect(result).toEqual([]);
  });

  it("returns activities in chronological order", async () => {
    const firstActivity = {
      ...activity,
      id: "activity-1",
      createdAt: new Date("2026-11-10T08:00:00.000Z"),
    };

    const secondActivity = {
      ...activity,
      id: "activity-2",
      createdAt: new Date("2026-11-10T09:00:00.000Z"),
    };

    setupActivityQuery([firstActivity, secondActivity]);

    const result = await listTaskActivities(
      organizationId,
      projectId,
      taskId,
      userId,
    );

    expect(result).toEqual([firstActivity, secondActivity]);
    expect(mocks.orderBy).toHaveBeenCalledOnce();
  });
});
