
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureUserMock, acceptInvitationMock, AcceptInvitationErrorMock } =
  vi.hoisted(() => {
    class MockAcceptInvitationError extends Error {
      constructor(public readonly code: string) {
        super(code);
        this.name = "AcceptInvitationError";
      }
    }

    return {
      ensureUserMock: vi.fn(),
      acceptInvitationMock: vi.fn(),
      AcceptInvitationErrorMock: MockAcceptInvitationError,
    };
  });

vi.mock("@/lib/auth/ensure-user", () => ({
  ensureUser: ensureUserMock,
}));

vi.mock("@/lib/invitations/accept-invitation", () => ({
  AcceptInvitationError: AcceptInvitationErrorMock,
  acceptInvitation: acceptInvitationMock,
}));

import { POST } from "./route";
import { AcceptInvitationError } from "@/lib/invitations/accept-invitation";

const validToken = "a".repeat(43);

const authenticatedUser = {
  id: "9f7849b6-c606-467b-beb9-1166ac7cff3b",
  email: "bolu@example.com",
};

const acceptedInvitation = {
  organizationId: "2508cbcc-c873-46c2-8fc9-148f378f2def",
  role: "member" as const,
  joinedAt: new Date("2026-11-06T10:00:00.000Z"),
};

function createRequest(body: unknown) {
  return new Request("http://localhost:3000/api/invitations/accept", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function getResponseBody(response: Response) {
  return response.json();
}

describe("POST /api/invitations/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    ensureUserMock.mockResolvedValue(authenticatedUser);
    acceptInvitationMock.mockResolvedValue(acceptedInvitation);
  });

  it("accepts a valid invitation", async () => {
    const response = await POST(
      createRequest({ token: validToken }),
    );

    const body = await getResponseBody(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      message: "Invitation accepted successfully",
      organizationId: acceptedInvitation.organizationId,
      role: "member",
      joinedAt: acceptedInvitation.joinedAt.toISOString(),
    });
  });

  it("uses the authenticated user's identity and email", async () => {
    const response = await POST(
      createRequest({ token: validToken }),
    );

    expect(response.status).toBe(200);

    expect(acceptInvitationMock).toHaveBeenCalledWith({
      token: validToken,
      userId: authenticatedUser.id,
      userEmail: authenticatedUser.email,
    });
  });

  it("does not return the raw invitation token", async () => {
    const response = await POST(
      createRequest({ token: validToken }),
    );

    const body = await getResponseBody(response);

    expect(JSON.stringify(body)).not.toContain(validToken);
  });

  it("rejects unauthenticated users", async () => {
    ensureUserMock.mockRejectedValue(
      new Error("Unauthorized"),
    );

    const response = await POST(
      createRequest({ token: validToken }),
    );

    expect(response.status).toBe(401);
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("rejects deactivated accounts", async () => {
    ensureUserMock.mockRejectedValue(
      new Error("Your TeamFlow account has been deactivated"),
    );

    const response = await POST(
      createRequest({ token: validToken }),
    );

    expect(response.status).toBe(403);
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const request = new Request(
      "http://localhost:3000/api/invitations/accept",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid-json",
      },
    );

    const response = await POST(request);
    const body = await getResponseBody(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON request body");
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("rejects invalid invitation tokens", async () => {
    const response = await POST(
      createRequest({ token: "invalid-token" }),
    );

    expect(response.status).toBe(400);
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("rejects unexpected request properties", async () => {
    const response = await POST(
      createRequest({
        token: validToken,
        role: "owner",
      }),
    );

    expect(response.status).toBe(400);
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it("rejects a missing token", async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });

  it.each([
    ["NOT_FOUND", 404],
    ["EXPIRED", 410],
    ["ALREADY_ACCEPTED", 409],
    ["EMAIL_MISMATCH", 403],
    ["ALREADY_MEMBER", 409],
  ] as const)(
    "maps %s acceptance errors to HTTP %i",
    async (code, expectedStatus) => {
      acceptInvitationMock.mockRejectedValue(
        new AcceptInvitationError(code),
      );

      const response = await POST(
        createRequest({ token: validToken }),
      );

      expect(response.status).toBe(expectedStatus);
    },
  );

  it("does not expose unexpected internal errors", async () => {
    acceptInvitationMock.mockRejectedValue(
      new Error("Sensitive database connection details"),
    );

    const response = await POST(
      createRequest({ token: validToken }),
    );

    const body = await getResponseBody(response);

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unable to accept invitation");
    expect(JSON.stringify(body)).not.toContain(
      "Sensitive database connection details",
    );
  });

  it("does not call the acceptance service when user synchronization fails", async () => {
    ensureUserMock.mockRejectedValue(
      new Error("Unable to retrieve authenticated user"),
    );

    const response = await POST(
      createRequest({ token: validToken }),
    );

    expect(response.status).toBe(500);
    expect(acceptInvitationMock).not.toHaveBeenCalled();
  });
});
