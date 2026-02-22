"use client";

interface LoadingSpinnerProps {
  size?: number;
  inline?: boolean;
}

export default function LoadingSpinner({ size = 16, inline = true }: LoadingSpinnerProps) {
  return (
    <span
      aria-label="Loading..."
      style={{
        display: inline ? "inline-block" : "block",
        width: size,
        height: size,
        border: `2px solid rgba(255,255,255,0.2)`,
        borderTop: `2px solid #3b82f6`,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        verticalAlign: "middle",
        margin: inline ? "0 0 0 6px" : "0 auto",
      }}
    />
  );
}
