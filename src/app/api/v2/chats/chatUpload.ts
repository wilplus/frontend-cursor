import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayAudio, relayLenient, type Failures, type Relay } from "@/app/api/_lib/backend";

/**
 * A photo or a file sent from the "+" in a chat with a person (N351):
 * multipart `file`, relayed to `POST /v2/chats/<chatId>/photo` or `/file`
 * as the voice note's upload is relayed (`[chatId]/voice`). The backend
 * checks the chat, the type and the size (10 MB) and answers the message.
 * The platform's own body limit (about 4.5 MB) refuses anything larger
 * first; the app makes a big photo smaller before it is sent.
 */
const FAILURES: Failures = {
  unauthenticated: { status: 401, body: { code: "UNAUTHENTICATED", error: "Not authenticated" } },
  notConfigured: { status: 502, body: { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" } },
  unreachable: "rethrow",
  timeout: { status: 504, body: { code: "UPSTREAM_TIMEOUT", error: "Took too long. Try again in a moment." } },
};
const RELAY = relayLenient();

/** The headers a photo or a file keeps on its way through: its type, its
 *  own name (inline for a photo, an attachment otherwise), and what stops
 *  the browser from reading it as anything else. */
const KEPT = ["Content-Type", "Content-Disposition", "X-Content-Type-Options", "Content-Security-Policy"];

/** A photo or a file passes through as it came, whatever its type; an
 *  error stays JSON at its status (relayAudio's error path). */
export const relayFile: Relay = async (upstream) => {
  if (!upstream.ok) return relayAudio(upstream);
  const out = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status });
  for (const name of KEPT) {
    const value = upstream.headers.get(name);
    if (value) out.headers.set(name, value);
  }
  out.headers.set("Cache-Control", "private, max-age=3600");
  return out;
};

export function chatUploadRoute(kind: "photo" | "file") {
  return uploadRoute("POST", (params) => `/v2/chats/${encodeURIComponent(params.chatId ?? "")}/${kind}`);
}

/** A multipart upload relayed as it came: a chat's photo or file, or your
 *  profile's photo (N366, `PUT /v2/profile/photo`). */
export function uploadRoute(method: "POST" | "PUT", path: (params: Record<string, string>) => string) {
  return async function upload(req: NextRequest, { params }: { params: Record<string, string> }) {
    const token = await getAccessToken();
    if (!token) return failure(FAILURES.unauthenticated!);
    let inbound: FormData;
    try {
      inbound = await req.formData();
    } catch {
      return NextResponse.json({ code: "INVALID_MULTIPART", error: "Invalid multipart payload." }, { status: 400 });
    }
    // Rebuilt so Node's fetch sets its own multipart boundary.
    const out = new FormData();
    for (const [key, value] of inbound.entries()) out.append(key, value);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55_000);
    try {
      return await callBackend(path(params ?? {}), {
        method,
        body: out,
        signal: controller.signal,
        token,
        failures: FAILURES,
        relay: RELAY,
      });
    } catch {
      return NextResponse.json({ code: "BACKEND_UNAVAILABLE", error: "Backend unreachable" }, { status: 502 });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}
