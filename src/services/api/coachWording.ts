import { bffFetch } from "@/lib/api/bffFetch";

export type CoachWording = {
  words: string;
  delivery?: string;
  arc_id?: string;
  take_session_id?: string;
};

export function coachWording(raw: unknown): CoachWording | null {
  if (!raw || typeof raw !== "object") return null;
  const { words, delivery, arc_id, take_session_id } = raw as Partial<CoachWording>;
  if (typeof words !== "string" || !words.trim() || words.length > 320) return null;
  return {
    words: words.trim(),
    ...(typeof delivery === "string" && delivery.length <= 180 ? { delivery: delivery.trim() } : {}),
    ...(typeof arc_id === "string" && arc_id && typeof take_session_id === "string" && take_session_id
      ? { arc_id, take_session_id } : {}),
  };
}

const wordingPath = (arc: string) => "/api/v2/explore/arc/" + encodeURIComponent(arc) + "/coach-wording";

export async function saveCoachWording(arc: string, replyId: string): Promise<boolean> {
  const response = await bffFetch(wordingPath(arc), {
    method: "POST", json: { reply_id: replyId }, cache: "no-store",
  });
  return response.kind === "response" && response.ok &&
    coachWording((response.body as { wording?: unknown } | null)?.wording)?.arc_id === arc;
}

export async function readSavedCoachWording(arc: string): Promise<CoachWording | null> {
  const response = await bffFetch(wordingPath(arc), { cache: "no-store" });
  if (response.kind !== "response" || !response.ok) return null;
  const rows = (response.body as { items?: unknown } | null)?.items;
  if (!Array.isArray(rows)) return null;
  return rows.map(coachWording).find((wording) => wording?.arc_id === arc) ?? null;
}
