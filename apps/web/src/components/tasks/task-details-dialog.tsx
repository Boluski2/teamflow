
"use client";

import { useEffect } from "react";
import type { OrganizationRole } from "@/lib/organizations/authorization";
import { TaskComments } from "@/components/tasks/task-comments";
import { TaskActivityTimeline } from "./task-activity-timeline";

type TaskDetailsTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskDetailsDialogProps = {
  organizationId: string;
  projectId: string;
  task: TaskDetailsTask;
  currentUserId: string;
  currentUserRole: OrganizationRole;
  isProjectActive: boolean;
  onClose: () => void;
};

export function TaskDetailsDialog({
  organizationId,
  projectId,
  task,
  currentUserId,
  currentUserRole,
  isProjectActive,
  onClose,
}: TaskDetailsDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const formatDate = (value: string | null) => {
    if (!value) return "No due date";

    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
    }).format(new Date(value));
  };

  const statusLabels: Record<string, string> = {
    todo: "To do",
    in_progress: "In progress",
    in_review: "In review",
    done: "Done",
    cancelled: "Cancelled",
  };

  const priorityLabels: Record<string, string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-details-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Task details
            </p>

            <h2
              id="task-details-title"
              className="break-words text-xl font-semibold text-slate-900"
            >
              {task.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="ml-4 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Task information */}
        <div className="overflow-y-auto px-6 py-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p className="mt-2 font-medium text-slate-900">
                {statusLabels[task.status] ?? task.status}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Priority
              </p>
              <p className="mt-2 font-medium text-slate-900">
                {priorityLabels[task.priority] ?? task.priority}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Due date
              </p>
              <p className="mt-2 font-medium text-slate-900">
                {formatDate(task.dueDate)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Last updated
              </p>
              <p className="mt-2 font-medium text-slate-900">
                {formatDate(task.updatedAt)}
              </p>
            </div>
          </div>

          <div className="mt-7 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Description
            </h3>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {task.description || "No description provided."}
            </p>
          </div>

          <TaskComments
                organizationId={organizationId}
                projectId={projectId}
                taskId={task.id}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                isProjectActive={isProjectActive}
                />
                <TaskActivityTimeline
                    organizationId={organizationId}
                    projectId={projectId}
                    taskId={task.id}
                    />
        </div>

        {/* Footer */}
        <footer className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
