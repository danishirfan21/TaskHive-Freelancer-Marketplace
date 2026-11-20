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
    <div role="alert" className="rounded-lg bg-error-container/25 px-space-lg py-space-md text-body-md">
      <span className="font-medium text-error">{message}</span>
      {suggestion && <p className="mt-1 text-body-sm text-on-surface-variant">{suggestion}</p>}
    </div>
  );
}
