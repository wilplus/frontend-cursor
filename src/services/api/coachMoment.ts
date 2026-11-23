import { bffFetch } from "@/lib/api/bffFetch";

export type CoachMomentReference = {
  arc_id: string;
  take_session_id: string;
  snippet_id: string;
  practise: boolean;
};

export function coachMomentFromMetadata(raw: unknown): CoachMomentReference | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { arc_id, take_session_id, snippet_id, practise } = raw as Partial<CoachMomentReference>;
  if (typeof arc_id !== "string" || !arc_id || typeof take_session_id !== "string" ||
      !take_session_id || typeof snippet_id !== "string" || !snippet_id) return null;
  return { arc_id, take_session_id, snippet_id, practise: practise === true };
}

export async function fetchCoachMoment(moment: CoachMomentReference) {
  const take = encodeURIComponent(moment.take_session_id);
  const snippet = encodeURIComponent(moment.snippet_id);
  const response = await bffFetch(
    `/api/v2/user/lounge/moment/${snippet}?take_session_id=${take}`, { cache: "no-store" },
  );
  if (response.kind !== "response" || !response.ok || !response.body) return null;
  const { arc_id, take_index, audio_url, start_offset_ms, duration_ms } = response.body as {
    arc_id?: string; take_index?: number; audio_url?: string; start_offset_ms?: number; duration_ms?: number;
  };
  if (arc_id !== moment.arc_id || typeof audio_url !== "string" || !/^https?:\/\//.test(audio_url) ||
      typeof start_offset_ms !== "number" || !Number.isInteger(start_offset_ms) || start_offset_ms < 0 ||
      typeof duration_ms !== "number" || !Number.isInteger(duration_ms) || duration_ms <= 0) return null;
  return {
    src: audio_url, startOffsetMs: start_offset_ms, durationMs: duration_ms,
    takeIndex: typeof take_index === "number" ? take_index : null,
  };
}
