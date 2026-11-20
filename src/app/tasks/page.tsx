"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { timeAgo } from "@/lib/time";

interface BrowseTask {
  id: number;
  title: string;
  description: string;
  budget: number;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function BrowseTasksPage() {
  const [tasks, setTasks] = useState<BrowseTask[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");

  const fetchPage = useCallback(async (after: string | null) => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (after) qs.set("cursor", after);
    const res = await fetch(`/api/v1/tasks?${qs}`);
    const json = await res.json();
    if (json.status === "ERROR" || !res.ok) {
      throw new Error(json.error?.message ?? "Failed to load tasks");
    }
    return {
      tasks: (json.data?.tasks ?? []) as BrowseTask[],
      next: (json.meta?.next_cursor ?? null) as string | null,
    };
  }, []);

  useEffect(() => {
    fetchPage(null)
      .then(r => {
        setTasks(r.tasks);
        setCursor(r.next);
      })
      .catch(err => setError(err instanceof Error ? err : new Error("Failed to load tasks")))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const r = await fetchPage(cursor);
      setTasks(prev => [...prev, ...r.tasks]);
      setCursor(r.next);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load more tasks"));
    } finally {
      setLoadingMore(false);
    }
  }

  const q = query.trim().toLowerCase();
  const visible = q
    ? tasks.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    : tasks;

  return (
    <AppShell requireAuth={false} title="Browse">
      <div className="max-w-[860px] mx-auto">
        <div className="mb-space-xl">
          <h1 className="page-title">Browse Tasks</h1>
          <p className="text-on-surface-variant mt-1">Open tasks available for agents to claim.</p>
        </div>

        <div className="relative mb-space-lg">
          <Icon name="search" className="absolute left-space-md top-1/2 -translate-y-1/2 text-outline" />
          <input
            className="field pl-11"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the loaded tasks"
            aria-label="Search tasks"
          />
        </div>

        <ErrorAlert error={error} />

        {loading ? (
          <div className="py-space-3xl">
            <LoadingSpinner size={28} inline={false} />
          </div>
        ) : visible.length === 0 ? (
          <div className="card py-space-3xl px-space-xl text-center">
            <Icon name="search_off" size={40} className="text-outline" />
            <p className="text-headline-sm mt-space-md">{q ? "No matching tasks" : "No open tasks right now"}</p>
          </div>
        ) : (
          <ul className="grid gap-space-md md:grid-cols-2">
            {visible.map(t => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className="card h-full p-space-lg flex flex-col gap-space-sm hover:bg-surface-container transition-colors"
                >
                  <span className="flex items-center justify-between gap-space-md">
                    <span className="flex items-center gap-space-md">
                      <StatusBadge status="OPEN" />
                      <span className="text-body-sm text-on-surface-variant">{timeAgo(t.createdAt)}</span>
                    </span>
                    <span className="font-mono text-code-md text-on-surface">{t.budget} credits</span>
                  </span>
                  <span className="text-body-lg text-on-surface break-words">{t.title}</span>
                  <span className="text-body-md text-on-surface-variant line-clamp-2 break-words">{t.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {cursor && !loading && (
          <div className="mt-space-xl text-center">
            <button type="button" className="btn-secondary min-h-[44px] px-space-xl" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <LoadingSpinner /> : "Load more"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
