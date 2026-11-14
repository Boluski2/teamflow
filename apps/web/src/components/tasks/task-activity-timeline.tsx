
"use client";

import { useCallback, useEffect, useState } from "react";

type ActivityType =
  | "task_created"
  | "task_updated"
  | "task_status_changed"
  | "task_priority_changed"
  | "task_assigned"
  | "task_unassigned"
  | "task_due_date_changed"
  | "subtask_created"
  | "task_deleted"
  | "comment_created"
  | "comment_updated"
  | "comment_deleted";

type ActivityRecord = {
  id: string;
  organizationId: string;
  projectId: string | null;
  taskId: string | null;
  actorId: string | null;
  actorName: string;
  type: ActivityType;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type TaskActivityTimelineProps = {
  organizationId: string;
  projectId: string;
  taskId: string;
};

function getMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function describeActivity(activity: ActivityRecord): string {
  const metadata = activity.metadata ?? {};

  switch (activity.type) {
    case "task_created":
      return "created this task";

    case "subtask_created":
      return "created a subtask";

    case "task_status_changed": {
      const previous = getMetadataString(metadata, "previousStatus");
      const next = getMetadataString(metadata, "newStatus");

      return previous && next
        ? `changed the status from ${previous.replaceAll("_", " ")} to ${next.replaceAll("_", " ")}`
        : "changed the task status";
    }

    case "task_priority_changed": {
      const previous = getMetadataString(metadata, "previousPriority");
      const next = getMetadataString(metadata, "newPriority");

      return previous && next
        ? `changed the priority from ${previous} to ${next}`
        : "changed the task priority";
    }

    case "task_assigned":
      return "assigned this task";

    case "task_unassigned":
      return "removed the task assignment";

    case "task_due_date_changed": {
      const previous = getMetadataString(metadata, "previousDueDate");
      const next = getMetadataString(metadata, "newDueDate");

      if (!previous && next) {
        return `set the due date to ${next}`;
      }

      if (previous && !next) {
        return "removed the due date";
      }

      return previous && next
        ? `changed the due date from ${previous} to ${next}`
        : "updated the due date";
    }

    case "comment_created":
      return "added a comment";

    case "comment_updated":
      return "edited a comment";

    case "comment_deleted":
      return "deleted a comment";

    case "task_deleted":
      return "deleted this task";

    case "task_updated":
      return "updated this task";

    default:
      return "performed an action";
  }
}

function formatActivityDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function TaskActivityTimeline({
  organizationId,
  projectId,
  taskId,
}: TaskActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/projects/${projectId}/tasks/${taskId}/activities`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Unable to load task activity history.",
        );
      }

      setActivities(data.activities ?? []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading activity history.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, projectId, taskId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadActivities();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadActivities]);

  function refreshActivities() {
    setIsLoading(true);
    setError(null);
    void loadActivities();
  }

  return (
    <section className="border-t border-slate-200 pt-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Activity history
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            A record of changes and actions on this task.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshActivities}
          disabled={isLoading}
          className="text-sm font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-slate-500">
          Loading activity history...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>

          <button
            type="button"
            onClick={refreshActivities}
            className="mt-2 text-sm font-medium text-red-700 underline"
          >
            Try again
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No activity yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Changes and actions on this task will appear here.
          </p>
        </div>
      ) : (
        <ol className="relative ml-2 space-y-5 border-l border-slate-200 pl-6">
          {activities.map((activity) => (
            <li key={activity.id} className="relative">
              <span className="absolute -left-[31px] top-1 flex h-3 w-3 rounded-full border-2 border-white bg-blue-500 ring-1 ring-slate-200" />

              <div className="space-y-1">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {activity.actorName || "Unknown user"}
                  </span>{" "}
                  {describeActivity(activity)}
                </p>

                {(() => {
                  const preview = getMetadataString(
                    activity.metadata ?? {},
                    "contentPreview",
                  );

                  const newPreview = getMetadataString(
                    activity.metadata ?? {},
                    "newContentPreview",
                  );

                  return preview || newPreview ? (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {newPreview ?? preview}
                    </p>
                  ) : null;
                })()}

                <p className="text-xs text-slate-400">
                  {formatActivityDate(activity.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
