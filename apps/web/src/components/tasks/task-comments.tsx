
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { OrganizationRole } from "@/lib/organizations/authorization";

type TaskComment = {
  id: string;
  organizationId: string;
  projectId: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  content: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CommentsApiResponse = {
  message?: string;
  comments?: TaskComment[];
  comment?: TaskComment;
};

type TaskCommentsProps = {
  organizationId: string;
  projectId: string;
  taskId: string;
  currentUserId: string;
  currentUserRole: OrganizationRole;
  isProjectActive: boolean;
};

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TaskComments({
  organizationId,
  projectId,
  taskId,
  currentUserId,
  currentUserRole,
  isProjectActive,
}: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState("");

  const commentsUrl =
    `/api/organizations/${organizationId}/projects/${projectId}` +
    `/tasks/${taskId}/comments`;

  const canComment = currentUserRole !== "viewer";
  const canModerate =
    currentUserRole === "owner" || currentUserRole === "admin";

  const loadComments = useCallback(async () => {
    try {
      const response = await fetch(commentsUrl);
      const data = (await response.json().catch(() => null)) as
        | CommentsApiResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load comments.");
      }

      setComments(data?.comments ?? []);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load comments.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [commentsUrl]);

  function retryLoadComments() {
    setIsLoading(true);
    setLoadError("");
    void loadComments();
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadComments();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadComments]);

  function canManageComment(comment: TaskComment) {
    return (
      canModerate ||
      (comment.authorId !== null && comment.authorId === currentUserId)
    );
  }

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setFormError("Comment cannot be empty.");
      return;
    }

    if (trimmedContent.length > 5000) {
      setFormError("Comment cannot exceed 5000 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(commentsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmedContent }),
      });

      const data = (await response.json().catch(() => null)) as
        | CommentsApiResponse
        | null;

      if (!response.ok || !data?.comment) {
        throw new Error(data?.message || "Unable to create comment.");
      }

      setComments((current) => [...current, data.comment!]);
      setContent("");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create comment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(comment: TaskComment) {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
    setEditError("");
  }

  function cancelEditing() {
    setEditingCommentId(null);
    setEditContent("");
    setEditError("");
  }

  async function handleUpdateComment(
    event: FormEvent<HTMLFormElement>,
    commentId: string,
  ) {
    event.preventDefault();
    setEditError("");

    const trimmedContent = editContent.trim();

    if (!trimmedContent) {
      setEditError("Comment cannot be empty.");
      return;
    }

    if (trimmedContent.length > 5000) {
      setEditError("Comment cannot exceed 5000 characters.");
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await fetch(`${commentsUrl}/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmedContent }),
      });

      const data = (await response.json().catch(() => null)) as
        | CommentsApiResponse
        | null;

      if (!response.ok || !data?.comment) {
        throw new Error(data?.message || "Unable to update comment.");
      }

      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? data.comment! : comment,
        ),
      );

      cancelEditing();
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Unable to update comment.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this comment? This action cannot be undone.",
    );

    if (!confirmed) return;

    setDeleteError("");
    setDeletingCommentId(commentId);

    try {
      const response = await fetch(`${commentsUrl}/${commentId}`, {
        method: "DELETE",
      });

      const data = (await response.json().catch(() => null)) as
        | CommentsApiResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete comment.");
      }

      setComments((current) =>
        current.filter((comment) => comment.id !== commentId),
      );

      if (editingCommentId === commentId) {
        cancelEditing();
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Unable to delete comment.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Comments
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Discuss updates and share information about this task.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {comments.length}
        </span>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Loading comments...
        </p>
      ) : loadError ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
          <p role="alert" className="text-sm text-red-700">
            {loadError}
          </p>
          <button
            type="button"
            onClick={retryLoadComments}
            className="mt-2 text-sm font-semibold text-red-700 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : comments.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No comments yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Start the conversation about this task.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {comments.map((comment) => {
            const isEditing = editingCommentId === comment.id;
            const canManage = canManageComment(comment);

            return (
              <article
                key={comment.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {comment.authorName}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatCommentDate(comment.createdAt)}
                      {comment.editedAt && (
                        <span className="ml-2">(edited)</span>
                      )}
                    </p>
                  </div>

                  {canManage && !isEditing && (
                    <div className="flex items-center gap-3">
                      {isProjectActive && (
                        <button
                          type="button"
                          onClick={() => startEditing(comment)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                      )}

                      {isProjectActive && (
                        <button
                          type="button"
                          disabled={deletingCommentId === comment.id}
                          onClick={() => void handleDeleteComment(comment.id)}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingCommentId === comment.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <form
                    onSubmit={(event) =>
                      void handleUpdateComment(event, comment.id)
                    }
                    className="mt-4 space-y-3"
                  >
                    <textarea
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                      rows={4}
                      maxLength={5000}
                      required
                      className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    {editError && (
                      <p role="alert" className="text-sm text-red-600">
                        {editError}
                      </p>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={cancelEditing}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSavingEdit ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                    {comment.content}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {deleteError && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {deleteError}
        </p>
      )}

      {canComment ? (
        isProjectActive ? (
          <form onSubmit={handleCreateComment} className="mt-6 space-y-3">
            <label
              htmlFor={`comment-${taskId}`}
              className="block text-sm font-semibold text-slate-800"
            >
              Add a comment
            </label>

            <textarea
              id={`comment-${taskId}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Write your comment..."
              className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs text-slate-400">
                {content.length}/5000 characters
              </p>

              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Posting..." : "Post comment"}
              </button>
            </div>

            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}
          </form>
        ) : (
          <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This project is archived. Comments can be viewed but not added or
            modified.
          </p>
        )
      ) : (
        <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          You have view-only access to comments in this workspace.
        </p>
      )}
    </section>
  );
}
