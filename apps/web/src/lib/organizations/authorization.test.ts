
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
  },
}));

import {
  OrganizationAccessError,
  requireOrganizationMembership,
  requireOrganizationRole,
  requireOrganizationPermission,
} from "./authorization";

const organization = {
  id: "2508cbcc-c873-46c2-8fc9-148f378f2def",
  name: "Boluski Workspace",
  slug: "boluski-workspace-c7871420",
  description: "My first TeamFlow organization",
  createdById: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  role: "owner" as const,
  joinedAt: new Date("2026-11-04T22:57:07.900Z"),
};

const organizationId = organization.id;
const userId = organization.createdById;

describe("Organization authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      innerJoin: mocks.innerJoin,
    });

    mocks.innerJoin.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      limit: mocks.limit,
    });

    mocks.limit.mockResolvedValue([organization]);
  });

  describe("requireOrganizationMembership", () => {
    it("allows a user who belongs to the organization", async () => {
      const result = await requireOrganizationMembership(
        organizationId,
        userId,
      );

      expect(result).toEqual(organization);
      expect(mocks.select).toHaveBeenCalledOnce();
      expect(mocks.limit).toHaveBeenCalledWith(1);
    });

    it("rejects a user who does not belong to the organization", async () => {
      mocks.limit.mockResolvedValue([]);

      await expect(
        requireOrganizationMembership(organizationId, "another-user-id"),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        name: "OrganizationAccessError",
      });
    });
  });

  describe("requireOrganizationRole", () => {
    it("allows an owner when the owner role is permitted", async () => {
      const result = await requireOrganizationRole(
        organizationId,
        userId,
        ["owner", "admin"],
      );

      expect(result).toEqual(organization);
      expect(result.role).toBe("owner");
    });

    it("rejects an owner when only member and viewer roles are permitted", async () => {
      await expect(
        requireOrganizationRole(
          organizationId,
          userId,
          ["member", "viewer"],
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        name: "OrganizationAccessError",
      });
    });

    it("rejects a non-member before checking their role", async () => {
      mocks.limit.mockResolvedValue([]);

      await expect(
        requireOrganizationRole(
          organizationId,
          "another-user-id",
          ["owner", "admin"],
        ),
      ).rejects.toBeInstanceOf(OrganizationAccessError);
    });
  });
});


describe("Organization permission authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.select.mockReturnValue({
      from: mocks.from,
    });

    mocks.from.mockReturnValue({
      innerJoin: mocks.innerJoin,
    });

    mocks.innerJoin.mockReturnValue({
      where: mocks.where,
    });

    mocks.where.mockReturnValue({
      limit: mocks.limit,
    });

    mocks.limit.mockResolvedValue([organization]);
  });

  const permissionCases = [
    {
      role: "owner",
      allowed: [
        "organization.delete",
        "organization.update",
        "members.change_role",
        "projects.create",
        "tasks.assign",
        "tasks.delete",
      ],
      denied: [],
    },
    {
      role: "admin",
      allowed: [
        "organization.update",
        "members.invite",
        "projects.create",
        "tasks.assign",
        "tasks.delete",
      ],
      denied: [
        "organization.delete",
        "organization.transfer_ownership",
        "members.change_role",
      ],
    },
    {
      role: "member",
      allowed: [
        "organization.view",
        "projects.create",
        "tasks.create",
        "tasks.update",
        "tasks.assign",
      ],
      denied: [
        "organization.update",
        "organization.delete",
        "members.invite",
        "members.remove",
        "tasks.delete",
      ],
    },
    {
      role: "viewer",
      allowed: [
        "organization.view",
        "projects.view",
        "tasks.view",
      ],
      denied: [
        "organization.update",
        "projects.create",
        "tasks.create",
        "tasks.update",
        "tasks.assign",
        "tasks.delete",
      ],
    },
  ] as const;

  it.each(permissionCases)(
    "enforces the permissions assigned to $role",
    async ({ role, allowed, denied }) => {
      const roleOrganization = {
        ...organization,
        role,
      };

      mocks.limit.mockResolvedValue([roleOrganization]);

      for (const permission of allowed) {
        await expect(
          requireOrganizationPermission(
            organizationId,
            userId,
            permission,
          ),
        ).resolves.toEqual(roleOrganization);
      }

      for (const permission of denied) {
        await expect(
          requireOrganizationPermission(
            organizationId,
            userId,
            permission,
          ),
        ).rejects.toMatchObject({
          code: "FORBIDDEN",
          name: "OrganizationAccessError",
        });
      }
    },
  );

  it("rejects users who are not organization members", async () => {
    mocks.limit.mockResolvedValue([]);

    await expect(
      requireOrganizationPermission(
        organizationId,
        "another-user-id",
        "projects.view",
      ),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      name: "OrganizationAccessError",
    });
  });
});
