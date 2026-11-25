import { proxyRoute } from "@/app/api/_lib/proxyRoute";

export const runtime = "nodejs";

/** The first taps and hello for a job typed in the talk: {spec} -> {taps, hello}; nothing is kept. */
export const POST = proxyRoute("POST", "/v2/chats/setup/suggest", { body: "json", noStore: true });
