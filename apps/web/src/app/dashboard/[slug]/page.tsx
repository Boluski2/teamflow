import Link from "next/link";
import { notFound } from "next/navigation";

import { ensureUser } from "@/lib/auth/ensure-user";
import { getOrganizationDashboardData } from "@/lib/dashboard/get-organization-dashboard";

type DashboardPageProps = {
  params: Promise<{ slug: string }>;
};

const taskStatusLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Completed",
  cancelled: "Cancelled",
};

export default async function OrganizationDashboardPage({
  params,
}: DashboardPageProps) {
  const { slug } = await params;

  const user = await ensureUser();
  const dashboard = await getOrganizationDashboardData(slug, user.id);

  if (!dashboard) {
    notFound();
  }

  const {
    organization,
    statistics,
    taskStatusCounts,
    recentProjects,
    recentMembers,
  } = dashboard;

  const totalTasks = statistics.totalTasks;

  const metricCards = [
    {
      label: "Total projects",
      value: statistics.totalProjects,
      description: "Across this workspace",
      code: "PR",
    },
    {
      label: "Active projects",
      value: statistics.activeProjects,
      description: "Currently in progress",
      code: "AC",
    },
    {
      label: "Total tasks",
      value: statistics.totalTasks,
      description: "Across all projects",
      code: "TK",
    },
    {
      label: "Team members",
      value: statistics.totalMembers,
      description: "Workspace membership",
      code: "TM",
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-blue-600">
              WORKSPACE OVERVIEW
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user.name.split(" ")[0]}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Here&apos;s what&apos;s happening in {organization.name}.
            </p>
          </div>

          <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold capitalize text-blue-700">
            {organization.role}
          </span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">
                {item.label}
              </p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-700">
                {item.code}
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {item.value}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-slate-900">
                Recent projects
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                The latest projects in your workspace.
              </p>
            </div>

            <Link
              href={`/dashboard/${slug}/projects`}
              className="text-sm font-medium text-blue-600 transition hover:text-blue-700"
            >
              View all projects
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-medium text-slate-700">
                No projects yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Projects will appear here when your team creates them.
              </p>
              <Link
                href={`/dashboard/${slug}/projects`}
                className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Explore projects
              </Link>
            </div>
          ) : (
            <div className="mt-6 divide-y divide-slate-100">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/${slug}/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg py-4 transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {project.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {project.description || "No description"}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      project.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {project.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            Task overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tasks grouped by status.
          </p>

          {totalTasks === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No tasks yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Task statistics will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {taskStatusCounts.map((item) => {
                const percentage = Math.round(
                  (item.total / totalTasks) * 100,
                );

                return (
                  <div key={item.status}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {taskStatusLabels[item.status] ?? item.status}
                      </span>
                      <span className="font-medium text-slate-900">
                        {item.total}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold text-slate-900">
            Recent members
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            People who belong to this workspace.
          </p>
        </div>

        {recentMembers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No workspace members found.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
              >
                {member.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {member.email}
                  </p>
                  <p className="mt-1 text-xs capitalize text-blue-600">
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="pb-4 text-center text-xs text-slate-400">
        TeamFlow - Workspace overview
      </footer>
    </div>
  );
}
