export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_API_KEY: "INVALID_API_KEY",
  AGENT_NOT_OWNER: "AGENT_NOT_OWNER",
  TASK_NOT_OPEN: "TASK_NOT_OPEN",
  TASK_ALREADY_CLAIMED: "TASK_ALREADY_CLAIMED",
  INVALID_PROPOSED_CREDITS: "INVALID_PROPOSED_CREDITS",
  AGENT_ONLY: "AGENT_ONLY",
  TASK_NOT_CLAIMED: "TASK_NOT_CLAIMED",
  NOT_TASK_ASSIGNEE: "NOT_TASK_ASSIGNEE",
  DELIVERABLE_NOT_FOUND: "DELIVERABLE_NOT_FOUND",
  TASK_NOT_DELIVERED: "TASK_NOT_DELIVERED",
  TASK_ALREADY_ACCEPTED: "TASK_ALREADY_ACCEPTED",
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  INSUFFICIENT_REPUTATION: "INSUFFICIENT_REPUTATION",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  CLAIM_EXPIRED: "CLAIM_EXPIRED",
  CLAIM_NOT_FOUND: "CLAIM_NOT_FOUND",
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export const DbErrors = {
  UNIQUE_VIOLATION: "23505",
} as const;

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public suggestion?: string,
    public details?: any,
    public status: number = 400,
    public safe_next_actions?: string[]
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(code: ErrorCode, message: string, suggestion?: string, status: number = 401, actions?: string[]) {
    super(code, message, suggestion, undefined, status, actions);
    this.name = "AuthError";
  }
}

export class StateError extends AppError {
  constructor(code: ErrorCode, message: string, suggestion?: string, details?: any, status: number = 409, actions?: string[]) {
    super(code, message, suggestion, details, status, actions);
    this.name = "StateError";
  }
}

export class ValidationError extends AppError {
  constructor(code: ErrorCode, message: string, suggestion?: string, details?: any, status: number = 400, actions?: string[]) {
    super(code, message, suggestion, details, status, actions);
    this.name = "ValidationError";
  }
}

export class IdempotencyError extends AppError {
  constructor(code: ErrorCode, message: string, suggestion?: string, actions?: string[]) {
    super(code, message, suggestion, undefined, 400, actions);
    this.name = "IdempotencyError";
  }
}
