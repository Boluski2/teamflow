import { Suspense, type ReactNode } from "react";

function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-screen items-center justify-center bg-slate-50"
    >
      <p className="text-sm text-slate-500">Loading your workspace...</p>
    </main>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <Suspense fallback={<DashboardLoading />}>{children}</Suspense>;
}
