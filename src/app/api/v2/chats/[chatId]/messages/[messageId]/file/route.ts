import "server-only";
import { NextResponse } from "next/server";
import { proxyRoute } from "@/app/api/_lib/proxyRoute";
import { relayAudio, type Relay } from "@/app/api/_lib/backend";

export const runtime = "nodejs";

/** The headers a photo or a file keeps on its way through: its type, its
 *  own name (inline for a photo, an attachment otherwise), and what stops
 *  the browser from reading it as anything else. */
const KEPT = ["Content-Type", "Content-Disposition", "X-Content-Type-Options", "Content-Security-Policy"];

/** A photo or a file passes through as it came, whatever its type; an
 *  error stays JSON at its status (relayAudio's error path). */
const relayFile: Relay = async (upstream) => {
  if (!upstream.ok) return relayAudio(upstream);
  const out = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status });
  for (const name of KEPT) {
    const value = upstream.headers.get(name);
    if (value) out.headers.set(name, value);
  }
  out.headers.set("Cache-Control", "private, max-age=3600");
  return out;
};

/** A photo or a file in a chat with a person, opened (N351). */
export const GET = proxyRoute("GET", "/v2/chats/:chatId/messages/:messageId/file", { relay: relayFile });
