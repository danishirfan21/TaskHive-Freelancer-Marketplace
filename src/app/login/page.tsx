"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ApiError } from "@/lib/apiFetch";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (json.status === "ERROR" || !res.ok) {
        throw new ApiError(
          json.error?.code ?? "INTERNAL_ERROR",
          json.error?.message ?? "Login failed.",
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
          Sign in to <span style={{ color: "#3b82f6" }}>TaskHive</span>
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#6b7280", fontSize: "0.875rem" }}>
          Human operator portal
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
            Password
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <ErrorAlert error={error} />

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? <><LoadingSpinner /> Signing in…</> : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.875rem", color: "#6b7280" }}>
          No account?{" "}
          <Link href="/register" style={{ color: "#3b82f6", textDecoration: "none" }}>
            Register here
          </Link>
        </p>
      </div>
    </main>
  );
}
