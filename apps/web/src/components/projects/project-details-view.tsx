"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { projects as projectsTable } from "@/lib/db/schema";
import { ProjectTaskSection } from "@/components/tasks/project-task-section";
import type { OrganizationRole } from "@/lib/organizations/authorization";

type Project = typeof projectsTable.$inferSelect;

type ProjectDetailsViewProps = {
  project: Project;
  workspaceName: string;
  workspaceSlug: string;
  currentUserId: string;
  currentUserRole: OrganizationRole;
  canEdit: boolean;
  canArchive: boolean;
  canCreateTasks: boolean;
  canUpdateTasks: boolean;
  canDeleteTasks: boolean;
};

type ApiResponse = {
  message?: string;
  errors?: Record<string, string[]>;
  project?: Project;
};

type ProjectStatus = "active" | "archived";

function formatDate(date: Date | null) {
  if (!date) return "Not set";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function toInputDate(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function toIsoDate(date: string) {
  return date
    ? new Date(`${date}T00:00:00.000Z`).toISOString()
    : null;
}

export function ProjectDetailsView({
  project,
  workspaceName,
  workspaceSlug,
  currentUserId,
  currentUserRole,
  canEdit,
  canArchive,
  canCreateTasks,
  canUpdateTasks,
  canDeleteTasks,
}: ProjectDetailsViewProps) {
  const router = useRouter();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(
    project.description ?? "",
  );
  const [startDate, setStartDate] = useState(
    toInputDate(project.startDate),
  );
  const [dueDate, setDueDate] = useState(
    toInputDate(project.dueDate),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const isActive = project.status === "active";

  function openEditModal() {
    setName(project.name);
    setDescription(project.description ?? "");
    setStartDate(toInputDate(project.startDate));
    setDueDate(toInputDate(project.dueDate));
    setFormError("");
    setIsEditOpen(true);
  }

  function closeEditModal() {
    if (isSubmitting) return;
    setIsEditOpen(false);
    setFormError("");
  }

  async function handleEditProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (startDate && dueDate && dueDate < startDate) {
      setFormError(
        "The due date cannot be earlier than the start date.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/organizations/${project.organizationId}/projects/${project.id}`,
        {
          method: "PATCH",
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
        | ApiResponse
        | null;

      if (!response.ok) {
        const validationError = data?.errors
          ? Object.values(data.errors).flat()[0]
          : undefined;

        setFormError(
          validationError ||
            data?.message ||
            "Unable to update this project. Please try again.",
        );
        return;
      }

      setIsEditOpen(false);
      router.refresh();
    } catch {
      setFormError(
        "A network error occurred. Please check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(status: ProjectStatus) {
    const action = status === "archived" ? "archive" : "reactivate";

    const confirmed = window.confirm(
      status === "archived"
        ? `Are you sure you want to archive "${project.name}"?`
        : `Are you sure you want to reactivate "${project.name}"?`,
    );

    if (!confirmed) return;

    setFormError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/organizations/${project.organizationId}/projects/${project.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const data = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!response.ok) {
        setFormError(
          data?.message ||
            `Unable to ${action} this project. Please try again.`,
        );
        return;
      }

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
      <div>
        <Link
          href={`/dashboard/${workspaceSlug}/projects`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <span aria-hidden="true">←</span>
          Back to projects
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-600">
              {workspaceName} / PROJECTS
            </p>

            <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-slate-900">
              {project.name}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Project overview and information.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {project.status}
            </span>

            {canEdit && (
              <button
                type="button"
                onClick={openEditModal}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Edit project
              </button>
            )}

            {canArchive && (
              <button
                type="button"
                onClick={() =>
                  handleStatusChange(isActive ? "archived" : "active")
                }
                disabled={isSubmitting}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {isSubmitting
                  ? "Please wait..."
                  : isActive
                    ? "Archive project"
                    : "Reactivate project"}
              </button>
            )}
          </div>
        </div>
      </div>

      {formError && !isEditOpen && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

            {formError && !isEditOpen && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      {/* Project task management */}
      <ProjectTaskSection
        organizationId={project.organizationId}
        projectId={project.id}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        canCreate={canCreateTasks}
        canUpdate={canUpdateTasks}
        canDelete={canDeleteTasks}
        isProjectActive={isActive}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Project description
            </h2>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {project.description ||
                "No description has been added to this project yet."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Project timeline
            </h2>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Start date</p>
                <p className="mt-2 font-semibold text-slate-900">
                  {formatDate(project.startDate)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Due date</p>
                <p className="mt-2 font-semibold text-slate-900">
                  {formatDate(project.dueDate)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              Project information
            </h2>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-sm font-medium capitalize text-slate-800">
                  {project.status}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Created
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDateTime(project.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Last updated
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDateTime(project.updatedAt)}
                </p>
              </div>

              {/* <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Project ID
                </p>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">
                  {project.id}
                </p>
              </div> */}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="font-semibold text-slate-900">
              Workspace
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This project belongs to {workspaceName}.
            </p>
            <Link
              href={`/dashboard/${workspaceSlug}/projects`}
              className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View all projects →
            </Link>
          </section>
        </aside>
      </div>

      {isEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <h2
                  id="edit-project-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Edit project
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update your project information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSubmitting}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditProject} className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="edit-project-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Project name *
                </label>
                <input
                  id="edit-project-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-project-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="edit-project-description"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What is this project about?"
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {description.length}/2000
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-project-start-date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Start date
                  </label>
                  <input
                    id="edit-project-start-date"
                    type="date"
                    value={startDate}
                    max={dueDate || undefined}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-project-due-date"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Due date
                  </label>
                  <input
                    id="edit-project-due-date"
                    type="date"
                    value={dueDate}
                    min={startDate || undefined}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  onClick={closeEditModal}
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
                  {isSubmitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
