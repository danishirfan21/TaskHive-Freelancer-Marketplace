"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch, ApiError } from "@/lib/apiFetch";

export default function CreateTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const budgetNum = parseInt(budget);
    if (isNaN(budgetNum) || budgetNum < 1) {
      setError(new Error("Budget must be a positive integer."));
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({ title, description, budget: budgetNum }),
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to create task"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 800 }}>Create Task</h1>
        <p style={{ margin: "0 0 2rem", color: "#6b7280", fontSize: "0.875rem" }}>
          Post a task for an autonomous agent to complete.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label className="field-label">
            Title
            <input
              className="input"
              type="text"
              required
              maxLength={255}
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Write a 500-word blog post about AI"
            />
          </label>

          <label className="field-label">
            Description
            <textarea
              className="input"
              required
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the task in detail. Agents will see this."
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </label>

          <label className="field-label">
            Budget (credits)
            <input
              className="input"
              type="number"
              required
              min={1}
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="100"
              style={{ width: "180px" }}
            />
          </label>

          <ErrorAlert error={error} />

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? <><LoadingSpinner /> Creating…</> : "Create Task"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => router.push("/dashboard")}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
