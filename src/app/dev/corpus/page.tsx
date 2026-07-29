"use client";

import CorpusPageClient from "@/app/coach/corpus/page.client";

/* -------------------------------------------------------------------------- */
/*  A harness for the training-corpus workbench, driven in a REAL browser.     */
/*                                                                            */
/*  The real screen needs a coach JWT and a live BE. What needs an engine is   */
/*  the labelling contract: that no machine read reaches the screen (N1), that */
/*  the queue is rendered in payload order (N2), that the 1–5 row does not     */
/*  exist until an answer is picked and never sends an intensity-only body     */
/*  (N3), and that the import fires SEQUENTIALLY with per-file failures.       */
/*                                                                            */
/*  Stubs the three endpoints at the fetch boundary and records every write on */
/*  window.__corpusCalls. Forces the coach profile so the N4 gate opens.       */
/*                                                                            */
/*  DEV ONLY. Production renders nothing and patches nothing.                  */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    __corpusCalls?: {
      url: string;
      method: string;
      body: unknown;
      /** Wall-clock at the moment the call was made — lets the spec prove the
       *  batch really ran SEQUENTIALLY rather than merely recording in order. */
      t: number;
    }[];
  }
}

function wavDataUri(): string {
  if (typeof window === "undefined") return "";
  const samples = 2000;
  const header = [
    0x52, 0x49, 0x46, 0x46, (36 + samples) & 0xff, ((36 + samples) >> 8) & 0xff, 0, 0,
    0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 16, 0, 0, 0, 1, 0, 1, 0,
    0x40, 0x1f, 0, 0, 0x40, 0x1f, 0, 0, 1, 0, 8, 0, 0x64, 0x61, 0x74, 0x61,
    samples & 0xff, (samples >> 8) & 0xff, 0, 0,
  ];
  const bytes = new Uint8Array(header.length + samples);
  bytes.set(header);
  bytes.fill(128, header.length);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "data:audio/wav;base64," + btoa(bin);
}

/** Deliberately served WITH a band and a score the surface must ignore — a
 *  leak would then be visible to the spec rather than theoretical (N1). */
const QUEUE = [
  {
    snippet_id: "piece-c",
    transcript: "and we shipped it in a week which nobody believed",
    start_offset_ms: 0,
    duration_ms: 250,
    session_id: "sess-1",
    label: null,
    band: "high",
    confidence_score: 0.93,
  },
  {
    snippet_id: "piece-a",
    transcript: "so we moved the launch to the second week of March",
    start_offset_ms: 0,
    duration_ms: 250,
    session_id: "sess-1",
    label: { confident: true, intensity: 5 },
    band: "low",
    confidence_score: 0.11,
  },
  {
    snippet_id: "piece-b",
    transcript: "I think maybe we could possibly try it that way",
    start_offset_ms: 0,
    duration_ms: 250,
    session_id: "sess-1",
    label: null,
    band: "mid",
    confidence_score: 0.5,
  },
];

/** How many times the async import has been polled — lets the harness answer
 *  "still working" first and "finished" after, which is the shape the FE must
 *  survive. */
