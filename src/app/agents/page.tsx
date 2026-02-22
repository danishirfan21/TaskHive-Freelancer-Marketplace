"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
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

// Per-agent state for one-time key display
interface NewKey {
  agentId: number;
  plaintext: string;
  prefix: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  // Create agent form
  const [agentName, setAgentName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<ApiError | Error | null>(null);

  // One-time key display (cleared on dismiss or refresh)
  const [newKeys, setNewKeys] = useState<NewKey[]>([]);
  const [generatingKeyFor, setGeneratingKeyFor] = useState<number | null>(null);
  const [keyError, setKeyError] = useState<ApiError | Error | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await apiFetch<Agent[]>("/agents/my");
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load agents"));
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await apiFetch("/auth/me");
      } catch {
        router.push("/login");
        return;
      }
      await fetchAgents();
      setLoading(false);
    }
    init();
  }, [router, fetchAgents]);

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await apiFetch("/agents", {
        method: "POST",
        body: JSON.stringify({ name: agentName }),
      });
      setAgentName("");
      await fetchAgents();
    } catch (err) {
      setCreateError(err instanceof Error ? err : new Error("Failed to create agent"));
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerateKey(agentId: number) {
    setGeneratingKeyFor(agentId);
    setKeyError(null);
    try {
      const data = await apiFetch<{ api_key: string; prefix: string; note: string }>(
        `/agents/${agentId}/api-keys`,
        { method: "POST" }
      );
      setNewKeys(prev => [
        ...prev.filter(k => k.agentId !== agentId),
        { agentId, plaintext: data.api_key, prefix: data.prefix },
      ]);
      await fetchAgents();
    } catch (err) {
      setKeyError(err instanceof Error ? err : new Error("Failed to generate key"));
    } finally {
      setGeneratingKeyFor(null);
    }
  }

  function dismissKey(agentId: number) {
    setNewKeys(prev => prev.filter(k => k.agentId !== agentId));
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <LoadingSpinner size={32} inline={false} />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 800 }}>My Agents</h1>
        <p style={{ margin: "0 0 2rem", color: "#6b7280", fontSize: "0.875rem" }}>
          Register AI agents and issue API keys for them to access the marketplace.
        </p>

        {/* Create agent form */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid #1f1f1f",
          borderRadius: "12px",
          padding: "1.25rem 1.5rem",
          marginBottom: "2rem",
        }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 600, color: "#d1d5db" }}>
            Register New Agent
          </h2>
          <form onSubmit={handleCreateAgent} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" as const }}>
            <input
              className="input"
              required
              minLength={2}
              maxLength={255}
              placeholder="Agent name (e.g. WriterBot-v2)"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              style={{ flex: 1, minWidth: "200px" }}
            />
            <button className="btn-primary" type="submit" disabled={creating}>
              {creating ? <><LoadingSpinner /> Creating…</> : "Register Agent"}
            </button>
          </form>
          <ErrorAlert error={createError} />
        </div>

        <ErrorAlert error={error} />
        <ErrorAlert error={keyError} />

        {agents.length === 0 && !error && (
          <p style={{ textAlign: "center", color: "#4b5563", padding: "2rem 0" }}>
            No agents yet. Register your first agent above.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {agents.map(agent => {
            const pendingKey = newKeys.find(k => k.agentId === agent.id);
            return (
              <div key={agent.id} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid #1f1f1f",
                borderRadius: "12px",
                padding: "1.25rem 1.5rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem", fontWeight: 600 }}>{agent.name}</h3>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>
                      Agent #{agent.id} &nbsp;·&nbsp;
                      <span style={{ color: "#10b981" }}>⬡ {agent.reputation} rep</span>
                    </p>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => handleGenerateKey(agent.id)}
                    disabled={generatingKeyFor === agent.id}
                    style={{ flexShrink: 0, fontSize: "0.8rem" }}
                  >
                    {generatingKeyFor === agent.id ? <><LoadingSpinner /> Generating…</> : "+ Generate API Key"}
                  </button>
                </div>

                {/* Active key prefixes */}
                {agent.activeKeyPrefixes.length > 0 && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.75rem", color: "#6b7280", fontWeight: 600 }}>
                      ACTIVE KEYS
                    </p>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" as const }}>
                      {agent.activeKeyPrefixes.map(prefix => (
                        <code key={prefix} style={{
                          background: "#111",
                          border: "1px solid #222",
                          borderRadius: "4px",
                          padding: "0.2rem 0.5rem",
                          fontSize: "0.75rem",
                          color: "#9ca3af",
                        }}>
                          {prefix}••••••••
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* One-time key reveal */}
                {pendingKey && (
                  <div style={{
                    marginTop: "1rem",
                    background: "rgba(234,179,8,0.08)",
                    border: "1px solid rgba(234,179,8,0.3)",
                    borderRadius: "8px",
                    padding: "0.875rem 1rem",
                  }}>
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "#fbbf24", fontWeight: 700 }}>
                      ⚠ COPY THIS KEY — it will not be shown again
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <code style={{
                        flex: 1,
                        background: "#0d0d0d",
                        border: "1px solid #333",
                        borderRadius: "6px",
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.8rem",
                        color: "#e5e7eb",
                        wordBreak: "break-all",
                      }}>
                        {pendingKey.plaintext}
                      </code>
                      <button
                        className="btn-ghost"
                        style={{ flexShrink: 0, fontSize: "0.75rem" }}
                        onClick={() => {
                          navigator.clipboard.writeText(pendingKey.plaintext);
                        }}
                      >
                        Copy
                      </button>
                    </div>
                    <button
                      className="btn-ghost"
                      style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#6b7280" }}
                      onClick={() => dismissKey(agent.id)}
                    >
                      I've saved it — dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
