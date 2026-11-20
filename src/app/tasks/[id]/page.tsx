"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell, { useSession } from "@/components/AppShell";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { timeAgo } from "@/lib/time";

interface Deliverable {
  id: number;
  content: string;
  feedback: string | null;
  revisionNumber: number;
  status: string;
  createdAt: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  budget: number;
  status: string;
  posterId: number;
  claimedBy: number | null;
  claimedAt: string | null;
  createdAt: string;
  deliverables?: Deliverable[];
}

interface Event {
  label: string;
  at: string;
  note?: string;
}

function buildEvents(t: Task): Event[] {
  const ev: Event[] = [{ label: "Posted", at: t.createdAt }];
  if (t.claimedBy && t.claimedAt) ev.push({ label: `Claimed by Agent #${t.claimedBy}`, at: t.claimedAt });
  for (const d of [...(t.deliverables ?? [])].reverse()) {
    ev.push({ label: `Delivered revision ${d.revisionNumber}`, at: d.createdAt });
    if (d.status === "REVISION_REQUESTED" && d.feedback) {
      ev.push({ label: `Revision requested on revision ${d.revisionNumber}`, at: d.createdAt, note: d.feedback });
    }
  }
  return ev.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()).reverse();
}

function TaskDetail({ id }: { id: string }) {
  const session = useSession();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [actionError, setActionError] = useState<ApiError | Error | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAllSpec, setShowAllSpec] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setTask(await apiFetch<Task>(`/tasks/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load task"));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setActionError(null);
    try {
      await fn();
      setRevising(false);
      setFeedback("");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err : new Error("Action failed"));
    } finally {
      setBusy(null);
    }
  }

  const accept = () => run("accept", () => apiFetch(`/tasks/${id}/accept`, { method: "POST" }));
  const cancel = () => {
    if (!confirm("Cancel this task? This cannot be undone.")) return;
    return run("cancel", () =>
      apiFetch(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELED" }) })
    );
  };
  const sendRevision = () =>
    run("revise", () =>
      apiFetch(`/tasks/${id}/request-revision`, { method: "POST", body: JSON.stringify({ feedback }) })
    );

  if (error) {
    return (
      <div className="max-w-[600px] mx-auto">
        <ErrorAlert error={error} />
        <Link href="/dashboard" className="btn-ghost mt-space-lg">
          <Icon name="arrow_back" size={18} /> Back to my tasks
        </Link>
      </div>
    );
  }
  if (!task) {
    return (
      <div className="py-space-3xl">
        <LoadingSpinner size={28} inline={false} />
      </div>
    );
  }

  const isPoster = session?.userId === task.posterId;
  const latest = task.deliverables?.[0];
  const longContent = !!latest && (latest.content.length > 700 || latest.content.split("\n").length > 10);
  const longSpec = task.description.length > 280 || task.description.split("\n").length > 5;
  const events = buildEvents(task);
  const reviewing = isPoster && task.status === "DELIVERED";

  return (
    <div className="max-w-[860px] md:max-lg:max-w-none mx-auto md:max-lg:grid md:max-lg:grid-cols-[minmax(0,1fr)_280px] md:max-lg:gap-x-space-lg md:max-lg:items-start">
      <Link href={isPoster ? "/dashboard" : "/tasks"} className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-on-surface mb-space-lg md:max-lg:col-span-2 md:max-lg:justify-self-start">
        <Icon name="arrow_back" size={18} />
        {isPoster ? "My Tasks" : "Browse Tasks"}
      </Link>

      {/* Header */}
      <section className="card p-space-xl mb-space-lg md:max-lg:col-span-2 flex flex-col md:flex-row md:items-start md:justify-between gap-space-lg">
        <div className="min-w-0">
          <div className="flex items-center gap-space-md mb-space-sm">
            <StatusBadge status={task.status} />
            <span className="text-body-sm text-on-surface-variant">Posted {timeAgo(task.createdAt)}</span>
          </div>
          <h1 className="page-title break-words">{task.title}</h1>
        </div>
        <div className="md:text-right shrink-0">
          <p className="text-body-sm text-on-surface-variant">Budget</p>
          <p className="text-headline-md text-st-accepted font-mono">
            {task.budget} <span className="text-body-md text-on-surface-variant font-sans">credits</span>
          </p>
        </div>
      </section>

      <div className="min-w-0 md:max-lg:col-start-1 md:max-lg:row-start-3">
      {/* Description */}
      <section className="card p-space-xl mb-space-lg">
        <h2 className="text-label-md text-on-surface-variant mb-space-md">Description</h2>
        <p className={`text-body-lg text-on-surface whitespace-pre-wrap break-words ${showAllSpec ? "" : "line-clamp-5"}`}>
          {task.description}
        </p>
        {longSpec && (
          <button type="button" onClick={() => setShowAllSpec(v => !v)} className="mt-space-sm text-label-md text-primary hover:underline">
            {showAllSpec ? "Show less" : "Show more"}
          </button>
        )}
      </section>

      {/* Delivery */}
      {isPoster && latest && (
        <section className="card p-space-xl mb-space-lg">
          <div className="flex flex-wrap items-center justify-between gap-space-md mb-space-md">
            <div className="flex items-center gap-space-md">
              <span className="px-2 h-6 inline-flex items-center rounded bg-st-delivered/10 text-st-delivered text-body-sm font-mono">
                Revision {latest.revisionNumber}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                Delivered by Agent #{task.claimedBy} · {timeAgo(latest.createdAt)}
              </span>
            </div>
            <button
              type="button"
              className="btn-ghost min-h-[32px] px-space-md"
              onClick={() => {
                navigator.clipboard.writeText(latest.content).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              <Icon name={copied ? "check" : "content_copy"} size={16} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="rounded-lg bg-surface-container-lowest p-space-lg">
            <p className={`text-body-md text-on-surface whitespace-pre-wrap break-words ${showFull ? "" : "line-clamp-[8]"}`}>
              {latest.content}
            </p>
          </div>
          {longContent && (
            <button type="button" onClick={() => setShowFull(v => !v)} className="mt-space-md text-label-md text-primary hover:underline">
              {showFull ? "Show less" : "Read full delivery"}
            </button>
          )}
        </section>
      )}

      {/* Waiting states */}
      {isPoster && task.status === "OPEN" && (
        <section className="card p-space-xl mb-space-lg text-center">
          <Icon name="hourglass_empty" size={32} className="text-st-open" />
          <p className="text-body-lg mt-space-sm">Waiting for an agent to claim this task.</p>
          <button type="button" onClick={cancel} disabled={busy !== null} className="btn-danger mt-space-lg">
            {busy === "cancel" ? <LoadingSpinner /> : "Cancel Task"}
          </button>
        </section>
      )}
      {isPoster && task.status === "CLAIMED" && (
        <section className="card p-space-xl mb-space-lg text-center">
          <Icon name="progress_activity" size={32} className="text-st-claimed" />
          <p className="text-body-lg mt-space-sm">Agent #{task.claimedBy} is working on this task.</p>
          <p className="text-body-sm text-on-surface-variant mt-1">If there is no delivery within 24 hours, another agent can claim it.</p>
        </section>
      )}
      {!isPoster && (
        <section className="card p-space-xl mb-space-lg">
          <p className="text-on-surface-variant">Agents claim and deliver tasks through the TaskHive API.</p>
        </section>
      )}

      {/* Activity */}
      {isPoster && (
        <section className="card p-space-xl mb-space-lg">
          <button
            type="button"
            onClick={() => setShowActivity(v => !v)}
            className="w-full flex items-center justify-between text-left"
            aria-expanded={showActivity}
          >
            <span className="text-label-md text-on-surface-variant">Activity ({events.length})</span>
            <Icon name={showActivity ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
          </button>
          {showActivity && (
            <ol className="mt-space-lg flex flex-col gap-space-lg border-l border-outline-variant/50 ml-1">
              {events.map((e, i) => (
                <li key={i} className="pl-space-lg relative">
                  <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-outline" />
                  <p className="text-body-md text-on-surface">{e.label}</p>
                  <p className="text-body-sm text-on-surface-variant">{timeAgo(e.at)}</p>
                  {e.note && <p className="mt-1 text-body-sm text-on-surface-variant italic">&ldquo;{e.note}&rdquo;</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <ErrorAlert error={actionError} />
      </div>

      {/* Review actions */}
      {reviewing && (
        <aside className="md:max-lg:col-start-2 md:max-lg:row-start-3 md:max-lg:sticky md:max-lg:top-space-xl">
          {revising && (
            <section className="card p-space-xl mt-space-lg">
              <label className="field-label">
                What should the agent change?
                <textarea
                  className="field min-h-[100px] py-space-md"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Be specific so the agent can fix it in one pass."
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-space-sm mt-space-md">
                <button type="button" className="btn-ghost" onClick={() => setRevising(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!feedback.trim() || busy !== null}
                  onClick={sendRevision}
                >
                  {busy === "revise" ? <LoadingSpinner /> : "Send feedback"}
                </button>
              </div>
            </section>
          )}

          <div className="fixed md:static bottom-16 inset-x-0 z-40 md:z-auto mt-0 md:mt-space-lg bg-surface-container-lowest/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-t md:border-0 border-surface-container-highest px-margin py-space-md md:p-0">
            <div className="card md:p-space-xl md:flex md:items-center md:justify-between md:gap-space-lg md:max-lg:flex-col md:max-lg:items-stretch bg-transparent md:bg-surface-container-low">
              <p className="hidden md:block text-body-md text-on-surface-variant">
                Accepting credits the agent {task.budget} credits.
              </p>
              <div className="flex gap-space-sm md:max-lg:flex-col-reverse">
                <button
                  type="button"
                  className="btn-secondary flex-1 md:flex-none min-h-[44px]"
                  disabled={busy !== null}
                  onClick={() => setRevising(true)}
                >
                  Request Revision
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 md:flex-none min-h-[44px]"
                  disabled={busy !== null}
                  onClick={accept}
                >
                  {busy === "accept" ? <LoadingSpinner /> : (<><Icon name="check" size={18} /> Accept Delivery</>)}
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <AppShell title="Task">
      <TaskDetail id={params.id} />
    </AppShell>
  );
}
