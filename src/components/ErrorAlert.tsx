"use client";

import { ApiError } from "@/lib/apiFetch";

interface ErrorAlertProps {
  error: ApiError | Error | string | null;
}

export default function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null;

  const message = typeof error === "string" ? error : error.message;
  const suggestion = error instanceof ApiError ? error.suggestion : undefined;

  return (
    <div role="alert" style={{
      background: "rgba(220,38,38,0.1)",
      border: "1px solid rgba(220,38,38,0.4)",
      borderRadius: "8px",
      padding: "0.75rem 1rem",
      margin: "0.75rem 0",
      fontSize: "0.875rem",
    }}>
      <span style={{ color: "#f87171", fontWeight: 600 }}>Error: </span>
      <span style={{ color: "#fca5a5" }}>{message}</span>
      {suggestion && (
        <p style={{ margin: "0.25rem 0 0", color: "#9ca3af", fontSize: "0.8rem" }}>
          💡 {suggestion}
        </p>
      )}
    </div>
  );
}
