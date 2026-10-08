/* -------------------------------------------------------------------------- */
/*  The coach panel harness's fixtures (build plan P0/P1). DEV ONLY.           */
/*                                                                            */
/*  Answers every route the panel and the old answer flow touch, and records   */
/*  every call on window.__panelCalls so the spec can prove what was asked    */
/*  and WHEN: the moment read answers 409 until a rating for that snippet has */
/*  been PUT, exactly as the backend's blind gate does, and the queue carries */
/*  no kind before a rating. Two speakers in the queue: Quiet Heron (Take 2   */
/*  with four moments to judge, Take 1 answered; their goal) and Calm Otter   */
/*  (a Take still waiting for its text). The Speakers read (D-CP-12) adds the */
/*  two with every moment answered, Bold Finch and Quick Wren, counts alone.  */
/*  The blind lines answer 404: switched off, as today. The training corpus  */
/*  (D-CP-20) answers three imports as the prototype draws them: "Workshop   */
/*  recording" with its set-up not finished, "Board update, March" (Jane     */
/*  Doe, three moments to judge) and "Keynote rehearsal" (Sam Lee, all eight */
/*  labelled); an import's queue carries ids alone, its clip comes from the  */
/*  playback route, and a label PUT marks the piece done.                    */
/*                                                                            */
/*  Sample content, never shown by the product.                               */
/* -------------------------------------------------------------------------- */

import { mapMomentsQueue, type QueueSpeaker } from "@/lib/willab/coachWalk";
import { makeToneUrl } from "../feedback-walk/walkFixtures";

declare global {
  interface Window {
    __panelCalls?: { url: string; method: string; body: unknown; at: number }[];
    __panelRated?: Set<string>;
  }
}

export const TAKE_2 = "44444444-4444-4444-4444-444444444442";
export const TAKE_1 = "44444444-4444-4444-4444-444444444441";
export const SNIPS = [
  "55555555-5555-5555-5555-555555555551",
  "55555555-5555-5555-5555-555555555552",
  "55555555-5555-5555-5555-555555555553",
  "55555555-5555-5555-5555-555555555554",
] as const;
export const PASSAGES: Record<string, string> = {
  [SNIPS[0]]: "We grew revenue forty percent last quarter, and we're ready to scale.",
  [SNIPS[1]]: "This is the moment the board leans in.",
  [SNIPS[2]]: "So basically what we're kind of trying to do is grow the team.",
  [SNIPS[3]]: "And then, well, the numbers.",
};
const KINDS: Record<string, string> = {
  [SNIPS[0]]: "error", [SNIPS[1]]: "praise", [SNIPS[2]]: "rewrite", [SNIPS[3]]: "ambiguity",
};
const SPEAKER_ANSWERS: Record<string, string> = {
  [SNIPS[0]]: "no", [SNIPS[1]]: "yes", [SNIPS[2]]: "in_between", [SNIPS[3]]: "not_sure",
};
/** What fired, error moments only (the request carries nothing for the rest). */
export const HEARD = [
  { error_id: "rushing", label: "Rushing" },
  { error_id: "ending_compression", label: "Ending compression" },
];
/** "The machine heard", for every kind (D-CP-13): the errors on the error
 *  moment, the cues behind the praise, the clearer version's reason (the
 *  line is left out on that moment, Q-CP13a A), and "nothing" on the note. */
