
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(),
  requireOrganizationPermission: vi.fn(),
  resendInvitationEmail: vi.fn(),
}));

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: mocks.ensureUser,
}));

vi.mock("@/lib/organizations/authorization", () => ({
  OrganizationAccessError: class OrganizationAccessError extends Error {
    code: "NOT_FOUND" | "FORBIDDEN";

    constructor(code: "NOT_FOUND" | "FORBIDDEN") {
      super(code);
      this.code = code;
    }
  },
  requireOrganizationPermission: mocks.requireOrganizationPermission,
}));

vi.mock("@/lib/invitations/resend-invitation-email", () => ({
  resendInvitationEmail: mocks.resendInvitationEmail,
}));

import { POST } from "./route";

const organizationId = "11111111-1111-4111-8111-111111111111";
const invitationId = "22222222-2222-4222-8222-222222222222";

const context = {
  params: Promise.resolve({
    organizationId,
    invitationId,
  }),
};

function createRequest() {
  return new Request(
    `http://localhost:3000/api/organizations/${organizationId}/invitations/${invitationId}/resend`,
    { method: "POST" },
  );
}

async function getResponse() {
  const response = await POST(createRequest(), context);
  const body = await response.json();

  return { response, body };
}

describe("POST /api/organizations/[organizationId]/invitations/[invitationId]/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.ensureUser.mockResolvedValue({
      id: "user-123",
      name: "Bolu",
    });

    mocks.requireOrganizationPermission.mockResolvedValue({
      id: organizationId,
      name: "TeamFlow Workspace",
      role: "owner",
    });

    mocks.resendInvitationEmail.mockResolvedValue({
      status: "sent",
      emailId: "resend-email-123",
      recorded: true,
    });
  });

  it("resends an invitation successfully", async () => {
    const { response, body } = await getResponse();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: "Invitation renewed and email sent successfully",
      emailDelivery: {
        status: "sent",
      },
    });

    expect(mocks.resendInvitationEmail).toHaveBeenCalledWith({
      invitationId,
      organizationId,
      inviterName: "Bolu",
      organizationName: "TeamFlow Workspace",
    });
  });

  it("returns unconfirmed when delivery status could not be recorded", async () => {
    mocks.resendInvitationEmail.mockResolvedValue({
      status: "sent",
      emailId: "resend-email-123",
      recorded: false,
    });

    const { response, body } = await getResponse();

    expect(response.status).toBe(200);
    expect(body.emailDelivery.status).toBe("unconfirmed");
  });

  it("returns a delivery failure response", async () => {
    mocks.resendInvitationEmail.mockResolvedValue({
      status: "failed",
      reason: "provider",
    });

    const { response, body } = await getResponse();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      success: false,
      message: "Invitation renewed, but email delivery failed",
      emailDelivery: {
        status: "failed",
        reason: "provider",
      },
    });
  });

  it.each([
    ["not_found", 404, "Invitation not found"],
    [
      "already_accepted",
      409,
      "This invitation has already been accepted",
    ],
    [
      "sending",
      409,
      "An invitation email delivery attempt is already in progress",
    ],
    [
      "not_claimed",
      409,
      "An invitation email delivery attempt is already in progress",
    ],
  ] as const)(
    "handles %s invitation state",
    async (status, expectedStatus, message) => {
      mocks.resendInvitationEmail.mockResolvedValue({ status });

      const { response, body } = await getResponse();

      expect(response.status).toBe(expectedStatus);
      expect(body.message).toBe(message);
    },
  );

  it("rejects an invalid organization ID", async () => {
    const invalidContext = {
      params: Promise.resolve({
        organizationId: "invalid-id",
        invitationId,
      }),
    };

    const response = await POST(createRequest(), invalidContext);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid organization or invitation ID");
    expect(mocks.requireOrganizationPermission).not.toHaveBeenCalled();
    expect(mocks.resendInvitationEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid invitation ID", async () => {
    const invalidContext = {
      params: Promise.resolve({
        organizationId,
        invitationId: "invalid-id",
      }),
    };

    const response = await POST(createRequest(), invalidContext);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid organization or invitation ID");
    expect(mocks.resendInvitationEmail).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the user is not authenticated", async () => {
    mocks.ensureUser.mockRejectedValue(new Error("Unauthorized"));

    const { response, body } = await getResponse();

    expect(response.status).toBe(401);
    expect(body.message).toBe("Unauthorized");
    expect(mocks.resendInvitationEmail).not.toHaveBeenCalled();
  });

  it("returns forbidden when the user lacks invitation permission", async () => {
    const { OrganizationAccessError } = await import(
      "@/lib/organizations/authorization"
    );

    mocks.requireOrganizationPermission.mockRejectedValue(
      new OrganizationAccessError("FORBIDDEN"),
    );

    const { response, body } = await getResponse();

    expect(response.status).toBe(403);
    expect(body.message).toBe(
      "You do not have permission to resend invitations",
    );
    expect(mocks.resendInvitationEmail).not.toHaveBeenCalled();
  });

  it("returns not found when the organization does not exist", async () => {
    const { OrganizationAccessError } = await import(
      "@/lib/organizations/authorization"
    );

    mocks.requireOrganizationPermission.mockRejectedValue(
      new OrganizationAccessError("NOT_FOUND"),
    );

    const { response, body } = await getResponse();

    expect(response.status).toBe(404);
    expect(body.message).toBe("Organization not found");
  });

  it("returns forbidden for a deactivated account", async () => {
    mocks.ensureUser.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const { response, body } = await getResponse();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Account deactivated");
  });

  it("returns a safe error for unexpected failures", async () => {
    mocks.resendInvitationEmail.mockRejectedValue(
      new Error("Internal database connection details"),
    );

    const { response, body } = await getResponse();

    expect(response.status).toBe(500);
    expect(body.message).toBe(
      "Unable to complete invitation resend request",
    );
    expect(JSON.stringify(body)).not.toContain(
      "Internal database connection details",
    );
  });

  it("never exposes invitation tokens or token hashes", async () => {
    const { response, body } = await getResponse();
    const responseText = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(responseText).not.toContain("token");
    expect(responseText).not.toContain("tokenHash");
    expect(responseText).not.toContain("emailId");
  });
});
