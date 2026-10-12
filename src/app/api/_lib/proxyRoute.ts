import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, type Failures, type Relay } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  proxyRoute — a route handler that only relays (frontend glue cut,         */
/*  2026-10-12). Most BFF routes were the same eight to twenty lines around   */
/*  one callBackend call, differing in the path and a few options. A route    */
/*  that only relays is now one line:                                         */
/*                                                                            */
/*    export const POST = proxyRoute("POST", "/v2/x/:id/y", { body: "json" }); */
/*                                                                            */
/*  `:name` in the path is the route's own `[name]` param, URI-encoded. It    */
/*  calls callBackend exactly as the hand-written routes did, so auth, the     */
/*  request id and the envelopes are callBackend's.                           */
/* -------------------------------------------------------------------------- */

export interface ProxyOptions {
  /** The request body, sent as JSON: "text" exactly as it came, "json" as it
   *  came or `{}` when empty. Omit to send none. */
  body?: "text" | "json";
  relay?: Relay;
  failures?: Failures;
  /** Forward the guest owner token when there is no session (Phase 0.6). */
  guest?: boolean;
  /** Answer with `Cache-Control: no-store`. */
  noStore?: boolean;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Context = { params: Record<string, string> };

/** `/v2/x/:id/y` with each `:param` from the route's params, URI-encoded. */
function fill(template: string, params: Record<string, string>): string {
  return template.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name]));
}

export function proxyRoute(method: Method, template: string, options: ProxyOptions = {}) {
  return async function handler(req: NextRequest, context: Context): Promise<NextResponse> {
    const text = options.body ? await req.text() : null;
    const response = await callBackend(fill(template, context?.params ?? {}), {
      method,
      ...(text === null
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: options.body === "json" ? text || "{}" : text,
          }),
      ...(options.relay ? { relay: options.relay } : {}),
      ...(options.failures ? { failures: options.failures } : {}),
      ...(options.guest ? { guestOwnerFrom: req } : {}),
    });
    if (options.noStore) response.headers.set("Cache-Control", "no-store");
    return response;
  };
}
