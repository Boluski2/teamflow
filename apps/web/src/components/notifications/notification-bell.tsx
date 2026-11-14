
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  organizationId: string;
  recipientId: string;
  actorId: string | null;
  projectId: string | null;
  taskId: string | null;
  type:
    | "task_assigned"
    | "task_unassigned"
    | "task_comment_created"
    | "task_status_changed"
    | "task_priority_changed"
    | "task_due_soon";
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type NotificationBellProps = {
  organizationId: string;
  slug: string;
};

export function NotificationBell({
  organizationId,
  slug,
}: NotificationBellProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const baseUrl = `/api/organizations/${organizationId}/notifications`;

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl}/unread-count`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch unread count");
      }

      const data = await response.json();

      setUnreadCount(data.unreadCount);
    } catch {
      // Preserve the previous count if a refresh fails.
    }
  }, [baseUrl]);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}?limit=30`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();

      setNotifications(data.notifications);
    } catch {
      setError("Unable to load notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const initialTimeout = window.setTimeout(() => {
      void fetchUnreadCount();
    }, 0);

    const interval = window.setInterval(() => {
      void fetchUnreadCount();
    }, 60_000);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setNow(Date.now()), 0);
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    const notification = notifications.find(
      (item) => item.id === notificationId,
    );

    if (!notification || notification.readAt || isUpdating) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/${notificationId}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to update notification");
      }

      const data = await response.json();

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? data.notification : item,
        ),
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError("Unable to update notification. Please try again.");
      throw new Error("Notification update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0 || isUpdating) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/read-all`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to mark notifications as read");
      }

      await response.json();

      const now = new Date().toISOString();

      setNotifications((current) =>
        current.map((item) =>
          item.readAt ? item : { ...item, readAt: now },
        ),
      );

      setUnreadCount(0);
    } catch {
      setError("Unable to update notifications. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotificationClick = async (
    notification: Notification,
  ) => {
    try {
      await markAsRead(notification.id);
    } catch {
      return;
    }

    setIsOpen(false);

    if (notification.projectId) {
      router.push(
        `/dashboard/${slug}/projects/${notification.projectId}`,
      );
    } else {
      router.push(`/dashboard/${slug}`);
    }
  };

  const formatDate = (date: string) => {
    const timestamp = new Date(date).getTime();

    if (!Number.isFinite(timestamp)) {
      return "";
    }

    if (now === null) {
      return new Date(date).toLocaleDateString();
    }

    const difference = Math.max(0, now - timestamp);
    const minutes = Math.floor(difference / 60_000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);

    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 21h4"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setIsOpen(false)}
          />

          <section
            aria-label="Notifications"
            className="absolute right-0 top-12 z-40 flex max-h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Notifications
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                    : "You're all caught up"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0 || isUpdating}
                className="text-xs font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Mark all as read
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700"
              >
                {error}
              </div>
            )}

            <div className="overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-12 text-center text-sm text-slate-500">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-6 w-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                      />
                    </svg>
                  </div>

                  <p className="mt-3 text-sm font-medium text-slate-700">
                    No notifications yet
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Updates about your workspace will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() =>
                      void handleNotificationClick(notification)
                    }
                    disabled={isUpdating}
                    className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50 disabled:cursor-wait ${
                      notification.readAt ? "bg-white" : "bg-blue-50/50"
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        notification.readAt
                          ? "bg-transparent"
                          : "bg-blue-600"
                      }`}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">
                        {notification.title}
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-600">
                        {notification.message}
                      </span>

                      <span className="mt-2 block text-[11px] text-slate-400">
                        {formatDate(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  void fetchNotifications();
                  void fetchUnreadCount();
                }}
                className="w-full text-center text-xs font-medium text-slate-500 transition hover:text-slate-900"
              >
                Refresh notifications
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
