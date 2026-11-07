
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  requireOrganizationPermission: vi.fn(),
  createInvitation: vi.fn(),
  deliverInvitationEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/invitations/deliver-invitation-email", () => ({
  deliverInvitationEmail: mocks.deliverInvitationEmail,
}));


vi.mock("@/lib/organizations/authorization", () => ({
  OrganizationAccessError: class OrganizationAccessError extends Error {
    constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
      this.name = "OrganizationAccessError";
    }
  },
  requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

vi.mock("@/lib/invitations/create-invitation", () => ({
  createInvitation: mocks.createInvitation,
  InvitationServiceError: class InvitationServiceError extends Error {
    constructor(
      public readonly code:
        | "FORBIDDEN_ROLE"
        | "ALREADY_MEMBER"
        | "PENDING_INVITATION_EXISTS",
    ) {
      super(code);
      this.name = "InvitationServiceError";
    }
  },
}));

import { POST } from "./route";
import {
  OrganizationAccessError,
} from "@/lib/organizations/authorization";
import {
  InvitationServiceError,
} from "@/lib/invitations/create-invitation";

const user = {
  id: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  email: "test@example.com",
  name: "Test User",
  isActive: true,
};

const organization = {
  id: "2508cbcc-c873-46c2-8fc9-148f378f2def",
  name: "TeamFlow Workspace",
  role: "owner",
};

const organizationId = organization.id;


const invitation = {
  id: "f4d8babc-2f73-4b6e-8e3a-5c2a6a9f1234",
  organizationId,
  email: "newmember@example.com",
  role: "member",
  invitedById: user.id,
  expiresAt: new Date("2026-11-13T00:00:00.000Z"),
  createdAt: new Date("2026-11-06T00:00:00.000Z"),
};

const rawToken = "this-is-a-secret-invitation-token";
const tokenHash = "secret-token-hash";

function createContext(id: string) {
  return {
    params: Promise.resolve({
      organizationId: id,
    }),
  };
}

function createPostRequest(
  body: unknown,
  id = organizationId,
) {
  return new Request(
    `http://localhost/api/organizations/${id}/invitations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/organizations/[organizationId]/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue(user);
    mocks.requireOrganizationPermission.mockResolvedValue(organization);

    mocks.createInvitation.mockResolvedValue({
      invitation,
      token: rawToken,
    });

    mocks.deliverInvitationEmail.mockResolvedValue({
  status: "sent",
  emailId: "resend-email-123",
  recorded: true,
});
  });

  it("creates an invitation for an authorized organization owner", async () => {
    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.emailDelivery.status).toBe("sent");
    expect(body.invitation.email).toBe("newmember@example.com");
    expect(body.invitation.role).toBe("member");

    expect(mocks.ensureUser).toHaveBeenCalledOnce();

    expect(mocks.requireOrganizationPermission).toHaveBeenCalledWith(
      organizationId,
      user.id,
      "members.invite",
    );

    expect(mocks.createInvitation).toHaveBeenCalledWith({
      organizationId,
      inviterId: user.id,
      inviterRole: "owner",
      email: "newmember@example.com",
      role: "member",
    });

    expect(mocks.deliverInvitationEmail).toHaveBeenCalledWith({
      invitationId: invitation.id,
      token: rawToken,
      inviterName: user.name,
      organizationName: organization.name,
    });
  });

  it("returns 201 when invitation is created but email delivery fails", async () => {
    mocks.deliverInvitationEmail.mockResolvedValue({
      status: "failed",
      reason: "provider",
    });

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.emailDelivery.status).toBe("failed");
    expect(body.message).toBe(
      "Invitation created, but email delivery failed",
    );
  });

  it("returns not_claimed when email delivery cannot claim the invitation", async () => {
    mocks.deliverInvitationEmail.mockResolvedValue({
      status: "not_claimed",
    });

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.emailDelivery.status).toBe("not_claimed");
  });

  it("reports unconfirmed when email was accepted but its status was not recorded", async () => {
    mocks.deliverInvitationEmail.mockResolvedValue({
      status: "sent",
      emailId: "resend-email-123",
      recorded: false,
    });

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.emailDelivery.status).toBe("unconfirmed");
  });

  it("does not expose the raw invitation token or token hash", async () => {
    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    const responseText = await response.text();

    expect(response.status).toBe(201);
    expect(responseText).not.toContain(rawToken);
    expect(responseText).not.toContain(tokenHash);
    expect(responseText).not.toContain("token");
    expect(responseText).not.toContain("tokenHash");
  });

  it("returns 400 for an invalid organization ID", async () => {
    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }, "invalid"),
      createContext("invalid"),
    );

    expect(response.status).toBe(400);
    expect(mocks.requireOrganizationPermission).not.toHaveBeenCalled();
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new Request(
      `http://localhost/api/organizations/${organizationId}/invitations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid-json",
      },
    );

    const response = await POST(
      request,
      createContext(organizationId),
    );

    expect(response.status).toBe(400);
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid invitation data", async () => {
    const response = await POST(
      createPostRequest({
        email: "not-an-email",
        role: "member",
      }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid invitation data");
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("returns 403 when the requester lacks invitation permission", async () => {
    mocks.requireOrganizationPermission.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    expect(response.status).toBe(403);
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("returns 404 when the organization does not exist or is inaccessible", async () => {
    mocks.requireOrganizationPermission.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    expect(response.status).toBe(404);
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("returns 403 when the invitation service rejects the requested role", async () => {
    mocks.createInvitation.mockRejectedValue(
      new InvitationServiceError("FORBIDDEN_ROLE"),
    );

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "admin",
      }),
      createContext(organizationId),
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when the invitee is already a member", async () => {
    mocks.createInvitation.mockRejectedValue(
      new InvitationServiceError("ALREADY_MEMBER"),
    );

    const response = await POST(
      createPostRequest({
        email: "existing@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    expect(response.status).toBe(409);
  });

  it("returns 409 when a pending invitation already exists", async () => {
    mocks.createInvitation.mockRejectedValue(
      new InvitationServiceError("PENDING_INVITATION_EXISTS"),
    );

    const response = await POST(
      createPostRequest({
        email: "pending@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    expect(response.status).toBe(409);
  });

  it("returns 401 when the requester is unauthenticated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Unauthorized"),
    );

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    expect(response.status).toBe(401);
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("returns 403 when the account is deactivated", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    expect(response.status).toBe(403);
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("does not expose unexpected internal errors", async () => {
    mocks.createInvitation.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await POST(
      createPostRequest({
        email: "newmember@example.com",
        role: "member",
      }),
      createContext(organizationId),
    );

    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );

    consoleSpy.mockRestore();
  });
});
