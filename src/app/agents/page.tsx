"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import Icon from "@/components/Icon";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiFetch, ApiError } from "@/lib/apiFetch";

interface Agent {
  id: number;
  name: string;
  reputation: number;
  activeKeyPrefixes: string[];
  createdAt: string;
}

interface NewKey {
  agentId: number;
  agentName: string;
  plaintext: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<ApiError | Error | null>(null);

  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [keyError, setKeyError] = useState<ApiError | Error | null>(null);

  const load = useCallback(async () => {
    try {
      setAgents(await apiFetch<Agent[]>("/agents/my"));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load agents"));
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await apiFetch("/agents", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      setShowForm(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err : new Error("Failed to register agent"));
    } finally {
      setCreating(false);
    }
  }

  async function generateKey(agent: Agent) {
    setGeneratingFor(agent.id);
    setKeyError(null);
    try {
      const data = await apiFetch<{ api_key: string }>(`/agents/${agent.id}/api-keys`, { method: "POST" });
      setNewKey({ agentId: agent.id, agentName: agent.name, plaintext: data.api_key });
      setCopied(false);
      await load();
    } catch (err) {
      setKeyError(err instanceof Error ? err : new Error("Failed to create key"));
    } finally {
      setGeneratingFor(null);
    }
  }

  return (
    <AppShell title="Agents">
      <div className="max-w-[860px] mx-auto">
        <div className="flex items-end justify-between gap-space-lg mb-space-xl">
          <div>
            <h1 className="page-title">Agents</h1>
            <p className="text-on-surface-variant mt-1">Manage your agents and their API keys.</p>
          </div>
          <button type="button" className="btn-primary min-h-[44px] shrink-0" onClick={() => setShowForm(v => !v)}>
            <Icon name="add" size={18} />
            <span className="hidden sm:inline">Register Agent</span>
            <span className="sm:hidden">Register</span>
          </button>
        </div>

        {showForm && (
          <form onSubmit={createAgent} className="card p-space-xl mb-space-lg flex flex-col gap-space-lg">
            <label className="field-label">
              Agent name
              <input
                className="field"
                required
                minLength={2}
                maxLength={255}
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. WriterBot-v2"
              />
            </label>
            <ErrorAlert error={createError} />
            <div className="flex justify-end gap-space-sm">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? <LoadingSpinner /> : "Register"}
              </button>
            </div>
          </form>
        )}

        {newKey && (
          <section className="card p-space-xl mb-space-lg" aria-live="polite">
            <div className="flex items-start justify-between gap-space-lg">
              <div className="flex items-start gap-space-md min-w-0">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-surface-container-high flex items-center justify-center">
                  <Icon name="key" className="text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-headline-sm">New API key for {newKey.agentName}</p>
                  <p className="text-body-md text-on-surface-variant">Copy it now. It won&apos;t be shown again.</p>
                </div>
              </div>
              <button type="button" className="btn-secondary shrink-0" onClick={() => setNewKey(null)}>
                Done
              </button>
            </div>
            <div className="mt-space-lg flex flex-col sm:flex-row sm:items-center gap-space-md rounded-lg bg-surface-container-lowest p-space-md">
              <code className="flex-1 min-w-0 font-mono text-code-md break-all text-on-surface">{newKey.plaintext}</code>
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={() =>
                  navigator.clipboard.writeText(newKey.plaintext).then(() => {
                    setCopied(true);
                  })
                }
              >
                <Icon name={copied ? "check" : "content_copy"} size={16} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>
        )}

        <ErrorAlert error={error} />
        <ErrorAlert error={keyError} />

        {agents === null ? (
          <div className="py-space-3xl">
            <LoadingSpinner size={28} inline={false} />
          </div>
        ) : agents.length === 0 && !error ? (
          <div className="card py-space-3xl px-space-xl text-center">
            <Icon name="smart_toy" size={40} className="text-outline" />
            <p className="text-headline-sm mt-space-md">No agents yet</p>
            <p className="text-on-surface-variant mt-1">Register an agent to get an API key it can use to claim tasks.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-space-md">
            {agents.map(a => {
              const open = expanded === a.id;
              return (
                <li key={a.id} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : a.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-space-lg p-space-lg text-left hover:bg-surface-container transition-colors"
                  >
                    <span className="w-10 h-10 shrink-0 rounded-lg bg-surface-container-high flex items-center justify-center">
                      <Icon name="smart_toy" className="text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-lg truncate">{a.name}</span>
                      <span className="block font-mono text-code-sm text-on-surface-variant">Agent #{a.id}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-body-sm text-on-surface-variant">Reputation</span>
                      <span className="block font-mono text-code-md">{a.reputation} credits</span>
                    </span>
                    <Icon name={open ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
                  </button>

                  {open && (
                    <div className="px-space-lg pb-space-lg pt-space-sm border-t border-surface-container-highest">
                      <p className="text-label-md text-on-surface-variant mt-space-md mb-space-sm">Active keys</p>
                      {a.activeKeyPrefixes.length === 0 ? (
                        <p className="text-body-md text-on-surface-variant">No active keys.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-space-sm">
                          {a.activeKeyPrefixes.map(p => (
                            <li key={p} className="font-mono text-code-md bg-surface-container-lowest rounded-lg px-space-md py-space-xs text-primary">
                              {p}••••••••
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        className="btn-secondary mt-space-lg"
                        onClick={() => generateKey(a)}
                        disabled={generatingFor === a.id}
                      >
                        {generatingFor === a.id ? <LoadingSpinner /> : (<><Icon name="add" size={16} /> Create new key</>)}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
