import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  bffFetch — one call to our own /api BFF (audit D5, 2026-09-28)             */
/*                                                                            */
/*  The same four steps were written out in every service client: read the    */
/*  session token, add the Bearer header, catch the network error, parse the   */
/*  JSON. This does those four and nothing else. What a failure MEANS stays    */
/*  with each client (null, false, a typed result), so moving a client onto    */
/*  this changes none of its answers.                                          */
/*                                                                            */
/*  Clients that fall back to guest headers when signed out keep their own     */
/*  plumbing for now; that path is not modelled here.                          */
/* -------------------------------------------------------------------------- */

export interface BffRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON, with `Content-Type: application/json`. */
  json?: unknown;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  /** "required" (default): without a session token nothing is sent.
   *  "optional": send anyway, without the Bearer header, and let the session
   *  cookie authenticate. */
  auth?: "required" | "optional";
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
  const headers: Record<string, string> = {};
  if (request.json !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { headers };
  if (request.method) init.method = request.method;
  if (request.json !== undefined) init.body = JSON.stringify(request.json);
  if (request.cache) init.cache = request.cache;
  if (request.credentials) init.credentials = request.credentials;
  return init;
}

export async function bffFetch(
  path: string,
  request: BffRequest = {},
): Promise<BffResult> {
  const token = await getAuthToken();
  if (!token && request.auth !== "optional") return { kind: "unauthenticated" };
  let response: Response;
  try {
    response = await fetch(path, requestInit(request, token));
  } catch {
    return { kind: "network" };
  }
  const body = await readJson(response);
  return { kind: "response", ok: response.ok, status: response.status, body };
}
