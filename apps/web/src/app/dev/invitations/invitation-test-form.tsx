"use client";

import { useState, type FormEvent } from "react";

type InvitationResult = {
  httpStatus: number;
  success: boolean;
  payload: unknown;
};

export default function InvitationTestForm() {
  const [organizationId, setOrganizationId] = useState(
    "386619fe-fc63-4105-a835-7526614b5fae",
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvitationResult | null>(null);

  function getDevelopmentUrl(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const development = (payload as Record<string, unknown>).development;

  if (typeof development !== "object" || development === null) {
    return null;
  }

  const acceptanceUrl = (
    development as Record<string, unknown>
  ).acceptanceUrl;

  return typeof acceptanceUrl === "string" ? acceptanceUrl : null;
}

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, role }),
        },
      );

      const payload: unknown = await response
        .json()
        .catch(() => ({ error: "The server returned an invalid response." }));

      setResult({
        httpStatus: response.status,
        success: response.ok,
        payload,
      });
    } catch {
      setResult({
        httpStatus: 0,
        success: false,
        payload: { error: "Unable to connect to the TeamFlow server." },
      });
    } finally {
      setLoading(false);
    }
  }

  const formattedResult = result
    ? JSON.stringify(
        result.payload,
        (key, value) =>
          /token|secret/i.test(key) ? "[REDACTED]" : value,
        2,
      )
    : "";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-wider text-blue-600">
            TEAMFLOW / DEVELOPMENT
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            Invitation testing
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Create an organization invitation and inspect the API response.
          </p>
        </div>

        <section className="mt-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-6 text-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="organizationId"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Organization ID
              </label>

              <input
                id="organizationId"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-1 text-xs text-gray-500">
                Invitation Acceptance Test
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Recipient email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="colleague@example.com"
                required
                maxLength={254}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Organization role
              </label>

              <select
                id="role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as typeof role)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !organizationId.trim() || !email.trim()}
              className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating invitation..." : "Create invitation"}
            </button>
          </form>
        </section>

        {result && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {getDevelopmentUrl(result.payload) && (
  <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <p className="text-sm font-semibold text-blue-900">
      Development acceptance link
    </p>

    <p className="mt-1 text-sm text-blue-800">
      Email delivery is not required for local testing.
    </p>

    <a
      href={getDevelopmentUrl(result.payload)!}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      Open invitation
    </a>
  </div>
)}
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900">
                API response
              </h2>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  result.success
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                HTTP {result.httpStatus || "Network error"}
              </span>
            </div>

            <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-6 text-gray-100">
              {formattedResult}
            </pre>

            <p className="mt-3 text-xs text-gray-500">
              Sensitive token and secret fields are hidden in this display.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}