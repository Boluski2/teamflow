
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";

const stages = [
  {
    number: "01",
    title: "Create your workspace",
    description:
      "Start with a dedicated workspace for your organisation. It gives your projects, tasks and team members a shared place to work.",
    detail: "Establish your team's central workspace.",
  },
  {
    number: "02",
    title: "Bring your team together",
    description:
      "Invite the people you work with and manage their access through workspace membership and roles.",
    detail: "Give each person an appropriate level of access.",
  },
  {
    number: "03",
    title: "Organise projects and tasks",
    description:
      "Create projects, break work into tasks, assign responsibilities and make priorities easier to understand.",
    detail: "Turn ideas and objectives into organised work.",
  },
  {
    number: "04",
    title: "Keep work moving",
    description:
      "Follow task progress, review project activity and maintain visibility into the work your team is doing.",
    detail: "Stay aligned as responsibilities are completed.",
  },
];

const principles = [
  {
    title: "Clarity",
    description:
      "Keep projects, tasks and responsibilities organised in a shared workspace.",
  },
  {
    title: "Ownership",
    description:
      "Make it easier to understand who is responsible for each piece of work.",
  },
  {
    title: "Visibility",
    description:
      "Give your team a clearer picture of ongoing work and progress.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="px-5 pb-16 pt-20 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                How TeamFlow works
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-6xl">
                From scattered tasks to organised teamwork.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                TeamFlow gives your organisation a straightforward way to
                bring people, projects and everyday responsibilities together.
              </p>
              <Link
                href="/sign-up"
                className="mt-9 inline-flex items-center justify-center rounded-md bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
              >
                Create your workspace
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                The process
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Four steps to a more organised team.
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 border-t border-slate-200">
            {stages.map((stage, index) => (
              <Reveal key={stage.number} delay={index * 70}>
                <article className="grid gap-5 border-b border-slate-200 py-9 sm:grid-cols-[100px_1fr] sm:gap-8">
                  <span className="text-sm font-semibold tracking-widest text-blue-700">
                    {stage.number}
                  </span>

                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                      {stage.title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                      {stage.description}
                    </p>
                    <p className="mt-4 text-xs font-semibold text-slate-500">
                      {stage.detail}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                The TeamFlow approach
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Built around the way teams work.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-600">
                A useful workspace should make everyday work easier to
                understand, organise and manage.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-8 border-t border-slate-200 pt-8 md:grid-cols-3">
            {principles.map((principle, index) => (
              <Reveal key={principle.title} delay={index * 90}>
                <article>
                  <span className="text-xs font-semibold uppercase tracking-widest text-blue-700">
                    0{index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">
                    {principle.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">
                    {principle.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8">
        <Reveal className="mx-auto max-w-7xl">
          <div className="border border-slate-200 bg-slate-50 px-7 py-14 sm:px-14">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Ready to bring your team&apos;s work together?
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-600">
                Start with a workspace and give your team a clearer way to
                organise its projects and responsibilities.
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
