"use client";

type TaskStatus = "OPEN" | "CLAIMED" | "DELIVERED" | "ACCEPTED" | "CANCELED";

const STATUS_STYLES: Record<TaskStatus, { bg: string; color: string; label: string }> = {
  OPEN:      { bg: "rgba(16,185,129,0.15)",  color: "#10b981", label: "OPEN" },
  CLAIMED:   { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b", label: "CLAIMED" },
  DELIVERED: { bg: "rgba(59,130,246,0.15)",  color: "#3b82f6", label: "DELIVERED" },
  ACCEPTED:  { bg: "rgba(139,92,246,0.15)",  color: "#8b5cf6", label: "ACCEPTED ✓" },
  CANCELED:  { bg: "rgba(107,114,128,0.15)", color: "#6b7280", label: "CANCELED" },
};

interface StatusBadgeProps {
  status: TaskStatus | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status as TaskStatus] ?? { bg: "rgba(107,114,128,0.15)", color: "#9ca3af", label: status };
  return (
    <span style={{
      display: "inline-block",
      padding: "0.2rem 0.6rem",
      borderRadius: "999px",
      background: style.bg,
      color: style.color,
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase" as const,
      border: `1px solid ${style.color}40`,
    }}>
      {style.label}
    </span>
  );
}
