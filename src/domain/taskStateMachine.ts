export const TaskStatus = {
  OPEN: "OPEN",
  CLAIMED: "CLAIMED",
  DELIVERED: "DELIVERED",
  ACCEPTED: "ACCEPTED",
  CANCELED: "CANCELED",
} as const;

export type TaskStatusType = keyof typeof TaskStatus;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["CLAIMED", "CANCELED"],
  CLAIMED: ["DELIVERED"],
  DELIVERED: ["ACCEPTED", "CLAIMED"], // CLAIMED here is for revision path
};

export function validateTaskTransition(current: string, next: string) {
  if (current === next) return true;
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

import { StateError } from "@/lib/errors";

export function assertTransition(current: string, next: string) {
  if (!validateTaskTransition(current, next)) {
    throw new StateError("INVALID_STATE_TRANSITION", `Cannot transition from ${current} to ${next}`, "Check the task state machine rules.", { current, next }, 409);
  }
}
