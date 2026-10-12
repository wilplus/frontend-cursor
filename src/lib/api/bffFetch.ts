import { getAuthToken } from "@/lib/api/auth-client";
import { guestOwnerHeaders } from "@/services/api/projects";

/* -------------------------------------------------------------------------- */
/*  bffFetch — one call to our own /api BFF (audit D5, 2026-09-28)             */
/*                                                                            */
/*  The same four steps were written out in every service client: read the    */
/*  session token, add the Bearer header, catch the network error, parse the   */
/*  JSON. This does those four and nothing else. What a failure MEANS stays    */
/*  with each client (null, false, a typed result), so moving a client onto    */
/*  this changes none of its answers.                                          */
/*                                                                            */
/*  `guest: true` (Phase 0.6) sends the guest owner token when there is no     */
/*  session token -- only on reads the backend opens to a project's guest.     */
/* -------------------------------------------------------------------------- */

export interface BffRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON, with `Content-Type: application/json`. */
  json?: unknown;
  /** A body sent as is (a FormData upload); use `json` for JSON. */
  body?: BodyInit;
  /** Headers sent before Content-Type and the Bearer header. */
  headers?: Record<string, string>;
  /** Abort when no answer has come within this long (a network failure). */
  timeoutMs?: number;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  /** "required" (default): without a session token nothing is sent.
   *  "optional": send anyway, without the Bearer header, and let the session
   *  cookie authenticate. */
  auth?: "required" | "optional";
  /** With no session token, send the guest owner token (implies "optional").
   *  Only for reads the backend opens to a project's own guest (Phase 0.6). */
  guest?: boolean;
}

export type BffResult =
  /** No session token and `auth` was required: nothing was sent. */
  | { kind: "unauthenticated" }
  /** The request never produced a response. */
  | { kind: "network" }
  /** Any HTTP response. `body` is the parsed JSON, or null when there was
   *  none or it did not parse. */
  | { kind: "response"; ok: boolean; status: number; body: unknown };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function requestInit(request: BffRequest, token: string | null): RequestInit {
  const headers: Record<string, string> = { ...request.headers };
  if (request.json !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (request.guest) Object.assign(headers, guestOwnerHeaders());
  const init: RequestInit = { headers };
  if (request.method) init.method = request.method;
  if (request.json !== undefined) init.body = JSON.stringify(request.json);
  else if (request.body !== undefined) init.body = request.body;
  if (request.cache) init.cache = request.cache;
  if (request.credentials) init.credentials = request.credentials;
  return init;
}

export async function bffFetch(
  path: string,
  request: BffRequest = {},
): Promise<BffResult> {
  const token = await getAuthToken();
  if (!token && request.auth !== "optional" && !request.guest) {
    return { kind: "unauthenticated" };
  }
  const init = requestInit(request, token);
  const controller = request.timeoutMs ? new AbortController() : null;
  if (controller) init.signal = controller.signal;
  const timer = controller ? setTimeout(() => controller.abort(), request.timeoutMs) : null;
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    return { kind: "network" };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const body = await readJson(response);
  return { kind: "response", ok: response.ok, status: response.status, body };
}

/** The parsed body of a 2xx answer, or null for anything else. */
export async function bffOkBody(path: string, request: BffRequest = {}): Promise<unknown> {
  const result = await bffFetch(path, request);
  return result.kind === "response" && result.ok ? result.body : null;
}
