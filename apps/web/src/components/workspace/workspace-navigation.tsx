"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceNavigationProps = {
  slug: string;
  variant: "sidebar" | "mobile";
};

export function WorkspaceNavigation({
  slug,
  variant,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();

  const overviewHref = `/dashboard/${slug}`;
  const projectsHref = `/dashboard/${slug}/projects`;

  const links = [
    {
      label: "Overview",
      href: overviewHref,
      active: pathname === overviewHref,
    },
    {
      label: "Projects",
      href: projectsHref,
      active:
        pathname === projectsHref ||
        pathname.startsWith(`${projectsHref}/`),
    },
  ];

  if (variant === "mobile") {
    return (
      <nav
        aria-label="Workspace navigation"
        className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 lg:hidden"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
              link.active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex-1 space-y-1 p-4">
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Workspace
      </p>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            link.active
              ? "bg-blue-50 text-blue-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-current/10 text-xs font-semibold">
            {link.label === "Overview" ? "O" : "P"}
          </span>
          {link.label}
        </Link>
      ))}

      <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs">
          T
        </span>
        Tasks
        <span className="ml-auto text-xs">Soon</span>
      </div>

      <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-xs">
          M
        </span>
        Members
        <span className="ml-auto text-xs">Soon</span>
      </div>
    </nav>
  );
}
