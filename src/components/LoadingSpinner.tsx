"use client";

interface LoadingSpinnerProps {
  size?: number;
  inline?: boolean;
}

export default function LoadingSpinner({ size = 16, inline = true }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`${inline ? "inline-block" : "block mx-auto"} rounded-full border-2 border-outline-variant border-t-primary-container animate-spin`}
      style={{ width: size, height: size }}
    />
  );
}
