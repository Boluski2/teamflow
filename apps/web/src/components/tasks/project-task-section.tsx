
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { tasks as tasksTable } from "@/lib/db/schema";
import Image from "next/image";
import type { OrganizationRole } from "@/lib/organizations/authorization";
import { TaskDetailsDialog } from "@/components/tasks/task-details-dialog";

type TaskRecord = Omit<
  typeof tasksTable.$inferSelect,
  "dueDate" | "createdAt" | "updatedAt" | "completedAt"
> & {
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type OrganizationMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
};

type TaskStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

type TaskPriority = "low" | "normal" | "high" | "urgent";

type ApiResponse = {
  message?: string;
  errors?: Record<string, string[]>;
  tasks?: TaskRecord[];
  task?: TaskRecord;
  members?: OrganizationMember[];
};

type TaskTreeNode = {
  task: TaskRecord;
  children: TaskTreeNode[];
};

type FlattenedTask = {
  task: TaskRecord;
  depth: number;
  subtaskCount: number;
  completedSubtaskCount: number;
};

type ProjectTaskSectionProps = {
  organizationId: string;
  projectId: string;
  currentUserId: string;
  currentUserRole: OrganizationRole;
  canCreate: boolean;
  canUpdate: boolean;
  isProjectActive: boolean;
  canDelete: boolean;
};

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  cancelled: "Cancelled",
};

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