const MACHINE_HEARD: Record<string, { kind: string; key: string; label?: string }[]> = {
  [SNIPS[0]]: HEARD.map((h) => ({ kind: "error", key: h.error_id, label: h.label })),
  [SNIPS[1]]: [{ kind: "cue", key: "landed_ending" }, { kind: "cue", key: "settled_pitch" }],
  [SNIPS[2]]: [{ kind: "reason", key: "weak_delivery_read" }],
  [SNIPS[3]]: [{ kind: "nothing", key: "nothing" }],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The queue as the backend sends it, given what has been rated / answered. */
export function queueJson(rated: ReadonlySet<string>, resolved: ReadonlySet<string> = new Set()) {
  const state = (id: string) => (resolved.has(id) ? "answered" : rated.has(id) ? "answer_it" : "judge_it");
  const open = SNIPS.filter((id) => !resolved.has(id)).length;
  return [
    { pseudonym: "Quiet Heron", goal: HERON_GOAL, waiting: open, takes: [
      { session_id: TAKE_1, take_index: 1, sent_at: "2026-10-01T10:00:00Z", waiting: 0,
        moments: ["a", "b", "c"].map((x) => ({ snippet_id: `done-${x}`, state: "answered", kind: "praise" })) },
      { session_id: TAKE_2, take_index: 2, sent_at: "2026-10-06T10:00:00Z", waiting: open,
        moments: SNIPS.map((id) => ({ snippet_id: id, state: state(id), ...(rated.has(id) ? { kind: KINDS[id] } : {}) })) },
    ] },
    { pseudonym: "Calm Otter", waiting: 0, takes: [
      { session_id: "take-otter", take_index: 1, sent_at: "2026-10-06T11:00:00Z", waiting: 0,
        waiting_for_text: true, moments: [] },
    ] },
  ];
}

export const HERON_GOAL = "Sound calm and sure in the board meeting.";

/* ── the training corpus ─────────────────────────────────────────────── */
export const IMPORT_SETUP = "66666666-6666-4666-8666-666666666661";
export const IMPORT_BOARD = "66666666-6666-4666-8666-666666666662";
export const IMPORT_KEYNOTE = "66666666-6666-4666-8666-666666666663";
export const CORPUS_SNIPS = [
  "77777777-7777-4777-8777-777777777771",
  "77777777-7777-4777-8777-777777777772",
  "77777777-7777-4777-8777-777777777773",
] as const;
/** The words of each corpus piece: never drawn by the panel, before or after
 *  the label (N1); the spec proves it. */
export const CORPUS_WORDS: Record<string, string> = {
  [CORPUS_SNIPS[0]]: "Our margins held through the second quarter.",
  [CORPUS_SNIPS[1]]: "I think, maybe, we could consider the other option.",
  [CORPUS_SNIPS[2]]: "This is where the numbers tell the story.",
  ["77777777-7777-4777-8777-777777777774"]: "We kept the workshop to the three things that matter.",
  ["77777777-7777-4777-8777-777777777775"]: "Write it down before you forget it.",
};
/** The workshop import's pieces, served once its set-up is saved. */
export const SETUP_SNIPS = ["77777777-7777-4777-8777-777777777774", "77777777-7777-4777-8777-777777777775"] as const;

export function importsJson(labelled: ReadonlySet<string>) {
  return { imports: [
    { session_id: IMPORT_SETUP, arc_id: null, topic: "Workshop recording", speaker_label: null, created_at: "2026-10-06T09:00:00Z",
      status: "ready", queue_count: 5, labelled_count: 0, language: null, setup_complete: false, duration_sec: 192, archived_at: null },
    { session_id: IMPORT_BOARD, arc_id: null, topic: "Board update, March", speaker_label: "Jane Doe", created_at: "2026-10-05T09:00:00Z",
      status: "ready", queue_count: 3, labelled_count: CORPUS_SNIPS.filter((id) => labelled.has(id)).length, language: "en",
      setup_complete: true, duration_sec: 600, archived_at: null },
    { session_id: IMPORT_KEYNOTE, arc_id: null, topic: "Keynote rehearsal", speaker_label: "Sam Lee", created_at: "2026-10-04T09:00:00Z",
      status: "ready", queue_count: 8, labelled_count: 8, language: "en", setup_complete: true, duration_sec: 1500, archived_at: null },
  ], count: 3 };
}

/** GET /v2/coach/speakers: every speaker, counts alone, never a moment. */
export function speakersJson(rated: ReadonlySet<string>, resolved: ReadonlySet<string> = new Set()) {
  const queue = queueJson(rated, resolved);
  const summary = queue.map((sp) => ({
    pseudonym: sp.pseudonym, goal: sp.goal ?? null, waiting: sp.waiting,
    waiting_for_text: sp.takes.filter((t) => "waiting_for_text" in t && t.waiting_for_text).length,
    take_count: sp.takes.length,
    takes: sp.takes.map((t) => ({
      session_id: t.session_id, take_index: t.take_index, sent_at: t.sent_at, waiting: t.waiting,
      waiting_for_text: "waiting_for_text" in t && t.waiting_for_text === true,
      answered: !("waiting_for_text" in t && t.waiting_for_text) && t.waiting === 0,
    })),
  }));
  const answered = (name: string, goal: string, n: number) => ({
    pseudonym: name, goal, waiting: 0, waiting_for_text: 0, take_count: n,
    takes: Array.from({ length: n }, (_, i) => ({
      session_id: `${name.toLowerCase().replace(" ", "-")}-${n - i}`, take_index: n - i,
      sent_at: `2026-09-${10 + i}T10:00:00Z`, waiting: 0, waiting_for_text: false, answered: true,
    })),
  });
  return [...summary, answered("Bold Finch", "Open the keynote without notes.", 3),
    answered("Quick Wren", "Pitch to investors in five minutes.", 1)];
}

/** The queue as the panel holds it, for the still screens' starting state. */
export function queueSpeakers(rated: ReadonlySet<string> = new Set()): QueueSpeaker[] {
  return mapMomentsQueue(queueJson(rated));
}

/** V4's two blind sheets (S-B8 A): the signed wording the backend serves and
 *  the prototype's sample words. Never a machine pick, a slice or a level. */
const V4_PICKS = {
  wording: {
    queue_line: "Also waiting · blind", row: "Pick the moment for feedback",
    title: "Pick the moment for feedback", caption: "Words and audio. No names, no hint of the machine's pick.",
    question: "Which moment most needs feedback?", moment: "Moment {letter}", this_one: "This one",
    needs_it_most: "Needs it most", save: "Save my pick", none: "None needs it",
    progress: "Block {n} of {of}", kept: "Thank you. That one is kept.",
  },
  items: [{ sheet_id: "v4-sheet-1", n: 1, of: 1, moments: [
    { clip_id: "v4-a", letter: "A", audio_ref: null, start_offset_ms: 0, duration_ms: 7000,
      words: "So what we found, and this is the part I want you to remember, is that people stay when they feel seen." },
    { clip_id: "v4-b", letter: "B", audio_ref: null, start_offset_ms: 7000, duration_ms: 6000,
      words: "Our second quarter numbers, which I'll go through quickly, were roughly in line." },
    { clip_id: "v4-c", letter: "C", audio_ref: null, start_offset_ms: 13000, duration_ms: 4000,
      words: "And that is why I'm asking you today to fund the pilot." },
  ] }],
};
const V4_SURER = {
  wording: {
    queue_line: "Also waiting · blind", row: "Which sounds surer", title: "Which sounds surer",
    caption: "Words only. No names, no hint of which change the machine is testing.",
    said: "The words said", new: "The new version", question: "Is the new version surer?",
    yes: "Yes", no: "No", cant_tell: "Can't tell", progress: "Pair {n} of {of}",
    kept: "Thank you. That one is kept.",
  },
  items: [{ sheet_id: "v4-pair-1", n: 1, of: 1,
    said: "I think maybe we could probably start the pilot in March, if that works.",
    new: "We could start the pilot in March, if that works." }],
};

type Ctx = { url: string; method: string; body: Record<string, unknown> | null };
const v4SheetsOn = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("v4") === "1";

type Handler = { when: (c: Ctx) => boolean; reply: (c: Ctx) => Response };

function request(id: string, resolved: boolean) {
  return {
    id: `req-${id}`, take_session_id: TAKE_2, snippet_id: id, reason: "nothing_targets_it", kind: KINDS[id],
    spotted: KINDS[id] === "error" ? HEARD : [],
    created_at: "2026-10-06T10:01:00Z", resolution: resolved ? "no_safe_match" : null, resolved_exercise_id: null,
    answer_text: null, draft: null, resolved_at: resolved ? "now" : null, shared_at: null, offered_since: false,
    candidates: [], available_exercises: [],
  };
}

function handlers(rated: Map<string, string>, resolved: Set<string>, tone: string): Handler[] {
  const snip = (url: string) => SNIPS.find((id) => url.includes(id)) ?? SNIPS[0];
  const corpusSnip = (url: string) => CORPUS_SNIPS.find((id) => url.includes(id)) ?? null;
  const labelled = new Set<string>();
  const moment = (url: string, tail: string) => url.includes(`/api/v2/coach/sessions/${TAKE_2}/snippets/`) && url.endsWith(tail);
  return [
    { when: (c) => c.url.includes("/api/v2/user/profile"), reply: () => json({ is_coach: true, proficient_languages: ["en"] }) },
    { when: (c) => c.url.includes("/api/v2/coach/error-audit") || c.url.includes("/api/v2/coach/block-picks"),
      reply: () => json({ error: "off" }, 404) },
    // V4's two blind sheets answer only with ?v4=1, as the backend does only
    // once V4_COACH_SHEETS_ENABLED is on; dark otherwise, like production.
    { when: (c) => c.url.includes("/api/v2/coach/v4-moment-picks") && c.method === "GET",
      reply: () => (v4SheetsOn() ? json(V4_PICKS) : json({ error: "off" }, 404)) },
    { when: (c) => c.url.includes("/api/v2/coach/v4-surer-pairs") && c.method === "GET",
      reply: () => (v4SheetsOn() ? json(V4_SURER) : json({ error: "off" }, 404)) },
    { when: (c) => c.url.includes("/api/v2/coach/v4-") && c.method === "POST", reply: () => json({ recorded: true }) },
    { when: (c) => c.url.includes("/api/v2/coach/take-bubbles"), reply: () => json({ error: "off" }, 404) },
    { when: (c) => c.url.includes("/api/v2/coach/speaking-errors"), reply: () => json({ errors: [] }) },
    { when: (c) => c.url.includes("/api/v2/coach/queue/moments"), reply: () => json(queueJson(new Set(rated.keys()), resolved)) },
    { when: (c) => c.url.includes("/api/v2/coach/speakers"), reply: () => json(speakersJson(new Set(rated.keys()), resolved)) },
    { when: (c) => c.url.includes("/api/v2/coach/training-imports/") && c.method === "PUT",
      reply: (c) => json({ session_id: IMPORT_SETUP, topic: c.body?.topic, language: c.body?.language,
        speaker_label: c.body?.speaker_label ?? null, source: c.body?.source ?? null, setup_complete: true }) },
    { when: (c) => c.url.includes("/api/v2/coach/training-imports") && c.method === "GET", reply: () => json(importsJson(labelled)) },
    { when: (c) => c.url.includes(`/api/v2/coach/sessions/${IMPORT_SETUP}/confidence-queue`),
      reply: () => json({ session_id: IMPORT_SETUP, queue: SETUP_SNIPS.map((id, i) => ({
        snippet_id: id, transcript: CORPUS_WORDS[id], label: null,
        re_review: false, canonical_position: i, learning_exposures: [], blind_review: null, mlc2_blind_review: null,
      })) }) },
    { when: (c) => c.url.includes(`/api/v2/coach/sessions/${IMPORT_BOARD}/confidence-queue`),
      reply: () => json({ session_id: IMPORT_BOARD, queue: CORPUS_SNIPS.map((id, i) => ({
        snippet_id: id, transcript: CORPUS_WORDS[id], label: labelled.has(id) ? { value: "yes", unrateable: false } : null,
        re_review: false, canonical_position: i, learning_exposures: [], blind_review: null, mlc2_blind_review: null,
      })) }) },
    { when: (c) => c.url.includes("/corpus/clips/") && c.url.endsWith("/playback"),
      reply: (c) => json({ snippet_id: corpusSnip(c.url), url: tone, start_offset_ms: 0, duration_ms: 2400, expires_in_s: 900 }) },
    { when: (c) => c.url.includes("/api/v2/coach/snippets/") && c.url.endsWith("/confidence-label") && corpusSnip(c.url) !== null,
      reply: (c) => { const id = corpusSnip(c.url) as string; labelled.add(id);
        return json({ saved: true, snippet_id: id, state_id: "confidence", value: c.body?.value, unrateable: false }); } },
    { when: (c) => c.url.includes("/exercise-preference"), reply: () => json({ error: "off" }, 404) },
    { when: (c) => moment(c.url, "/moment"),
      reply: (c) => {
        const id = snip(c.url);
        if (!rated.has(id)) return json({ code: "BLIND_RATING_REQUIRED", error: "Rate the original moment first." }, 409);
        return json({ passage: PASSAGES[id], speaker_answer: SPEAKER_ANSWERS[id], coach_answer: rated.get(id) ?? null,
          speaker_goal: null, request: request(id, resolved.has(id)), heard: MACHINE_HEARD[id], named_errors: [] });
      } },
    { when: (c) => moment(c.url, "/exercise-request") && c.method === "PUT",
      reply: (c) => { const id = snip(c.url); resolved.add(id); return json({ request: request(id, true) }); } },
    { when: (c) => c.url.includes(`/api/v2/coach/sessions/${TAKE_2}/word`), reply: () => json({ word: null }) },
    { when: (c) => c.url.endsWith(`/api/v2/coach/sessions/${TAKE_2}`),
      reply: () => json({ session_id: TAKE_2, presentation_ref: null, snippets: SNIPS.map((id, i) => ({
        id, index: i, transcript: "", audio_ref: tone, start_offset_ms: 0, duration_ms: 2400,
        slide: { index: i % 3, title: ["Main premise", "Development", "Conclusion"][i % 3], body: "" },
      })) }) },
    { when: (c) => c.url.includes("/api/v2/coach/snippets/") && c.url.endsWith("/confidence-label"),
      reply: (c) => { const id = snip(c.url); rated.set(id, String(c.body?.value ?? ""));
        window.__panelRated?.add(id);
        return json({ saved: true, snippet_id: id, state_id: "confidence", value: c.body?.value, unrateable: false }); } },
  ];
}

/** Install the stub once; `preRated` are rated before the page draws (the
 *  still What happened screen). */
export function installPanelStub(preRated: readonly string[] = []): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production" || window.__panelCalls) return;
  window.__panelCalls = [];
  window.__panelRated = new Set(preRated);
  const rated = new Map<string, string>(preRated.map((id) => [id, "no"]));
  const resolved = new Set<string>();
  const real = window.fetch.bind(window);
  const table = handlers(rated, resolved, makeToneUrl());
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    const ctx: Ctx = { url, method, body };
    if (url.includes("/api/")) window.__panelCalls?.push({ url, method, body, at: Date.now() });
    const handler = table.find((h) => h.when(ctx));
    return handler ? handler.reply(ctx) : real(input, init);
  };
  const session = {
    access_token: "dev-token", token_type: "bearer", expires_at: 4102444800,
    refresh_token: "dev-refresh", user: { id: "dev-coach" },
  };
  document.cookie = `sb-dummy-auth-token=base64-${btoa(JSON.stringify(session))}; path=/`;
}
