"use client";

/* -------------------------------------------------------------------------- */
/*  Dev harness for the coach's walk, screens 1 to 7 (e2e/coach-walk.spec.mjs). */
/*                                                                            */
/*  Answers every route the walk touches from fixtures, and records every     */
/*  write on window.__walkCalls so the spec can prove what was sent and when. */
/*  The blind gate is played the way the backend plays it: the moment read    */
/*  answers 409 until a rating for that snippet has been PUT, and the queue   */
/*  row carries no kind before. One Take, three moments, one of each kind    */
/*  that gets an answer (P2-11): an error, a praise, a rewrite. The take is   */
/*  deckless, so each moment's slide is the default deck's (B5).              */
/* -------------------------------------------------------------------------- */

import CoachWalkEntry from "@/components/willab/coachwalk/CoachWalkEntry";

declare global {
  interface Window {
    __walkCalls?: { url: string; method: string; body: unknown }[];
  }
}

const TAKE = "22222222-2222-2222-2222-222222222222";
const SNIP_1 = "33333333-3333-3333-3333-333333333331";
const SNIP_2 = "33333333-3333-3333-3333-333333333332";
const SNIP_3 = "33333333-3333-3333-3333-333333333333";
const PASSAGE_1 = "We, we rebuilt the, the pipeline from scratch.";
const PASSAGE_2 = "Here is the number that matters.";
const PASSAGE_3 = "So the thing is that we, um, need more time to ship it.";
const SNIPS = [SNIP_1, SNIP_2, SNIP_3];
const PASSAGES: Record<string, string> = { [SNIP_1]: PASSAGE_1, [SNIP_2]: PASSAGE_2, [SNIP_3]: PASSAGE_3 };
const KINDS: Record<string, string> = { [SNIP_1]: "error", [SNIP_2]: "praise", [SNIP_3]: "rewrite" };
/** The model's draft by kind: a script, a praise line, a clearer version. */
const DRAFTS: Record<string, { surface: string; text: string }> = {
  [SNIP_1]: { surface: "exercise_script", text: "Say the phrase once, then pause." },
  [SNIP_2]: { surface: "praise_line", text: "You let the number land." },
  [SNIP_3]: { surface: "clearer_version", text: "We need more time to ship it." },
};
/** The default deck's slide each moment began on (a deckless take). */
const SLIDES: Record<string, { index: number; title: string; body: string }> = {
  [SNIP_1]: { index: 0, title: "Main premise", body: "" },
  [SNIP_2]: { index: 1, title: "Development", body: "" },
  [SNIP_3]: { index: 2, title: "Conclusion", body: "" },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  if (!window.__walkCalls) {
    window.__walkCalls = [];
    const rated = new Map<string, string>();
    const resolved = new Set<string>();
    const real = window.fetch.bind(window);
    type Ctx = { url: string; method: string; body: any };
    type Handler = { when: (c: Ctx) => boolean; reply: (c: Ctx) => Response };
    const snip = (url: string) => SNIPS.find((id) => url.includes(id)) ?? SNIP_2;
    const state = (id: string) => (resolved.has(id) ? "answered" : rated.has(id) ? "answer_it" : "judge_it");
    const kindOf = (id: string) => KINDS[id];
    const request = (id: string, over: Record<string, unknown> = {}) => ({
      id: `req-${id}`, take_session_id: TAKE, snippet_id: id, reason: "nothing_targets_it", kind: kindOf(id),
      spotted: kindOf(id) === "error" ? [{ error_id: "restart_repair", label: "Restarting a phrase" }] : [],
      created_at: "2026-09-30T10:01:00Z", resolution: null, resolved_exercise_id: null, answer_text: null,
      draft: null, resolved_at: null, shared_at: null, offered_since: false, candidates: [], available_exercises: [],
      ...over,
    });
    const record = (c: Ctx, body: unknown = c.body) => window.__walkCalls?.push({ url: c.url, method: c.method, body });
    const moment = (url: string, tail: string) => url.includes(`/api/v2/coach/sessions/${TAKE}/snippets/`) && url.endsWith(tail);
    const HANDLERS: Handler[] = [
      { when: (c) => c.url.includes("/api/v2/user/profile"),
        reply: () => json({ is_coach: true, proficient_languages: ["en"] }) },
      { when: (c) => c.url.includes("/api/v2/coach/speaking-errors"),
        reply: () => json({ errors: [
          { error_id: "restart_repair", label: "Restarting a phrase", definition: "d", asks: "a", status: "detected", detector_ref: "verbal-cues-v1", observed_by: null, active: true },
          { error_id: "rushing", label: "Rushing", definition: "d", asks: "a", status: "detected", detector_ref: "x", observed_by: null, active: true },
          { error_id: "trailing_mumble", label: "Trailing mumble", definition: "d", asks: "a", status: "observed", detector_ref: null, observed_by: "c", active: true },
        ] }) },
      { when: (c) => c.url.includes("/api/v2/coach/catalogue") && c.method === "POST",
        reply: (c) => { record(c); return json({ line: { id: "l-9", ...c.body, version: 2, active: true } }); } },
      { when: (c) => c.url.includes("/api/v2/coach/catalogue"),
        reply: () => json({ lines: [{ id: "l-1", lane: "praise", pattern_kind: "read", pattern_key: "confident_read", text: "You held the room.", version: 1, active: true }] }) },
      { when: (c) => c.url.includes("/api/v2/coach/exercises/") && c.url.endsWith("/video"),
        reply: (c) => {
          record(c, "multipart");
          const id = decodeURIComponent(c.url.split("/exercises/")[1].split("/video")[0]);
          return json({ exercise: { exercise_id: id, title: "Land it", instruction: "x", introduction_copy: "",
            explanation_video_url: "https://v/x.mp4", acoustic_problem_tags: ["restart_repair"],
            matching_criteria: { primary_problem_tag: "restart_repair" }, active: true, version: 1 },
            version: 1, transcript_status: "pending" });
        } },
      { when: (c) => c.url.includes("/api/v2/coach/exercises"),
        reply: () => json({ exercises: [], speaking_errors: [] }) },
      { when: (c) => c.url.includes(`/api/v2/coach/sessions/${TAKE}/word`) && c.method === "PUT",
        reply: (c) => { record(c); return json({ word: { take_session_id: TAKE, text: c.body?.text, video_ref: null, video_url: null, shared_at: "now" } }); } },
      { when: (c) => c.url.includes(`/api/v2/coach/sessions/${TAKE}/word`),
        reply: () => json({ word: null }) },
      { when: (c) => c.url.includes("/api/v2/coach/queue/moments"),
        reply: () => json([
          { pseudonym: "Quiet Heron", waiting: 3, takes: [{
            session_id: TAKE, take_index: 2, sent_at: "2026-09-30T10:00:00Z", waiting: 3,
            moments: SNIPS.map((id) => ({ snippet_id: id, state: state(id), ...(rated.has(id) ? { kind: kindOf(id) } : {}) })),
          }] },
          { pseudonym: "Calm Otter", waiting: 0, waiting_for_text: 1, takes: [{
            session_id: "take-waiting", take_index: 1, sent_at: "2026-10-01T09:00:00Z", waiting: 0,
            waiting_for_text: true, moments: [],
          }] },
        ]) },
      { when: (c) => moment(c.url, "/moment"),
        reply: (c) => {
          const id = snip(c.url);
          if (!rated.has(id)) return json({ code: "BLIND_RATING_REQUIRED", error: "Rate the original moment first." }, 409);
          return json({ passage: PASSAGES[id], speaker_answer: id === SNIP_3 ? "in_between" : "no",
            coach_answer: rated.get(id) ?? null,
            speaker_goal: "Sound calm in front of the board",
            request: request(id, resolved.has(id) ? { resolution: "no_safe_match" } : {}), named_errors: [] });
        } },
      { when: (c) => moment(c.url, "/exercise-request/draft"),
        reply: (c) => { record(c); const id = snip(c.url); return json({ draft: {
          ...DRAFTS[id], model_version: "m", kept: true } }); } },
      { when: (c) => moment(c.url, "/exercise-request/video"),
        reply: (c) => { record(c, "multipart"); return json({ video_url: "https://v/answer.mp4" }); } },
      { when: (c) => moment(c.url, "/exercise-request"),
        reply: (c) => { record(c); const id = snip(c.url); resolved.add(id); return json({ request: request(id, {
          resolution: c.body?.resolution ?? "no_safe_match", resolved_exercise_id: c.body?.exercise_id ?? null,
          resolved_at: "now", shared_at: c.body?.share_with_user ? "now" : null }) }); } },
      { when: (c) => c.url.includes(`/api/v2/coach/sessions/${TAKE}`),
        reply: () => json({ session_id: TAKE, presentation_ref: null, snippets: [
          { id: SNIP_1, index: 0, transcript: "", audio_ref: null, start_offset_ms: 0, duration_ms: 9000, slide: SLIDES[SNIP_1] },
          { id: SNIP_2, index: 1, transcript: "", audio_ref: null, start_offset_ms: 9000, duration_ms: 7000, slide: SLIDES[SNIP_2] },
          { id: SNIP_3, index: 2, transcript: "", audio_ref: null, start_offset_ms: 16000, duration_ms: 6000, slide: SLIDES[SNIP_3] },
        ] }) },
      { when: (c) => c.url.includes("/api/v2/coach/snippets/") && c.url.endsWith("/confidence-label"),
        reply: (c) => { record(c); const id = snip(c.url); rated.set(id, c.body?.value);
          return json({ saved: true, snippet_id: id, state_id: "confidence", value: c.body?.value, unrateable: false }); } },
    ];
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const ctx: Ctx = { url, method, body };
      const handler = HANDLERS.find((h) => h.when(ctx));
      return handler ? handler.reply(ctx) : real(input, init);
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
      <CoachWalkEntry />
    </main>
  );
}
