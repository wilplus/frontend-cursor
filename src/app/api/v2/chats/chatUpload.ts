import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, failure, getAccessToken, relayLenient, type Failures } from "@/app/api/_lib/backend";

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

export function chatUploadRoute(kind: "photo" | "file") {
  return async function POST(req: NextRequest, { params }: { params: { chatId: string } }) {
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
      return await callBackend(`/v2/chats/${encodeURIComponent(params.chatId)}/${kind}`, {
        method: "POST",
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