function formatTaskDate(date: string | null) {
  if (!date) return "No due date";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function buildTaskTree(tasks: TaskRecord[]): TaskTreeNode[] {
  const nodes = new Map<string, TaskTreeNode>();

  for (const task of tasks) {
    nodes.set(task.id, {
      task,
      children: [],
    });
  }

  const roots: TaskTreeNode[] = [];

  for (const node of nodes.values()) {
    const parentId = node.task.parentTaskId;
    const parent = parentId ? nodes.get(parentId) : undefined;

    if (parent && parent.task.id !== node.task.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}


function flattenTaskTree(
  nodes: TaskTreeNode[],
  depth = 0,
): FlattenedTask[] {
  return nodes.flatMap((node) => [
    {
      task: node.task,
      depth,
      subtaskCount: node.children.length,
      completedSubtaskCount: node.children.filter(
        (child) => child.task.status === "done",
      ).length,
    },
    ...flattenTaskTree(node.children, depth + 1),
  ]);
}

export function ProjectTaskSection({
  organizationId,
  projectId,
  currentUserId,
  currentUserRole,
  canCreate,
  canDelete,
  isProjectActive,
  canUpdate,
}: ProjectTaskSectionProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(
  new Set(),
);
const [statusError, setStatusError] = useState("");
const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
const [isSavingEdit, setIsSavingEdit] = useState(false);
const [editError, setEditError] = useState("");

const [editTitle, setEditTitle] = useState("");
const [editDescription, setEditDescription] = useState("");
const [editPriority, setEditPriority] = useState<TaskPriority>("normal");
const [editDueDate, setEditDueDate] = useState("");

const [members, setMembers] = useState<OrganizationMember[]>([]);
const [isLoadingMembers, setIsLoadingMembers] = useState(true);
const [membersError, setMembersError] = useState("");

const [assigneeId, setAssigneeId] = useState("");
const [editAssigneeId, setEditAssigneeId] = useState("");
const [deletingTaskIds, setDeletingTaskIds] = useState<Set<string>>(
  new Set(),
);
const [deleteError, setDeleteError] = useState("");
const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);

  const flattenedTasks = useMemo(
    () => flattenTaskTree(buildTaskTree(tasks)),
    [tasks],
  );

  const tasksUrl =
    `/api/organizations/${organizationId}/projects/${projectId}/tasks`;

    const membersUrl = `/api/organizations/${organizationId}/members`;

    async function handleDeleteTask(task: TaskRecord) {
  const confirmed = window.confirm(
    `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
  );

  if (!confirmed) return;

  setDeleteError("");

  setDeletingTaskIds((current) => {
    const next = new Set(current);
    next.add(task.id);
    return next;
  });

  try {
    const response = await fetch(`${tasksUrl}/${task.id}`, {
      method: "DELETE",
    });

    const data = (await response.json().catch(() => null)) as
      | ApiResponse
      | null;

    if (!response.ok) {
      throw new Error(data?.message || "Unable to delete this task.");
    }

    setTasks((current) =>
      current.filter((item) => item.id !== task.id),
    );
  } catch (error) {
    setDeleteError(
      error instanceof Error
        ? error.message
        : "Unable to delete this task.",
    );
  } finally {
    setDeletingTaskIds((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
  }
}

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch(tasksUrl);
      const data = (await response.json().catch(() => null)) as
        | ApiResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load project tasks.");
      }

      setTasks(data?.tasks ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load project tasks.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [tasksUrl]);

  const loadMembers = useCallback(async () => {
  setIsLoadingMembers(true);
  setMembersError("");

  try {
    const response = await fetch(membersUrl);

    const data = (await response.json().catch(() => null)) as
      | ApiResponse
      | null;

    if (!response.ok) {
      throw new Error(
        data?.message || "Unable to load organization members.",
      );
    }

    setMembers(data?.members ?? []);
  } catch (error) {
    setMembersError(
      error instanceof Error
        ? error.message
        : "Unable to load organization members.",
    );
  } finally {
    setIsLoadingMembers(false);
  }
}, [membersUrl]);

useEffect(() => {
  void Promise.resolve().then(loadMembers);
}, [loadMembers]);

  useEffect(() => {
    void Promise.resolve().then(loadTasks);
  }, [loadTasks]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (title.trim().length < 2) {
      setFormError("Task title must be at least 2 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(tasksUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigneeId: assigneeId || null,
        parentTaskId,
        dueDate: dueDate
            ? new Date(`${dueDate}T00:00:00.000Z`).toISOString()
            : null,
        }),
      });

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
            "Unable to create this task.",
        );
        return;
      }

      if (data?.task) {
        setTasks((current) => [...current, data.task!]);
      }

      setTitle("");
      setDescription("");
      setPriority("normal");
      setAssigneeId("");
      setDueDate("");
      setParentTaskId(null);
      setIsFormOpen(false);
    } catch {
      setFormError(
        "A network error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(
  taskId: string,
  status: TaskStatus,
) {
  setStatusError("");

  setUpdatingTaskIds((current) => {
    const next = new Set(current);
    next.add(taskId);
    return next;
  });

  try {
    const response = await fetch(`${tasksUrl}/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    const data = (await response.json().catch(() => null)) as
      | ApiResponse
      | null;

    if (!response.ok || !data?.task) {
      throw new Error(
        data?.message || "Unable to update task status.",
      );
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? data.task! : task,
      ),
    );
  } catch (error) {
    setStatusError(
      error instanceof Error
        ? error.message
        : "Unable to update task status.",
    );
  } finally {
    setUpdatingTaskIds((current) => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }
}

function startEditingTask(task: TaskRecord) {
  setEditingTaskId(task.id);
  setEditError("");
  setEditTitle(task.title);
  setEditDescription(task.description ?? "");
  setEditPriority(task.priority as TaskPriority);
  setEditDueDate(
    task.dueDate
      ? new Date(task.dueDate).toISOString().slice(0, 10)
      : "",
  );
  setEditAssigneeId(task.assigneeId ?? "");
}

function cancelEditingTask() {
  setEditingTaskId(null);
  setEditError("");
}

async function handleEditTask(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!editingTaskId) return;

  setEditError("");

  if (editTitle.trim().length < 2) {
    setEditError("Task title must be at least 2 characters.");
    return;
  }

  setIsSavingEdit(true);

  try {
    const response = await fetch(`${tasksUrl}/${editingTaskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        assigneeId: editAssigneeId || null,
        dueDate: editDueDate
          ? new Date(`${editDueDate}T00:00:00.000Z`).toISOString()
          : null,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | ApiResponse
      | null;

    if (!response.ok || !data?.task) {
      const validationError = data?.errors
        ? Object.values(data.errors).flat()[0]
        : undefined;

      throw new Error(
        validationError || data?.message || "Unable to update task.",
      );
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === editingTaskId ? data.task! : task,
      ),
    );

    setEditingTaskId(null);
  } catch (error) {
    setEditError(
      error instanceof Error
        ? error.message
        : "Unable to update task.",
    );
  } finally {
    setIsSavingEdit(false);
  }
}

  const completedCount = tasks.filter(
    (task) => task.status === "done",
  ).length;

  const openCount = tasks.filter(
    (task) =>
      task.status !== "done" && task.status !== "cancelled",
  ).length;

  return (
    <>
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Tasks
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the work associated with this project.
          </p>
        </div>

        {canCreate && isProjectActive && (
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setParentTaskId(null);
              setIsFormOpen((open) => !open);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {isFormOpen ? "Close form" : "+ Add task"}
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">
            Total tasks
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {tasks.length}
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-700">
            Open
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-900">
            {openCount}
          </p>
        </div>

        <div className="col-span-2 rounded-xl bg-emerald-50 p-4 sm:col-span-1">
          <p className="text-xs font-medium text-emerald-700">
            Completed
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {completedCount}
          </p>
        </div>
      </div>

      {!isProjectActive && (
        <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This project is archived. Its tasks are available for viewing,
          but new tasks cannot be created.
        </p>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleCreateTask}
          className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
        >
          <h3 className="font-semibold text-slate-900">
            {parentTaskId ? "Create a subtask" : "Create a new task"}
          </h3>
          <p className="text-sm text-slate-600">
            This task will be added to the current project. Add a title and
            details, then set its priority, due date, and assignee.
          </p>

          <div>
            <label
              htmlFor="task-title"
              className="mb-2 block text-sm font-semibold text-slate-800"
            >
              Task title *
            </label>
            <input
              id="task-title"
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Complete project documentation"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="task-description"
              className="mb-2 block text-sm font-semibold text-slate-800"
            >
              Description
            </label>
            <textarea
              id="task-description"
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what needs to be done..."
              className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

            <div className="grid gap-4 sm:grid-cols-2">
            <div>
                <label
                htmlFor="task-priority"
                className="mb-2 block text-sm font-semibold text-slate-800"
                >
                Priority
                </label>
                <select
                id="task-priority"
                value={priority}
                onChange={(event) =>
                    setPriority(event.target.value as TaskPriority)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                </select>
            </div>

            <div>
                <label
                htmlFor="task-due-date"
                className="mb-2 block text-sm font-semibold text-slate-800"
                >
                Due date
                </label>
                <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
            </div>

            {canUpdate && (
                <div className="sm:col-span-2">
                <label
                    htmlFor="task-assignee"
                    className="mb-2 block text-sm font-semibold text-slate-800"
                >
                    Assign to
                </label>

                <select
                    id="task-assignee"
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    disabled={isLoadingMembers || members.length === 0}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <option value="">Unassigned</option>

                    {members.map((member) => (
                    <option key={member.id} value={member.id}>
                        {member.name} ({member.role})
                    </option>
                    ))}
                </select>

                {membersError && (
                    <p role="alert" className="mt-2 text-xs text-red-600">
                    {membersError}
                    </p>
                )}

                {!isLoadingMembers && !membersError && members.length === 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                    No active organization members found.
                    </p>
                )}
                </div>
            )}
            </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsFormOpen(false);
                setFormError("");
                setParentTaskId(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : parentTaskId ? "Create subtask" : "Create task"}
            </button>
          </div>
        </form>
      )}

      {statusError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
            {statusError}
        </p>
        )}
        {deleteError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {deleteError}
        </p>
      )}
      <div className="mt-6">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Loading tasks...
          </p>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void loadTasks()}
              className="mt-3 text-sm font-semibold text-red-700 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center">
            <h3 className="font-semibold text-slate-800">
              No tasks yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Tasks created for this project will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
{flattenedTasks.map(
  ({
    task,
    depth,
    subtaskCount,
    completedSubtaskCount,
  }) => (
<article
  key={task.id}
  className={`py-4 ${
    depth > 0
      ? "ml-5 border-l-2 border-blue-100 pl-4 sm:ml-8"
      : ""
  }`}
>
    {editingTaskId === task.id ? (
      <form
        onSubmit={handleEditTask}
        className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4"
      >
        <div>
          <label
            htmlFor={`edit-title-${task.id}`}
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Task title
          </label>
          <input
            id={`edit-title-${task.id}`}
            type="text"
            required
            minLength={2}
            maxLength={200}
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor={`edit-description-${task.id}`}
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id={`edit-description-${task.id}`}
            rows={3}
            maxLength={5000}
            value={editDescription}
            onChange={(event) =>
              setEditDescription(event.target.value)
            }
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`edit-priority-${task.id}`}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Priority
            </label>
            <select
              id={`edit-priority-${task.id}`}
              value={editPriority}
              onChange={(event) =>
                setEditPriority(event.target.value as TaskPriority)
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label
              htmlFor={`edit-due-date-${task.id}`}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Due date
            </label>
            <input
              id={`edit-due-date-${task.id}`}
              type="date"
              value={editDueDate}
              onChange={(event) =>
                setEditDueDate(event.target.value)
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

                {canUpdate && (
        <div>
            <label
            htmlFor={`edit-assignee-${task.id}`}
            className="mb-2 block text-sm font-medium text-slate-700"
            >
            Assign to
            </label>

            <select
            id={`edit-assignee-${task.id}`}
            value={editAssigneeId}
            onChange={(event) => setEditAssigneeId(event.target.value)}
            disabled={isLoadingMembers || members.length === 0}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
            <option value="">Unassigned</option>

            {members.map((member) => (
                <option key={member.id} value={member.id}>
                {member.name} ({member.role})
                </option>
            ))}
            </select>

            {membersError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
                {membersError}
            </p>
            )}
        </div>
        )}

        {editError && (
          <p role="alert" className="text-sm text-red-600">
            {editError}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={isSavingEdit}
            onClick={cancelEditingTask}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSavingEdit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingEdit ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    ) : (
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
        <button
          type="button"
          onClick={() => setSelectedTask(task)}
          className="break-words text-left font-medium text-slate-900 transition hover:text-blue-600 hover:underline"
        >
          {task.title}
        </button>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
              {task.description}
            </p>
          )}
          
          {subtaskCount > 0 && (
            <div className="mt-3 max-w-xs">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">
                  Subtasks
                </span>
                <span className="text-slate-500">
                  {completedSubtaskCount}/{subtaskCount} completed
                </span>
              </div>

              <div
                className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={`Subtask completion for ${task.title}`}
                aria-valuemin={0}
                aria-valuemax={subtaskCount}
                aria-valuenow={completedSubtaskCount}
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${(completedSubtaskCount / subtaskCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Due: {formatTaskDate(task.dueDate)}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
            {task.assigneeId ? (
                (() => {
                const assignee = members.find(
                    (member) => member.id === task.assigneeId,
                );

                if (!assignee) {
                    return (
                    <span className="text-xs text-slate-500">
                        Assigned member unavailable
                    </span>
                    );
                }

                return (
                    <>
                    {assignee.avatarUrl ? (
                    <Image
                    src={assignee.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                    className="h-7 w-7 rounded-full object-cover"
                    />
                    ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {assignee.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                    )}

                    <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700">
                        {assignee.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                        {assignee.role}
                        </p>
                    </div>
                    </>
                );
                })()
            ) : (
                <span className="text-xs text-slate-400">
                Unassigned
                </span>
            )}
            </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Status for ${task.title}`}
            value={task.status}
            disabled={
              !canUpdate ||
              !isProjectActive ||
              updatingTaskIds.has(task.id)
            }
            onChange={(event) =>
              void handleStatusChange(
                task.id,
                event.target.value as TaskStatus,
              )
            }
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              priorityStyles[task.priority as TaskPriority]
            }`}
          >
            {task.priority}
          </span>

          {canUpdate && isProjectActive && (
            <button
              type="button"
              disabled={
                isSavingEdit ||
                updatingTaskIds.has(task.id)
              }
              onClick={() => startEditingTask(task)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Edit
            </button>
          )}
          {canDelete && isProjectActive && (
          <button
            type="button"
            disabled={
              deletingTaskIds.has(task.id) ||
              subtaskCount > 0
            }
            onClick={() => void handleDeleteTask(task)}
            title={
              subtaskCount > 0
                ? "Delete this task's subtasks first"
                : "Delete task"
            }
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deletingTaskIds.has(task.id) ? "Deleting..." : "Delete"}
          </button>
        )}
        </div>
        {canCreate && isProjectActive && (
          <button
            type="button"
            onClick={() => {
              setParentTaskId(task.id);
              setFormError("");
              setIsFormOpen(true);
            }}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
          >
                      + Add subtask
                    </button>
                  )}
                </div>
              )}
            </article>
            ),
          )}
          </div>
        )}
      </div>
    </section>
     {selectedTask && (
      <TaskDetailsDialog
        organizationId={organizationId}
        projectId={projectId}
        task={selectedTask}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        isProjectActive={isProjectActive}
        onClose={() => setSelectedTask(null)}
      />
    )}
    </>
  );
}
