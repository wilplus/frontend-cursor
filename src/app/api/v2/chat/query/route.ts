import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

/**
 * POST /api/v2/chat/query
 *
 * Knowledge-base-backed Q&A endpoint for the post-onboarding chat
 * surface. After the user signs up and lands back on /chat, the
 * thread stays open as a persistent Q&A composer: any free-text
 * question they type goes here, gets answered against the master
 * document, and renders as a text bubble in the thread.
 *
 * Proxies to backend POST /v2/chat/query.
 *
 * Body: { question: string, session_id?: string | null }
 * Success 200: { answer: string, citations?: Array<{...}> }
 * 401 UNAUTHENTICATED
 * 5xx — backend unavailable
 *
 * Until backend ships the route this BFF just forwards the 502/404 it
 * gets back; the chat surface surfaces "Couldn't reach the coach"
 * inline so anonymous testing isn't blocked.
 */
export async function POST(req: NextRequest) {
  try {
    const backend = getBackendUrl();
    if (!backend) {
      return NextResponse.json(
        { code: "BACKEND_UNAVAILABLE", error: "Backend URL not configured" },
        { status: 502 }
      );
    }

    const token = await getV2AccessToken(req);
    if (!token) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const upstream = await fetch(`${backend}/v2/chat/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("POST /api/v2/chat/query error:", name, message, err);
    return NextResponse.json(
      {
        code: "BFF_THROWN",
        error: `BFF threw: ${name}: ${message}`,
        bff_revision: "chat-query-v1",
      },
      { status: 500 }
    );
  }
}
