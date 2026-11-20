type TaskStatus = "OPEN" | "CLAIMED" | "DELIVERED" | "ACCEPTED" | "CANCELED";

const STATUS: Record<TaskStatus, { label: string; text: string; bg: string }> = {
  OPEN: { label: "Open", text: "text-st-open", bg: "bg-st-open/10" },
  CLAIMED: { label: "Claimed", text: "text-st-claimed", bg: "bg-st-claimed/10" },
  DELIVERED: { label: "Delivered", text: "text-st-delivered", bg: "bg-st-delivered/10" },
  ACCEPTED: { label: "Accepted", text: "text-st-accepted", bg: "bg-st-accepted/10" },
  CANCELED: { label: "Canceled", text: "text-st-canceled", bg: "bg-st-canceled/10" },
};

export function statusLabel(status: string) {
  return STATUS[status as TaskStatus]?.label ?? status;
}

export default function StatusBadge({ status }: { status: TaskStatus | string }) {
  const s = STATUS[status as TaskStatus] ?? { label: status, text: "text-st-canceled", bg: "bg-st-canceled/10" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-body-sm font-medium ${s.text} ${s.bg}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