let asyncPolls = 0;

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  if (!window.__corpusCalls) {
    window.__corpusCalls = [];
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/v2/user/profile") || url.includes("/profile")) {
        return new Response(JSON.stringify({ is_coach: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/confidence-queue")) {
        // sess-full is a session whose every piece is already labelled, so
        // the index's "All N labelled" badge — computed from this very
        // payload, i.e. from what the database holds — is provable.
        if (url.includes("sess-full")) {
          return new Response(
            JSON.stringify({
              session_id: "sess-full",
              count: 2,
              labelled: 2,
              queue: [
                {
                  snippet_id: "full-a",
                  transcript: "we knew it would work",
                  start_offset_ms: 0,
                  duration_ms: 250,
                  session_id: "sess-full",
                  label: { confident: true, intensity: 4 },
                  audio_ref: wavDataUri(),
                },
                {
                  snippet_id: "full-b",
                  transcript: "and it did",
                  start_offset_ms: 0,
                  duration_ms: 250,
                  session_id: "sess-full",
                  label: { confident: false },
                  audio_ref: wavDataUri(),
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            session_id: "sess-1",
            count: QUEUE.length,
            labelled: 1,
            queue: QUEUE.map((q) => ({ ...q, audio_ref: wavDataUri() })),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/confidence-label")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as unknown;
        window.__corpusCalls!.push({ url, method, body, t: performance.now() });
        // Delayed on purpose: a save that resolves in the same tick gives the
        // spec no window to observe the "pending" state (the pulsing dot,
        // the "Saving…" nav-bar text) — only the state before and after.
        await new Promise((r) => setTimeout(r, 300));
        return new Response(JSON.stringify({ saved: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/v2/coach/training-imports")) {
        if (method === "POST") {
          const form = init?.body as FormData;
          const entries: Record<string, unknown> = {};
          if (form && typeof form.forEach === "function") {
            form.forEach((v, k) => {
              entries[k] = v instanceof File ? `FILE:${v.name}` : v;
            });
          }
          window.__corpusCalls!.push({
            url,
            method,
            body: entries,
            t: performance.now(),
          });
          // The FIRST file is slow on purpose: if the caller fired the batch
          // in parallel, the second file's call would land inside this delay
          // and the spec's gap assertion would fail.
          if (String(entries.audio_file ?? "").includes("first")) {
            await new Promise((r) => setTimeout(r, 350));
          }
          // The second file of a batch fails, so the spec can prove per-file
          // failure does not abort the run.
          // A file named "*empty*" reproduces the real case seen on 2026-07-29:
          // the BE reports ok with a real duration but zero pieces. It must
          // NOT render as a success — nothing entered the corpus.
          //
          // Sent WITH a language, the same file succeeds. That encodes the
          // leading theory from handoff §7 — a talk transcribed as the wrong
          // language yields nothing to cut — and makes the recovery path
          // (set the language, re-import the same file) executable rather
          // than described.
          if (
            String(entries.audio_file ?? "").includes("empty") &&
            !entries.language
          ) {
            return new Response(
              JSON.stringify({
                ok: false,
                reason: "NO_SPEECH_DETECTED",
                detail:
                  "the transcript was empty \u2014 if this audio is not in English, re-import it with a `language` code (e.g. pl)",
                session_id: "sess-empty",
                arc_id: "arc-empty",
                snippet_count: 0,
                queue_count: 0,
                duration_sec: 2480,
                language: null,
                filename: "empty-talk.mp3",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          // A file named "*dupe*" is one the BE has seen before: it answers
          // 200 with status "duplicate" and does no work. Must not read as a
          // fresh success, or a coach re-running a folder would believe
          // thirty files were just processed.
          if (String(entries.audio_file ?? "").includes("dupe")) {
            return new Response(
              JSON.stringify({
                ok: true,
                status: "duplicate",
                session_id: "sess-1",
                arc_id: "arc-1",
                queue_count: 15,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          // Everything else takes the ASYNC path: 202 with a session id, and
          // the result arrives by polling. Modelled here because the FE has to
          // survive it — a 202 read as a success would put a queue on screen
          // that does not exist yet.
          if (String(entries.audio_file ?? "").includes("async")) {
            asyncPolls = 0;
            return new Response(
              JSON.stringify({ session_id: "sess-async", status: "processing" }),
              { status: 202, headers: { "Content-Type": "application/json" } }
            );
          }
          const failing = String(entries.audio_file ?? "").includes("bad");
          if (failing) {
            return new Response(
              JSON.stringify({
                code: "AUDIO_REJECTED",
                reason: "too_short",
                error: "That clip is too short to analyse.",
              }),
              { status: 422, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              session_id: "sess-1",
              arc_id: "arc-1",
              snippet_count: 42,
              queue_count: 15,
              stages: ["confidence"],
              duration_sec: 612.4,
              speaker_label: "Jane Doe",
              filename: "talk.mp3",
              // Echoed back exactly as the BE does — what it RAN as, which is
              // null when it auto-detected.
              language: entries.language ?? null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        // GET /training-imports/<id> — the poll. Answers "processing" once,
        // then finishes, so the spec proves the FE waits rather than reading a
        // 202 as a result.
        if (/\/training-imports\/[^/?]+$/.test(url.split("?")[0])) {
          asyncPolls += 1;
          if (asyncPolls < 2) {
            return new Response(
              JSON.stringify({ session_id: "sess-async", status: "processing" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              status: "complete",
              session_id: "sess-async",
              arc_id: "arc-1",
              snippet_count: 42,
              queue_count: 15,
              duration_sec: 612.4,
              language: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            imports: [
              {
                session_id: "sess-1",
                arc_id: "arc-1",
                topic: "Board pitch",
                speaker_label: "Jane Doe",
                created_at: "2026-07-28T10:00:00Z",
                status: "complete",
                queue_count: 15,
              },
              // A finished batch whose every piece is already labelled — its
              // queue (sess-full above) is what proves the index badge.
              {
                session_id: "sess-full",
                arc_id: "arc-full",
                topic: "Old finished batch",
                speaker_label: "Jane Doe",
                created_at: "2026-07-27T10:00:00Z",
                status: "complete",
                queue_count: 2,
              },
              // A failed import stays in the list: it is the evidence for why
              // a file produced nothing, and it must not be openable.
              {
                session_id: "sess-empty",
                arc_id: "arc-empty",
                topic: "thank you talk at the conference",
                speaker_label: "Przemyslaw Paczek",
                created_at: "2026-07-29T10:00:00Z",
                status: "failed",
                queue_count: 0,
                analysis_error: "the transcript was empty",
              },
            ],
            count: 3,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return real(input, init);
    };
  }
  const session = {
    access_token: "dev-token",
    token_type: "bearer",
    expires_at: 4102444800,
    refresh_token: "dev-refresh",
    user: { id: "dev-user" },
  };
  document.cookie = `sb-dummy-auth-token=base64-${btoa(
    JSON.stringify(session)
  )}; path=/`;
}

export default function CorpusHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return <CorpusPageClient />;
}
