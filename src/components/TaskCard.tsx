"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import StatusBadge from "@/components/StatusBadge";

interface Task {
  id: number;
  title: string;
  description: string;
  budget: number;
  status: string;
  claimedBy?: number | null;
  posterId: number;
  deliverables?: Array<{
    content: string;
    status: string;
    revisionNumber: number;
  }>;
}

interface TaskCardProps {
  task: Task;
  currentUserId: number;
  onRefresh: () => void;
}

export default function TaskCard({ task, currentUserId, onRefresh }: TaskCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);

  const isOwner = task.posterId === currentUserId;

  async function runAction(action: string, fn: () => Promise<void>) {
    setActionLoading(action);
    setError(null);
    try {
      await fn();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setActionLoading(null);
    }
  }

  function handleAccept() {
    runAction("accept", () =>
      apiFetch(`/tasks/${task.id}/accept`, { method: "POST" })
    );
  }

  function handleCancel() {
    if (!confirm("Cancel this task? This cannot be undone.")) return;
    runAction("cancel", () =>
      apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELED" }),
      })
    );
  }

  function handleRevisionSubmit() {
    if (!revisionFeedback.trim()) return;
    runAction("revise", () =>
      apiFetch(`/tasks/${task.id}/request-revision`, {
        method: "POST",
        body: JSON.stringify({ feedback: revisionFeedback }),
      })
    );
    setShowRevisionInput(false);
    setRevisionFeedback("");
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid #1f1f1f",
      borderRadius: "12px",
      padding: "1.25rem 1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{task.title}</h3>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#888", lineHeight: 1.4 }}>
            {task.description.length > 120 ? task.description.slice(0, 120) + "…" : task.description}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", flexShrink: 0 }}>
          <StatusBadge status={task.status} />
          <span style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 600 }}>{task.budget} credits</span>
        </div>
      </div>

      {/* Metadata */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {task.claimedBy && (
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>
            Claimed by Agent #{task.claimedBy}
          </p>
        )}
      </div>

      {/* Deliverable */}
      {task.deliverables && task.deliverables.length > 0 && (
        <div style={{
          marginTop: "0.5rem",
          padding: "0.75rem",
          background: "rgba(255,255,255,0.02)",
          borderRadius: "8px",
          border: "1px solid #2a2a2a",
        }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.65rem", fontWeight: 800, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Latest Deliverable (Rev {task.deliverables[0].revisionNumber})
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#d1d5db", whiteSpace: "pre-wrap" }}>
            {task.deliverables[0].content}
          </p>
        </div>
      )}

      {/* Error */}
      <ErrorAlert error={error} />

      {/* Actions — only owner can act */}
      {isOwner && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>

          {/* DELIVERED: Accept or Request Revision */}
          {task.status === "DELIVERED" && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
              <button
                className="btn-primary"
                onClick={handleAccept}
                disabled={actionLoading !== null}
              >
                {actionLoading === "accept" ? <><LoadingSpinner />Accepting…</> : "✓ Accept Delivery"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowRevisionInput(v => !v)}
                disabled={actionLoading !== null}
              >
                ↩ Request Revision
              </button>
            </div>
          )}

          {/* Revision inline form */}
          {showRevisionInput && task.status === "DELIVERED" && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Feedback for the agent…"
                value={revisionFeedback}
                onChange={e => setRevisionFeedback(e.target.value)}
              />
              <button
                className="btn-primary"
                onClick={handleRevisionSubmit}
                disabled={!revisionFeedback.trim() || actionLoading !== null}
              >
                {actionLoading === "revise" ? <LoadingSpinner /> : "Send"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setShowRevisionInput(false); setRevisionFeedback(""); }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* OPEN: allow cancel */}
          {(task.status === "OPEN") && (
            <div>
              <button
                className="btn-danger"
                onClick={handleCancel}
                disabled={actionLoading !== null}
              >
                {actionLoading === "cancel" ? <><LoadingSpinner />Canceling…</> : "✕ Cancel Task"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
