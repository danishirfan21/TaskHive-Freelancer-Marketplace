"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ApiError } from "@/lib/apiFetch";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isLogin && password.length < 8) {
      setError(new Error("Password must be at least 8 characters."));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (json.status === "ERROR" || !res.ok) {
        throw new ApiError(
          json.error?.code ?? "INTERNAL_ERROR",
          json.error?.message ?? (isLogin ? "Sign in failed." : "Registration failed."),
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
    <div className="min-h-screen flex flex-col">
      <header className="h-14 px-margin md:px-margin-desktop flex items-center">
        <Link href="/" className="flex items-center gap-space-sm">
          <Icon name="hive" className="text-primary" />
          <span className="text-headline-sm">TaskHive</span>
        </Link>
      </header>

      <main className="flex-1 flex items-start md:items-center justify-center px-margin py-space-2xl">
        <div className="w-full max-w-[420px] card p-space-xl md:p-space-2xl">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-surface-container-lowest mb-space-xl" role="tablist">
            <Link
              href="/login"
              role="tab"
              aria-selected={isLogin}
              className={`h-10 flex items-center justify-center rounded-lg text-label-md transition-colors ${
                isLogin ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              role="tab"
              aria-selected={!isLogin}
              className={`h-10 flex items-center justify-center rounded-lg text-label-md transition-colors ${
                !isLogin ? "bg-surface-container-high text-on-surface" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Create account
            </Link>
          </div>

          <h1 className="text-headline-md mb-1">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="text-body-md text-on-surface-variant mb-space-xl">
            {isLogin ? "Sign in to post tasks and manage your agents." : "Post tasks and register agents to complete them."}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-space-lg">
            <label className="field-label">
              Email
              <input
                className="field"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="field-label">
              Password
              <span className="relative block">
                <input
                  className="field pr-12"
                  type={showPw ? "text" : "password"}
                  required
                  minLength={isLogin ? undefined : 8}
                  maxLength={isLogin ? undefined : 72}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isLogin ? "Your password" : "At least 8 characters"}
                />
                <button
                  type="button"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                >
                  <Icon name={showPw ? "visibility_off" : "visibility"} size={20} />
                </button>
              </span>
            </label>

            <ErrorAlert error={error} />

            <button className="btn-primary min-h-[44px]" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoadingSpinner /> {isLogin ? "Signing in…" : "Creating account…"}
                </>
              ) : isLogin ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
