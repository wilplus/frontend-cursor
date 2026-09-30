"use client";

/* -------------------------------------------------------------------------- */
/*  Dev harness for the coach's walk, screens 1 to 3 (e2e/coach-walk.spec.mjs). */
/*                                                                            */
/*  Answers every route the walk touches from fixtures, and records the two   */
/*  writes (the rating PUT and the Nothing-to-add PUT) on window.__walkCalls   */
/*  so the spec can prove what was sent and when. The blind gate is played     */
/*  the way the backend plays it: the moment read answers 409 until a rating  */
/*  for that snippet has been PUT, and the queue row carries no kind before.  */
/* -------------------------------------------------------------------------- */

import CoachWalkEntry from "@/components/willab/coachwalk/CoachWalkEntry";

declare global {
  interface Window {
    __walkCalls?: { url: string; method: string; body: unknown }[];
    __walkAnswered?: (sessionId: string, snippetId: string) => void;
  }
}

const TAKE = "22222222-2222-2222-2222-222222222222";
const SNIP_1 = "33333333-3333-3333-3333-333333333331";
const SNIP_2 = "33333333-3333-3333-3333-333333333332";
const PASSAGE_1 = "We, we rebuilt the, the pipeline from scratch.";
const PASSAGE_2 = "Here is the number that matters.";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  if (!window.__walkCalls) {
    window.__walkCalls = [];
    const rated = new Set<string>();
    const resolved = new Set<string>();
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : null;

      if (url.includes("/api/v2/user/profile")) {
        return json({ is_coach: true, proficient_languages: ["en"] });
      }
      if (url.includes("/api/v2/coach/queue/moments")) {
        const state = (id: string) => (resolved.has(id) ? "nothing_to_add" : rated.has(id) ? "answer_it" : "judge_it");
        const kind = (id: string) => (rated.has(id) ? { kind: "error" } : {});
        return json([
          {
            pseudonym: "Quiet Heron",
            waiting: 2,
            takes: [{
              session_id: TAKE, take_index: 2, sent_at: "2026-09-30T10:00:00Z", waiting: 2,
              moments: [
                { snippet_id: SNIP_1, state: state(SNIP_1), ...kind(SNIP_1) },
                { snippet_id: SNIP_2, state: state(SNIP_2), ...kind(SNIP_2) },
              ],
            }],
          },
          { pseudonym: "Calm Otter", waiting: 0, takes: [] },
        ]);
      }
      if (url.includes(`/api/v2/coach/sessions/${TAKE}/snippets/`) && url.endsWith("/moment")) {
        const id = url.includes(SNIP_1) ? SNIP_1 : SNIP_2;
        if (!rated.has(id)) return json({ code: "BLIND_RATING_REQUIRED", error: "Rate the original moment first." }, 409);
        return json({
          passage: id === SNIP_1 ? PASSAGE_1 : PASSAGE_2,
          speaker_answer: "no",
          coach_answer: "no",
          speaker_goal: "Sound calm in front of the board",
          request: {
            id: `req-${id}`, take_session_id: TAKE, snippet_id: id, reason: "nothing_targets_it",
            kind: "error", spotted: [{ error_id: "restart_repair", label: "Restarting a phrase" }],
            created_at: "2026-09-30T10:01:00Z",
            resolution: resolved.has(id) ? "no_safe_match" : null,
            resolved_exercise_id: null, answer_text: null, draft: null, resolved_at: null, shared_at: null,
            offered_since: false, candidates: [], available_exercises: [],
          },
          named_errors: [],
        });
      }
      if (url.includes(`/api/v2/coach/sessions/${TAKE}/snippets/`) && url.endsWith("/exercise-request")) {
        const id = url.includes(SNIP_1) ? SNIP_1 : SNIP_2;
        window.__walkCalls?.push({ url, method, body });
        resolved.add(id);
        return json({ request: {
          id: `req-${id}`, take_session_id: TAKE, snippet_id: id, reason: "nothing_targets_it", kind: "error",
          spotted: [], created_at: "x", resolution: "no_safe_match", resolved_exercise_id: null,
          resolved_at: "now", shared_at: null, offered_since: false, candidates: [], available_exercises: [],
        } });
      }
      if (url.includes(`/api/v2/coach/sessions/${TAKE}`)) {
        // The take's clips (audio_ref null: the harness has no audio). The
        // transcript is withheld here as the backend withholds it.
        return json({
          session_id: TAKE, snippets: [
            { id: SNIP_1, index: 0, transcript: "", audio_ref: null, start_offset_ms: 0, duration_ms: 9000 },
            { id: SNIP_2, index: 1, transcript: "", audio_ref: null, start_offset_ms: 9000, duration_ms: 7000 },
          ],
        });
      }
      if (url.includes("/api/v2/coach/snippets/") && url.endsWith("/confidence-label")) {
        const id = url.includes(SNIP_1) ? SNIP_1 : SNIP_2;
        window.__walkCalls?.push({ url, method, body });
        rated.add(id);
        return json({ saved: true, snippet_id: id, state_id: "confidence", value: body?.value, unrateable: false });
      }
      return real(input, init);
    };
  }
  const session = {
    access_token: "dev-token", token_type: "bearer", expires_at: 4102444800,
    refresh_token: "dev-refresh", user: { id: "dev-coach" },
  };
  document.cookie = `sb-dummy-auth-token=base64-${btoa(JSON.stringify(session))}; path=/`;
}

export default function CoachWalkHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-[18px] font-bold">Coach walk harness</h1>
      <CoachWalkEntry onAnswer={(sessionId, snippetId) => window.__walkAnswered?.(sessionId, snippetId)} />
    </main>
  );
}
