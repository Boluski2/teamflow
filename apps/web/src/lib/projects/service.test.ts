
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  requireOrganizationPermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
  },
}));

vi.mock("@/lib/organizations/authorization", () => ({
  requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  updateProjectStatus,
} from "./service";

const organization = {
  id: "2508cbcc-c873-46c2-8fc9-148f378f2def",
  name: "Boluski Workspace",
};

const organizationId = organization.id;
const userId = "9f7849b6-c606-467b-beb9-1166ac7cff3b";
const projectId = "b9c8f7c0-2e75-4d5d-9d92-91b0d35e44a1";

const project = {
  id: projectId,
  organizationId,
  name: "Website Redesign",
  description: "Redesign the company website",
  status: "active" as const,
  createdById: userId,
  startDate: new Date("2026-11-09T09:00:00.000Z"),
  dueDate: new Date("2026-12-09T09:00:00.000Z"),
  createdAt: new Date("2026-11-09T09:00:00.000Z"),
  updatedAt: new Date("2026-11-09T09:00:00.000Z"),
};

describe("Project service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireOrganizationPermission.mockResolvedValue(organization);

    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      orderBy: mocks.orderBy,
      limit: mocks.limit,
      returning: mocks.returning,
    });

    mocks.orderBy.mockResolvedValue([project]);
    mocks.limit.mockResolvedValue([project]);
    mocks.returning.mockResolvedValue([project]);

    mocks.insert.mockReturnValue({
      values: mocks.values,
    });

    mocks.values.mockReturnValue({
      returning: mocks.returning,
    });

    mocks.update.mockReturnValue({
      set: mocks.set,
    });

    mocks.set.mockReturnValue({
      where: mocks.where,
    });
  });

  describe("createProject", () => {
    it("creates a project within an authorized organization", async () => {
      const result = await createProject(
        organizationId,
        userId,
        {
          name: "Website Redesign",
          description: "Redesign the company website",
          startDate: "2026-11-09T09:00:00.000Z",
          dueDate: "2026-12-09T09:00:00.000Z",
        },
      );

      expect(result).toEqual(project);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "projects.create",
      );

      expect(mocks.values).toHaveBeenCalledWith({
        organizationId,
        name: "Website Redesign",
        description: "Redesign the company website",
        startDate: new Date("2026-11-09T09:00:00.000Z"),
        dueDate: new Date("2026-12-09T09:00:00.000Z"),
        createdById: userId,
      });
    });

    it("rejects project creation when permission is denied", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        createProject(organizationId, userId, {
          name: "Website Redesign",
        }),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.insert).not.toHaveBeenCalled();
    });

    it("rejects inconsistent project dates", async () => {
      await expect(
        createProject(organizationId, userId, {
          name: "Website Redesign",
          startDate: "2026-12-10T09:00:00.000Z",
          dueDate: "2026-12-09T09:00:00.000Z",
        }),
      ).rejects.toThrow(
        "Due date cannot be earlier than start date",
      );

      expect(mocks.insert).not.toHaveBeenCalled();
    });
  });

  describe("listProjects", () => {
    it("lists projects for an authorized organization", async () => {
      const result = await listProjects(organizationId, userId);

      expect(result).toEqual([project]);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "projects.view",
      );

      expect(mocks.orderBy).toHaveBeenCalledOnce();
    });

    it("rejects listing when the user lacks permission", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        listProjects(organizationId, userId),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.select).not.toHaveBeenCalled();
    });
  });

  describe("getProject", () => {
    it("retrieves a project", async () => {
      const result = await getProject(
        organizationId,
        projectId,
        userId,
      );

      expect(result).toEqual(project);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "projects.view",
      );

      expect(mocks.limit).toHaveBeenCalledWith(1);
    });

    it("returns null when the project does not exist", async () => {
      mocks.limit.mockResolvedValue([]);

      const result = await getProject(
        organizationId,
        projectId,
        userId,
      );

      expect(result).toBeNull();
    });
  });

  describe("updateProject", () => {
    it("updates project details", async () => {
      const result = await updateProject(
        organizationId,
        projectId,
        userId,
        {
          name: "Updated Website",
        },
      );

      expect(result).toEqual(project);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "projects.update",
      );

      expect(mocks.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Website",
          updatedAt: expect.any(Date),
        }),
      );
    });

    it("returns null when the project does not exist", async () => {
      mocks.limit.mockResolvedValue([]);

      const result = await updateProject(
        organizationId,
        projectId,
        userId,
        {
          name: "Updated Website",
        },
      );

      expect(result).toBeNull();
      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("rejects an update that makes the due date earlier than the existing start date", async () => {
      await expect(
        updateProject(
          organizationId,
          projectId,
          userId,
          {
            dueDate: "2026-11-01T09:00:00.000Z",
          },
        ),
      ).rejects.toThrow(
        "Due date cannot be earlier than start date",
      );

      expect(mocks.update).not.toHaveBeenCalled();
    });

    it("rejects updates when permission is denied", async () => {
      mocks.requireOrganizationPermission.mockRejectedValue(
        new Error("FORBIDDEN"),
      );

      await expect(
        updateProject(
          organizationId,
          projectId,
          userId,
          {
            name: "Updated Website",
          },
        ),
      ).rejects.toThrow("FORBIDDEN");

      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  describe("updateProjectStatus", () => {
    it("archives a project using archive permission", async () => {
      const result = await updateProjectStatus(
        organizationId,
        projectId,
        userId,
        {
          status: "archived",
        },
      );

      expect(result).toEqual(project);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "projects.archive",
      );

      expect(mocks.set).toHaveBeenCalledWith({
        status: "archived",
        updatedAt: expect.any(Date),
      });
    });

    it("reactivates a project using update permission", async () => {
      const result = await updateProjectStatus(
        organizationId,
        projectId,
        userId,
        {
          status: "active",
        },
      );

      expect(result).toEqual(project);

      expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
        organizationId,
        userId,
        "projects.update",
      );
    });

    it("returns null when the project does not exist", async () => {
      mocks.returning.mockResolvedValue([]);

      const result = await updateProjectStatus(
        organizationId,
        projectId,
        userId,
        {
          status: "archived",
        },
      );

      expect(result).toBeNull();
    });
  });
});
