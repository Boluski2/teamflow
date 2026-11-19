import Link from "next/link";

const links = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
];

export function MarketingHeader() {
  return (
    <header className="marketing-header sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="marketing-logo-mark flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            T
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-950">
            Team<span className="text-blue-700">Flow</span>
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 rounded-full bg-slate-50/80 p-1 md:flex"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="marketing-nav-link rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-white hover:text-blue-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="relative flex shrink-0 items-center gap-3">
          <Link
            href="/sign-in"
            className="hidden px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-blue-700 md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="marketing-cta hidden items-center justify-center rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-lg hover:shadow-blue-900/15 md:inline-flex"
          >
            Get started
          </Link>

          <details className="marketing-mobile-menu group relative md:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="marketing-menu-icon relative h-4 w-5" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Menu
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="marketing-mobile-panel absolute right-0 top-full z-50 mt-3 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-700"
                >
                  {link.label}
                  <span aria-hidden="true" className="text-slate-300">›</span>
                </Link>
              ))}
              <Link
                href="/sign-up"
                className="marketing-cta mt-2 flex items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
              >
                Get started
              </Link>
              <div className="mt-2 border-t border-slate-100 px-4 pt-3 pb-2">
                <Link href="/sign-in" className="text-sm font-medium text-slate-500 hover:text-blue-700">
                  Already have an account? <span className="font-semibold text-slate-800">Sign in</span>
                </Link>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
