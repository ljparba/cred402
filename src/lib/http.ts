/**
 * Small HTTP helpers for API route handlers: consistent JSON envelopes and a
 * safe error responder that never leaks stack traces to clients (plan §12).
 */
import { NextResponse } from "next/server";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export interface ApiError {
  error: string;
  code?: string;
  requestId?: string;
}

export function apiError(
  message: string,
  status: number,
  extra?: { code?: string; requestId?: string; headers?: HeadersInit },
): NextResponse {
  const body: ApiError = { error: message };
  if (extra?.code) body.code = extra.code;
  if (extra?.requestId) body.requestId = extra.requestId;
  return NextResponse.json(body, { status, headers: extra?.headers });
}

/**
 * Wrap a handler so any thrown error becomes a clean 500 without exposing
 * internals. Logs the real error server-side for diagnostics.
 */
export async function safeHandler<T extends Response>(
  label: string,
  fn: () => Promise<T>,
): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[${label}]`, err);
    return apiError("Internal server error.", 500, { code: "INTERNAL_ERROR" });
  }
}
