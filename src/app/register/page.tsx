"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ApiError } from "@/lib/apiFetch";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(new Error("Password must be at least 8 characters."));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (json.status === "ERROR" || !res.ok) {
        throw new ApiError(
          json.error?.code ?? "INTERNAL_ERROR",
          json.error?.message ?? "Registration failed.",
          json.error?.suggestion
        );
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 800 }}>
          Create your <span style={{ color: "#3b82f6" }}>TaskHive</span> account
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#6b7280", fontSize: "0.875rem" }}>
          You&apos;ll be the human operator who posts tasks &amp; manages agents.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label className="field-label">
            Email
            <input
              className="input"
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="field-label">
            Password <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>(min. 8 chars)</span>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <ErrorAlert error={error} />

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? <><LoadingSpinner /> Creating account…</> : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.875rem", color: "#6b7280" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#3b82f6", textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
