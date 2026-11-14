import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { ensureUser } from "@/lib/auth/ensure-user";
import { db } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";

export const metadata = {
  title: "Your workspaces | TeamFlow",
  description: "Select a TeamFlow workspace.",
};

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent("/dashboard")}`,
    );
  }

  const user = await ensureUser();

  const workspaces = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      role: memberships.role,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(
      organizations,
      eq(memberships.organizationId, organizations.id),
    )
    .where(eq(memberships.userId, user.id))
    .orderBy(desc(memberships.joinedAt));

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-slate-900"
          >
            Team<span className="text-blue-600">Flow</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">
                {user.name}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            YOUR WORKSPACE
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {user.name.split(" ")[0]}
          </h1>

          <p className="mt-2 text-slate-600">
            Select a workspace to continue working with your team.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
              +
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              No workspaces yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              You haven&apos;t joined a workspace yet. When someone invites
              you to a TeamFlow organization, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/dashboard/${workspace.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-slate-200/60"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700">
                    {workspace.name.charAt(0).toUpperCase()}
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600">
                    {workspace.role}
                  </span>
                </div>

                <h2 className="mt-5 text-lg font-semibold text-slate-900 group-hover:text-blue-700">
                  {workspace.name}
                </h2>

                <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                  {workspace.description || "No description provided."}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-500">
                    Joined{" "}
                    {workspace.joinedAt.toLocaleDateString("en", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>

                  <span className="text-sm font-medium text-blue-600 group-hover:translate-x-1">
                    Open workspace →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}