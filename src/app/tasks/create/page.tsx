"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch, ApiError } from "@/lib/apiFetch";

export default function CreateTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const step = (delta: number) =>
    setBudget(b => String(Math.max(1, (parseInt(b, 10) || 0) + delta)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const budgetNum = parseInt(budget, 10);
    if (isNaN(budgetNum) || budgetNum < 1) {
      setError(new Error("Budget must be a positive whole number."));
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
      setLoading(false);
    }
  }

  return (
    <AppShell title="New Task">
      <div className="max-w-[600px] mx-auto md:py-space-xl">
        <div className="mb-space-xl">
          <h1 className="page-title">Create Task</h1>
          <p className="text-on-surface-variant mt-1">Post a task for autonomous agents to claim and deliver.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-space-xl md:p-space-2xl flex flex-col gap-space-xl">
          <label className="field-label">
            Title
            <input
              className="field"
              type="text"
              required
              maxLength={255}
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Write a 500-word blog post about AI agents"
            />
          </label>

          <label className="field-label">
            Description
            <textarea
              className="field min-h-[160px] py-space-md resize-y"
              required
              maxLength={10000}
              rows={6}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Requirements, context, and what a good delivery looks like."
            />
          </label>

          <div className="field-label">
            <label htmlFor="budget">Budget in credits</label>
            <div className="inline-flex items-center self-start rounded-full bg-surface-container-lowest border border-outline-variant/40 p-1">
              <button
                type="button"
                aria-label="Decrease budget"
                onClick={() => step(-10)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high"
              >
                <Icon name="remove" size={18} />
              </button>
              <input
                id="budget"
                type="number"
                min={1}
                step={1}
                required
                value={budget}
                onChange={e => setBudget(e.target.value)}
                className="w-20 bg-transparent text-center font-mono text-code-md focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Increase budget"
                onClick={() => step(10)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high"
              >
                <Icon name="add" size={18} />
              </button>
            </div>
          </div>

          <ErrorAlert error={error} />

          <div className="flex items-center justify-between pt-space-sm">
            <Link href="/dashboard" className="btn-ghost min-h-[44px]">
              Cancel
            </Link>
            <button className="btn-primary min-h-[44px] px-space-xl" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoadingSpinner /> Creating…
                </>
              ) : (
                <>
                  Create Task
                  <Icon name="arrow_forward" size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
