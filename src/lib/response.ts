import { NextResponse } from "next/server";

export type ApiResponse<T = any> = {
  meta: {
    request_id: string;
    timestamp: string;
    version: string;
    next_cursor?: number | string | null;
  };
  status: "SUCCESS" | "ERROR";
  data: T | null;
  error: {
    code: string;
    message: string;
    suggestion?: string;
    details?: any;
    safe_next_actions?: string[];
  } | null;
};

export function successResponse<T>(data: T, meta: { next_cursor?: number | string | null } = {}): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      version: "1.0",
      ...meta,
    },
    status: "SUCCESS" as const,
    data,
    error: null,
  });
}

export function errorResponse(
  code: string,
  message: string,
  suggestion?: string,
  details?: any,
  status: number = 400,
  safe_next_actions?: string[]
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      meta: {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
      status: "ERROR" as const,
      data: null,
      error: {
        code,
        message,
        suggestion,
        details,
        safe_next_actions,
      },
    },
    { status }
  );
}
