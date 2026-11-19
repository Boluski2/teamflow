
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";

export default function PricingPage() {
  return (
    <main className="bg-white text-slate-900">
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pb-32 sm:pt-28">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
              Pricing
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Straightforward information, without the guesswork.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              We&apos;re working towards a clear pricing structure for TeamFlow.
              Our pricing details are not published yet, so we won&apos;t ask you
              to choose between plans that aren&apos;t available.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="mx-auto mt-16 max-w-2xl border border-slate-200 px-7 py-10 sm:px-12 sm:py-14">
            <p className="text-sm font-semibold text-blue-700">
              Pricing information
            </p>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Details coming soon.
            </h2>

            <p className="mt-5 leading-8 text-slate-600">
              TeamFlow&apos;s plans and pricing have not been finalised for
              publication. We&apos;ll share the relevant details when they&apos;re
              available.
            </p>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm font-medium text-slate-800">
                In the meantime, you can:
              </p>

              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li className="flex gap-3">
                  <span className="text-blue-700">✓</span>
                  Explore the features currently available in TeamFlow.
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-700">✓</span>
                  Learn how workspaces, projects and tasks fit together.
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-700">✓</span>
                  Create an account and explore the application.
                </li>
              </ul>
            </div>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/features"
                className="inline-flex items-center justify-center border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Explore features
              </Link>

              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center bg-blue-700 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-800"
              >
                Get started
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
