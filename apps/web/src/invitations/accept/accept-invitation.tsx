"use client";

import { useState } from "react";

type InvitationState =
  | { status: "ready" }
  | { status: "submitting" }
  | {
      status: "success";
      organizationName: string;
      role: string;
    }
  | {
      status: "error";
      message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function AcceptInvitation({
  token,
}: {
  token: string;
}) {
  const [state, setState] = useState<InvitationState>({
    status: "ready",
  });

  async function handleAccept() {
    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Unable to accept this invitation. Please try again.";

        setState({
          status: "error",
          message,
        });

        return;
      }

      if (
        !isRecord(payload) ||
        typeof payload.organizationId !== "string" ||
        typeof payload.role !== "string"
      ) {
        throw new Error("The invitation response was invalid.");
      }

      let organizationName = "your organization";

      try {
        const organizationResponse = await fetch(
          `/api/organizations/${encodeURIComponent(payload.organizationId)}`,
          { cache: "no-store" },
        );

        const organizationPayload: unknown =
          await organizationResponse.json();

        if (
          organizationResponse.ok &&
          isRecord(organizationPayload) &&
          isRecord(organizationPayload.organization) &&
          typeof organizationPayload.organization.name === "string"
        ) {
          organizationName = organizationPayload.organization.name;
        }
      } catch {
        // Membership was already accepted.
        // Organization details are supplementary.
      }

      setState({
        status: "success",
        organizationName,
        role: payload.role,
      });
    } catch {
      setState({
        status: "error",
        message: "Something went wrong. Please try again.",
      });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-6 text-sm font-semibold tracking-wide text-blue-600">
          TEAMFLOW
        </p>

        {state.status === "success" ? (
          <>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              ✓
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Invitation accepted
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              You are now a member of{" "}
              <strong className="font-semibold text-gray-900">
                {state.organizationName}
              </strong>{" "}
              as an{" "}
              <strong className="font-semibold text-gray-900">
                {state.role}
              </strong>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Accept your invitation
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              You&apos;re signed in. Continue to accept your invitation to join
              this TeamFlow organization.
            </p>

            {state.status === "error" && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {state.message}
              </div>
            )}

            <button
              type="button"
              onClick={handleAccept}
              disabled={state.status === "submitting"}
              className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.status === "submitting"
                ? "Accepting invitation..."
                : "Accept invitation"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}