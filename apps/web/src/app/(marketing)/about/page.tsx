
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";

const principles = [
  {
    number: "01",
    title: "Clarity over complexity",
    description:
      "A workspace should make it easier to understand what needs to be done, who is responsible and what comes next.",
  },
  {
    number: "02",
    title: "Work with ownership",
    description:
      "Projects move forward when responsibilities are clear and everyone understands their contribution.",
  },
  {
    number: "03",
    title: "Progress through collaboration",
    description:
      "Teams work better when project information and tasks are organised in one shared space.",
  },
];

export default function AboutPage() {
  return (
    <main className="bg-white text-slate-900">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pb-24 sm:pt-28">
        <Reveal>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
            About TeamFlow
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Better organised work starts with a clearer workspace.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            TeamFlow is built around a simple idea: teams should spend less
            time trying to organise their work and more time making progress.
            It brings projects, tasks and team collaboration into one organised
            workspace.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-16 border-y border-slate-200 py-10 sm:py-14">
            <div className="grid gap-10 md:grid-cols-2 md:gap-16">
              <div>
                <p className="text-sm font-semibold text-blue-700">
                  What we are building
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  One place to bring work together.
                </h2>
              </div>

              <p className="text-base leading-8 text-slate-600">
                TeamFlow provides a shared environment where teams can organise
                workspaces, manage projects, assign tasks and keep track of
                progress. The goal is to make everyday teamwork easier to
                understand and manage.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
              Our approach
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Useful tools. Clear responsibilities. Better teamwork.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {principles.map((principle, index) => (
              <Reveal key={principle.number} delay={index * 100}>
                <article className="h-full border-t border-slate-300 pt-6">
                  <span className="text-sm font-medium text-blue-700">
                    {principle.number}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950">
                    {principle.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {principle.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 border border-slate-200 p-8 sm:p-12 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                See what you can build with TeamFlow.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Explore the features and see how a more organised workspace
                can support your team&apos;s day-to-day work.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
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
