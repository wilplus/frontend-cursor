import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/app/api/_lib/backend";

/* -------------------------------------------------------------------------- */
/*  accountRoute — the BFF routes of Email and password (backend N189).       */
/*                                                                            */
/*  A relay like proxyRoute, plus the two things the security log keeps: the  */
/*  speaker's IP address and device. Vercel's own address would otherwise be  */
/*  all the backend sees (booking checkout forwards the IP the same way).     */
/* -------------------------------------------------------------------------- */

/** The caller's IP address and device, as headers for the backend. */
export function clientHeaders(req: { headers: Headers }): Record<string, string> {
  const headers: Record<string, string> = {};
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ip) headers["X-Forwarded-For"] = ip;
  const agent = (req.headers.get("user-agent") || "").trim();
  if (agent) headers["User-Agent"] = agent.slice(0, 512);
  return headers;
}

export function accountRoute(method: "GET" | "POST", path: string) {
  return async function handler(req: NextRequest): Promise<NextResponse> {
    const body = method === "POST" ? (await req.text()) || "{}" : null;
    const response = await callBackend(path, {
      method,
      headers: {
        ...clientHeaders(req),
        ...(body === null ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === null ? {} : { body }),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}
