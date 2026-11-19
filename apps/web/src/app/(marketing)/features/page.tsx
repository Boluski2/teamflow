
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";

const features = [
  {
    number: "01",
    mark: "P",
    title: "Project management",
    description:
      "Give every initiative a clear home. Organise work into projects and maintain visibility into what your team is working towards.",
    points: [
      "Create and organise projects",
      "Keep project information together",
      "Monitor project progress",
      "Give teams a shared view of priorities",
    ],
  },
  {
    number: "02",
    mark: "T",
    title: "Task management",
    description:
      "Turn project goals into manageable work. Define responsibilities, organise tasks and make progress easier to follow.",
    points: [
      "Create and update tasks",
      "Assign responsibilities",
      "Set task priorities",
      "Track task status",
    ],
  },
  {
    number: "03",
    mark: "C",
    title: "Team collaboration",
    description:
      "Bring people and work into one shared environment. Give team members the context they need to contribute effectively.",
    points: [
      "Work within a shared workspace",
      "Keep task ownership visible",
      "Share comments and updates",
      "Maintain visibility across team activity",
    ],
  },
  {
    number: "04",
    mark: "W",
    title: "Workspace management",
    description:
      "Maintain control over your organisation's workspace with membership management and role-based access.",
    points: [
      "Invite and manage workspace members",
      "Assign workspace roles",
      "Control member permissions",
      "Manage workspace settings",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="px-5 pb-16 pt-20 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                TeamFlow features
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-6xl">
                Everything your team needs to stay organised.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                From project planning to everyday tasks, TeamFlow brings your
                team&apos;s work together in one organised workspace.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center rounded-md bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
                >
                  Create your workspace
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  See how it works
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-0 border-l border-t border-slate-200 sm:grid-cols-2">
            {features.map((feature, index) => (
              <Reveal key={feature.number} delay={index * 80}>
                <article className="h-full border-b border-r border-slate-200 bg-white p-7 sm:p-9">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-blue-700">
                      {feature.mark}
                    </span>
                    <span className="text-xs font-medium tracking-widest text-slate-300">
                      {feature.number}
                    </span>
                  </div>

                  <h2 className="mt-8 text-xl font-semibold tracking-tight text-slate-950">
                    {feature.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {feature.description}
                  </p>

                  <ul className="mt-7 space-y-3">
                    {feature.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 text-sm text-slate-600"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-blue-200 text-[10px] text-blue-700"
                        >
                          ✓
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <Reveal className="mx-auto max-w-7xl">
          <div className="border border-slate-200 bg-white px-7 py-14 sm:px-14">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                One organised workspace
              </p>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Less scattered work. More clarity for everyone.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-600 sm:text-base">
                Give your team a consistent place to plan projects, manage
                responsibilities and keep work moving forward.
              </p>
              <Link
                href="/sign-up"
                className="mt-8 inline-flex items-center justify-center rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Get started with TeamFlow
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
