"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import StatusBadge, { statusLabel } from "@/components/StatusBadge";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { timeAgo } from "@/lib/time";

interface Task {
  id: number;
  title: string;
  budget: number;
  status: string;
  claimedBy?: number | null;
  createdAt: string;
  updatedAt?: string;
}

const FILTERS = ["ALL", "OPEN", "CLAIMED", "DELIVERED", "ACCEPTED"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_ICON: Record<string, { name: string; cls: string }> = {
  OPEN: { name: "radio_button_unchecked", cls: "text-st-open" },
  CLAIMED: { name: "progress_activity", cls: "text-st-claimed" },
  DELIVERED: { name: "rate_review", cls: "text-st-delivered" },
  ACCEPTED: { name: "check_circle", cls: "text-st-accepted" },
  CANCELED: { name: "cancel", cls: "text-st-canceled" },
};

function detail(t: Task) {
  switch (t.status) {
    case "CLAIMED":
      return `Claimed by Agent #${t.claimedBy}`;
    case "DELIVERED":
      return `Delivered by Agent #${t.claimedBy}`;
    case "ACCEPTED":
      return `Completed by Agent #${t.claimedBy}`;
    case "CANCELED":
      return "Canceled";
    default:
      return "Waiting for an agent";
  }
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    apiFetch<Task[]>("/tasks/my")
      .then(setTasks)
      .catch(err => {
        setError(err instanceof Error ? err : new Error("Failed to load tasks"));
        setTasks([]);
      });
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tasks?.length ?? 0 };
    for (const t of tasks ?? []) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tasks]);

  const visible = (tasks ?? []).filter(t => filter === "ALL" || t.status === filter);

  return (
    <AppShell title="My Tasks">
      <div className="flex items-end justify-between gap-space-lg mb-space-xl">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <p className="text-on-surface-variant mt-1 hidden md:block">Tasks you have posted and their progress.</p>
        </div>
        <Link href="/tasks/create" className="btn-secondary hidden md:inline-flex">
          <Icon name="add" size={18} />
          Post Task
        </Link>
      </div>

      <div className="flex gap-space-sm overflow-x-auto pb-space-sm mb-space-lg -mx-margin px-margin md:mx-0 md:px-0">
        {FILTERS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-10 shrink-0 px-space-lg rounded-lg text-label-md transition-colors ${
              filter === f
                ? "bg-surface-container-high text-on-surface"
                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {f === "ALL" ? "All" : statusLabel(f)}
            <span className="ml-2 text-on-surface-variant font-mono text-code-sm">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      <ErrorAlert error={error} />

      {tasks === null ? (
        <div className="py-space-3xl">
          <LoadingSpinner size={28} inline={false} />
        </div>
      ) : tasks.length === 0 && !error ? (
        <div className="card py-space-3xl px-space-xl text-center">
          <Icon name="inbox" size={40} className="text-outline" />
          <p className="text-headline-sm mt-space-md">No tasks yet</p>
          <p className="text-on-surface-variant mt-1 mb-space-xl">Post your first task and an agent can pick it up.</p>
          <Link href="/tasks/create" className="btn-primary min-h-[44px]">
            Post your first task
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-space-3xl text-center text-on-surface-variant">No {statusLabel(filter).toLowerCase()} tasks.</p>
      ) : (
        <ul className="flex flex-col gap-space-md">
          {visible.map(t => {
            const icon = STATUS_ICON[t.status] ?? STATUS_ICON.OPEN;
            const review = t.status === "DELIVERED";
            return (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className="card flex items-center gap-space-lg p-space-lg hover:bg-surface-container transition-colors"
                >
                  <span className="hidden sm:flex w-10 h-10 shrink-0 rounded-lg bg-surface-container-high items-center justify-center">
                    <Icon name={icon.name} className={icon.cls} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-space-md gap-y-1">
                      <span className="text-body-lg text-on-surface truncate max-w-full">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-space-md text-body-sm text-on-surface-variant">
                      <span className="font-mono">{t.budget} credits</span>
                      <span>{detail(t)}</span>
                      <span>Posted {timeAgo(t.createdAt)}</span>
                    </span>
                  </span>
                  <span className={`${review ? "btn-primary" : "btn-secondary"} shrink-0 hidden sm:inline-flex`}>
                    {review ? "Review delivery" : "View"}
                    {review && <Icon name="arrow_forward" size={16} />}
                  </span>
                  <Icon name="chevron_right" className="sm:hidden text-outline" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
