import { bffFetch } from "@/lib/api/bffFetch";

/* The newcomer's one offer to join their business's community, while Take 1
   is processed (backend N559 item 1, App Model MATCH-06; backend PR #1862).
   Every read answers null on any failure, a 404 from a backend without it
   included, so the way in simply goes on without the offer. */

export type CommunityOffer = { id: string; name: string; inviter: string | null };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

async function call(init: Parameters<typeof bffFetch>[1]): Promise<Record<string, unknown> | null> {
  try {
    const result = await bffFetch("/api/v2/me/community-offer", { cache: "no-store", ...init });
    const body = result.kind === "response" && result.ok ? result.body : null;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The offer, or null (none, already answered, off, or a failure). */
export async function getCommunityOffer(): Promise<CommunityOffer | null> {
  const body = await call({ method: "GET" });
  const raw = body?.offer && typeof body.offer === "object" ? (body.offer as Record<string, unknown>) : null;
  const id = str(raw?.id);
  const name = str(raw?.name);
  return id && name ? { id, name, inviter: str(raw?.inviter) } : null;
}

/** Join or Not now; whether the backend took it. Asked once either way. */
export async function answerCommunityOffer(id: string, answer: "join" | "not_now"): Promise<boolean> {
  return (await call({ method: "POST", json: { id, answer } })) !== null;
}
