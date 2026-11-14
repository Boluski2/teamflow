"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { projects as projectsTable } from "@/lib/db/schema";
import Link from "next/link";

type Project = typeof projectsTable.$inferSelect;
type ProjectFilter = "all" | "active" | "archived";

type ProjectsViewProps = {
  projects: Project[];
  workspaceName: string;
  organizationId: string;
  canCreate: boolean;
  workspaceSlug: string;
};

type ApiErrorResponse = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const filters: { label: string; value: ProjectFilter }[] = [
  { label: "All projects", value: "all" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
];

function formatDate(date: Date | null) {
  if (!date) return "Not set";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function toIsoDate(date: string) {
  return date ? new Date(`${date}T00:00:00.000Z`).toISOString() : null;
}

export function ProjectsView({
  projects,
  workspaceName,
  organizationId,
  canCreate,
  workspaceSlug,
}: ProjectsViewProps) {
  const router = useRouter();

  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesFilter =
        filter === "all" || project.status === filter;

      const searchText = search.trim().toLowerCase();

      const matchesSearch =
        !searchText ||
        project.name.toLowerCase().includes(searchText) ||
        (project.description ?? "").toLowerCase().includes(searchText);

      return matchesFilter && matchesSearch;
    });
  }, [projects, filter, search]);

  const activeCount = projects.filter(
    (project) => project.status === "active",
  ).length;

  const archivedCount = projects.filter(
    (project) => project.status === "archived",
  ).length;

  function resetForm() {
    setName("");
    setDescription("");
    setStartDate("");
    setDueDate("");
    setFormError("");
  }

  function closeModal() {
    if (isSubmitting) return;

    setIsModalOpen(false);
    resetForm();
  }

  async function handleCreateProject(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFormError("");

    if (startDate && dueDate && dueDate < startDate) {
      setFormError("The due date cannot be earlier than the start date.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/projects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            startDate: toIsoDate(startDate),
            dueDate: toIsoDate(dueDate),
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | null;

      if (!response.ok) {
        const fieldError = data?.fieldErrors
          ? Object.values(data.fieldErrors).flat()[0]
          : undefined;

        setFormError(
          fieldError ||
            data?.message ||
            "Unable to create project. Please try again.",
        );
        return;
      }

      setIsModalOpen(false);
      resetForm();
      router.refresh();
    } catch {
      setFormError(
        "A network error occurred. Please check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-600">
            WORKSPACE / PROJECTS
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Projects
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage and track projects in {workspaceName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
            <p className="text-xs text-slate-500">Total projects</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {projects.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
            <p className="text-xs text-slate-500">Active</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">
              {activeCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
            <p className="text-xs text-slate-500">Archived</p>
            <p className="mt-1 text-xl font-bold text-slate-600">
              {archivedCount}
            </p>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              + Create Project
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              All projects
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Browse and manage your workspace projects.
            </p>
          </div>

          <div className="w-full sm:max-w-xs">
            <label htmlFor="project-search" className="sr-only">
              Search projects
            </label>
            <input
              id="project-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-5 pt-4">
          {filters.map((item) => {
            const selected = filter === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                aria-pressed={selected}
                className={`shrink-0 border-b-2 px-3 pb-3 text-sm font-medium transition ${
                  selected
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {item.value === "all"
                    ? projects.length
                    : item.value === "active"
                      ? activeCount
                      : archivedCount}
                </span>
              </button>
            );
          })}
        </div>

        {filteredProjects.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
              PR
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              {projects.length === 0
                ? "No projects yet"
                : "No matching projects"}
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              {projects.length === 0
                ? "Your workspace does not have any projects yet. Projects you create will appear here."
                : "Try changing your search or selecting a different project filter."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/${workspaceSlug}/projects/${project.id}`}
                className="block rounded-xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                    PR
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      project.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                <h3 className="mt-5 truncate font-semibold text-slate-900">
                  {project.name}
                </h3>

                <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                  {project.description || "No project description provided."}
                </p>

                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Start date</span>
                    <span className="font-medium text-slate-700">
                      {formatDate(project.startDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Due date</span>
                    <span className="font-medium text-slate-700">
                      {formatDate(project.dueDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Last updated</span>
                    <span className="font-medium text-slate-700">
                      {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            aria-describedby="create-project-description"
            className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <h2
                  id="create-project-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Create a project
                </h2>
                <p
                  id="create-project-description"
                  className="mt-1 text-sm text-slate-500"
                >
                  Add a new project to {workspaceName}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="project-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Project name <span className="text-red-500">*</span>
                </label>
                <input
                  id="project-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Website redesign"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-xs text-slate-400">
                  2–120 characters
                </p>
              </div>

              <div>
                <label
                  htmlFor="project-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="project-description"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What is this project about?"
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {description.length}/2000
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="project-start-date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Start date
                  </label>
                  <input
                    id="project-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    max={dueDate || undefined}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="project-due-date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Due date
                  </label>
                  <input
                    id="project-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    min={startDate || undefined}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
