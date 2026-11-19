import Link from "next/link";
import { CopyrightYear } from "@/components/marketing/copyright-year";

export function MarketingFooter() {
  return (
    <footer className="marketing-footer border-t border-slate-200 bg-slate-50/70 px-5 py-10 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
            T
          </span>
          <span className="font-bold tracking-tight text-slate-950">
            Team<span className="text-blue-700">Flow</span>
          </span>
        </Link>

        <p className="text-center text-xs text-slate-500">
          © <CopyrightYear /> TeamFlow. Built for better teamwork.
        </p>

        <div className="flex items-center gap-5 text-xs font-medium text-slate-600">
          <Link href="/sign-in" className="transition-colors hover:text-blue-700">
            Sign in
          </Link>
          <Link href="/sign-up" className="transition-colors hover:text-blue-700">
            Create account
          </Link>
        </div>
      </div>
    </footer>
  );
}
