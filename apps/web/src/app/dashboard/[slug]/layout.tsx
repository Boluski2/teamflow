
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { ensureUser } from "@/lib/auth/ensure-user";
import { getOrganizationBySlug } from "@/lib/organizations/get-organization-by-slug";
import { WorkspaceNavigation } from "@/components/workspace/workspace-navigation";
// import { NotificationBell } from "@/app/api/organizations/[organizationId]/notifications/notification-bell";
import { NotificationBell } from "@/components/notifications/notification-bell";

type WorkspaceLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { slug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/dashboard/${slug}`)}`,
    );
  }

  const user = await ensureUser();
  const organization = await getOrganizationBySlug(slug, user.id);

  if (!organization) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-slate-900"
          >
            Team<span className="text-blue-600">Flow</span>
          </Link>
        </div>

        <div className="border-b border-slate-100 p-4">
          <Link
            href="/dashboard"
            className="block rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
          >
            <p className="text-xs text-slate-500">WORKSPACE</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">
              {organization.name}
            </p>
            <p className="mt-1 text-xs capitalize text-slate-500">
              {organization.role}
            </p>
          </Link>
        </div>

        <WorkspaceNavigation slug={slug} variant="sidebar" />

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {organization.name}
            </p>
            <p className="text-xs text-slate-500">Workspace</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell
              organizationId={organization.id}
              slug={slug}
            />

            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Switch workspace
            </Link>
          </div>
        </header>

        <WorkspaceNavigation slug={slug} variant="mobile" />

        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
