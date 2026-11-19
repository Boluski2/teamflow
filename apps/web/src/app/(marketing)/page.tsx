
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";

const features = [
  {
    number: "01",
    mark: "P",
    title: "Project management",
    description:
      "Organise your team's work into projects. Keep priorities clear and progress visible from start to finish.",
  },
  {
    number: "02",
    mark: "T",
    title: "Task management",
    description:
      "Create tasks, assign responsibilities, set priorities and track progress without losing context.",
  },
  {
    number: "03",
    mark: "C",
    title: "Team collaboration",
    description:
      "Bring your team into one shared workspace with comments, activity updates and clear ownership.",
  },
  {
    number: "04",
    mark: "W",
    title: "Workspace control",
    description:
      "Manage members, roles and permissions while keeping your organisation's work structured.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your workspace",
    description:
      "Set up a workspace for your organisation and invite the people you work with.",
  },
  {
    number: "02",
    title: "Organise your projects",
    description:
      "Create projects, break work into tasks and assign responsibilities to your team.",
  },
  {
    number: "03",
    title: "Move work forward",
    description:
      "Track progress, share updates and keep everyone aligned as work gets done.",
  },
];

const tasks = [
  { name: "Website redesign", status: "In progress", style: "bg-blue-50 text-blue-700" },
  { name: "Prepare product brief", status: "In review", style: "bg-amber-50 text-amber-700" },
  { name: "Update client dashboard", status: "Completed", style: "bg-emerald-50 text-emerald-700" },
  { name: "Team planning session", status: "To do", style: "bg-slate-100 text-slate-600" },
];

const projects = [
  { name: "Website redesign", progress: "75%", width: "75%" },
  { name: "Mobile application", progress: "48%", width: "48%" },
  { name: "Marketing launch", progress: "90%", width: "90%" },
];

const stats = [
  { label: "Total projects", value: "12" },
  { label: "Open tasks", value: "48" },
  { label: "Completed", value: "86" },
  { label: "Team members", value: "08" },
];

const navigation = [
  { label: "Overview", mark: "O", active: true },
  { label: "Projects", mark: "P", active: false },
  { label: "Tasks", mark: "T", active: false },
  { label: "Members", mark: "M", active: false },
  { label: "Settings", mark: "S", active: false },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Hero */}
      <section className="px-5 pb-20 pt-20 sm:pt-24 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            A better way to work together
          </p>

          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-6xl">
            Bring your projects, people and work together.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            TeamFlow gives your team one organised place to manage projects,
            coordinate tasks and keep work moving forward.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex w-full items-center justify-center rounded-md bg-blue-700 px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-800 sm:w-auto"
            >
              Create your workspace
            </Link>
            <Link
              href="/features"
              className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 sm:w-auto"
            >
              Explore features
            </Link>
          </div>
        </div>

        {/* Product preview */}
        <Reveal className="mx-auto mt-16 max-w-6xl">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-slate-50 px-5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              </div>
              <span className="text-xs text-slate-400">TeamFlow workspace preview</span>
              <span className="w-12" />
            </div>

            <div className="grid min-h-[430px] md:grid-cols-[205px_1fr]">
              <aside className="hidden border-r border-slate-200 bg-slate-50 p-5 md:block">
                <div className="mb-8 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
                    T
                  </span>
                  <span className="text-sm font-bold">TeamFlow</span>
                </div>

                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Workspace
                </p>

                <div className="space-y-1">
                  {navigation.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-medium ${
                        item.active
                          ? "bg-slate-200 text-slate-900"
                          : "text-slate-500"
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-current text-[9px]">
                        {item.mark}
                      </span>
                      {item.label}
                    </div>
                  ))}
                </div>

                <div className="mt-12 border-t border-slate-200 pt-5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    Current workspace
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-xs font-semibold text-slate-700">
                      A
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      Acme Studio
                    </span>
                  </div>
                </div>
              </aside>

              <div className="min-w-0 p-5 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Workspace / Overview</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">
                      Good morning, Alex
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Here&apos;s an overview of your team&apos;s work.
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                    + New project
                  </span>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="border border-slate-200 p-4">
                      <p className="text-[10px] text-slate-500 sm:text-xs">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                  <div className="border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold">Recent tasks</h3>
                      <span className="text-[10px] text-slate-400">Task overview</span>
                    </div>

                    <div className="mt-5 space-y-4">
                      {tasks.map((task) => (
                        <div
                          key={task.name}
                          className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-4 w-4 shrink-0 rounded-sm border border-slate-300" />
                            <span className="truncate text-[11px] font-medium text-slate-700">
                              {task.name}
                            </span>
                          </div>
                          <span className={`shrink-0 rounded-sm px-2 py-1 text-[9px] font-medium ${task.style}`}>
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 p-4">
                    <h3 className="text-xs font-semibold">Project progress</h3>

                    <div className="mt-5 space-y-5">
                      {projects.map((project) => (
                        <div key={project.name}>
                          <div className="flex justify-between gap-2 text-[10px]">
                            <span className="font-medium text-slate-600">
                              {project.name}
                            </span>
                            <span className="text-slate-400">
                              {project.progress}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-slate-100">
                            <div
                              className="h-full rounded-sm bg-blue-700"
                              style={{ width: project.width }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-7 border-t border-slate-100 pt-4">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Team members
                      </p>
                      <div className="mt-3 flex items-center">
                        {["A", "J", "M", "S"].map((initial) => (
                          <span
                            key={initial}
                            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-semibold text-slate-700 first:ml-0"
                          >
                            {initial}
                          </span>
                        ))}
                        <span className="ml-2 text-[10px] text-slate-500">
                          +4 more
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-center text-[10px] text-slate-400">
                  Illustrative workspace preview — sample content.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section className="border-y border-slate-200 bg-slate-50 px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                What you can do
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Everything your team needs to stay organised.
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                Keep projects, responsibilities and communication connected in
                one shared workspace.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-0 border-l border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <Reveal key={feature.number} delay={index * 80}>
                <article className="h-full border-b border-r border-slate-200 bg-white p-6 transition-colors duration-200 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-blue-700">
                      {feature.mark}
                    </span>
                    <span className="text-xs font-medium text-slate-300">
                      {feature.number}
                    </span>
                  </div>
                  <h3 className="mt-7 text-base font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/features"
              className="text-sm font-semibold text-blue-700 transition-colors hover:text-blue-900"
            >
              Explore all features →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                A clearer way to get work done.
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                Start with a workspace, organise your responsibilities and
                give your team the visibility it needs.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-8 border-t border-slate-200 pt-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <Reveal key={step.number} delay={index * 100}>
                <article>
                  <span className="text-xs font-semibold tracking-widest text-blue-700">
                    {step.number}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">
                    {step.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>

          <Link
            href="/how-it-works"
            className="mt-8 inline-block text-sm font-semibold text-blue-700 transition-colors hover:text-blue-900"
          >
            See how TeamFlow works →
          </Link>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="px-5 pb-20 lg:px-8">
        <Reveal className="mx-auto max-w-7xl">
          <div className="border border-slate-200 bg-slate-50 px-7 py-14 sm:px-14 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Work better together
              </p>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Give good work a better place to happen.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                Bring your people and projects together in a workspace designed
                to make everyday collaboration clearer and easier to manage.
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
