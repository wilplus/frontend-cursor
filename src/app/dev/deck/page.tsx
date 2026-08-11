"use client";

import IdealTextOverlay from "@/components/willab/IdealTextOverlay";

/* -------------------------------------------------------------------------- */
/*  A harness for the transcript review deck, driven in a REAL browser through */
/*  the REAL host (IdealTextOverlay) — the wiring is the thing under test:     */
/*  chunk states derive from served parts + changes, the REVIEW modal's        */
/*  decisions land on the suggestion-feedback POST, and the lock lands on the  */
/*  parts lock PUT (or the user-edit PUT when the draft changed).              */
/*                                                                            */
/*  Serves FOUR chunk states at once: clean (p0), waiting (p1, a pending      */
/*  polish replace), locked (p2, stored part lock), accepted (p3, an approved  */
/*  bold). Every write is recorded on window.__deckCalls.                      */
/*                                                                            */
/*  ?noparts=1 — THE DOCUMENT THAT HAS NO STORED IDENTITY: `parts: null`, the  */
/*  shape the BE serves for every document nobody has ever manually edited.    */
/*  It is the shape a real arc has on its first read, and the reason this      */
/*  harness let a broken lock ship: with parts served, the deck and the host   */
/*  read the SAME ids and a lock addressed by id worked; with none, both mint  */
/*  their own uuids, no id matches, and every lock died in the browser. The    */
/*  lock is addressed by position + words now, so it must fire here too.       */
/*                                                                            */
/*  DEV ONLY. Production renders nothing and patches nothing.                  */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    __deckCalls?: { url: string; method: string; body: unknown; t: number }[];
  }
}

const P0 = "We started this in a garage with nothing but a borrowed mic.";
const P1 = "Nobody believed the numbers we were seeing back then.";
const P2 = "So we moved the launch and it changed everything for us.";
const P3 = "And that is when the whole plan finally came together.";

const TEXT_BEFORE = [P0, P1, P2, P3].join("\n\n");
// After the accept, the proposal's words are the document's words.
const P1_AFTER = P1.replace("believed the numbers", "trusted the figures");
const TEXT_AFTER = [P0, P1_AFTER, P2, P3].join("\n\n");

/** The harness's one bit of server state: has the pending change been
 *  decided, and which way. Drives the refetched payload exactly the way the
 *  BE's reassembly + decisions ledger would. */
let decided: "pending" | "approved" | "dismissed" = "pending";
let locked1 = false; // p1's part lock, settable via the lock PUT
let styleApplied = false; // the locked chunk's style proposal (slice 2)

/** ?noparts=1 — serve the document WITHOUT its parts list (see the header). */
const noParts =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("noparts") === "1";

function payload() {
  const text = decided === "approved" ? TEXT_AFTER : TEXT_BEFORE;
  const p1 = decided === "approved" ? P1_AFTER : P1;
  const paras = [P0, p1, P2, P3];
  const quote = "believed the numbers";
  const changes: Record<string, unknown>[] = [];
  if (decided !== "approved") {
    changes.push({
      id: "chg-replace-1",
      snippet_id: "snip-1",
      take_session_id: "sess-1",
      kind: "replace",
      source: "polish",
      span: { start: text.indexOf(quote), end: text.indexOf(quote) + quote.length },
      quote,
      why_key: "clarity",
      proposed_text: "trusted the figures",
      status: decided === "dismissed" ? "dismissed" : "pending",
      visual: "underline",
    });
  }
  const bq = "finally came together";
  changes.push({
    // An already-approved accent: paints p3 accepted (wash, no underline).
    id: "chg-bold-1",
    snippet_id: "snip-2",
    take_session_id: "sess-1",
    kind: "bold",
    source: "polish",
    span: { start: text.indexOf(bq), end: text.indexOf(bq) + bq.length },
    quote: bq,
    why_key: "emphasis",
    status: "approved",
    visual: "bold",
  });
  // SLICE 2 — the post-lock style lane: a bold on the LOCKED chunk (p2),
  // served beside the budgeted list. Gone once applied.
  const sq = "changed everything";
  const style_changes = styleApplied
    ? []
    : [{
        id: "style-1",
        snippet_id: "snip-3",
        take_session_id: "sess-1",
        kind: "bold",
        source: "polish",
        span: { start: text.indexOf(sq), end: text.indexOf(sq) + sq.length },
        quote: sq,
        why_key: "emphasis",
        status: "pending",
        visual: "bold",
        style_lane: true,
      }];
  return {
    arc_id: "arc-deck",
    status: "verified",
    version: 3,
    title: "Garage pitch",
    updated_at: "2026-08-11T10:00:00Z",
    latest_take_session_id: "sess-1",
    take_count: 2,
    can_record_take: true,
    text,
    moments_unlocked: false,
    explanations_available: false,
    key_moments: [
      {
        id: "snip-coach",
        snippet_id: "snip-coach",
        anchor: P2,
        take_session_id: "sess-1",
        has_explanation: true,
      },
    ],
    user_edited: false,
    is_saved: false,
    // No stored identity → null, exactly as the BE serves it. Locks live in
    // the parts list, so this document has none: nothing is locked yet.
    parts: noParts
      ? null
      : paras.map((t, i) => ({
          id: `part-${i}`,
          ord: i,
          text: t,
          locked: i === 2 || (i === 1 && locked1),
          // SLICE 2 — the maturity counter: p2 has survived two lock-ins.
          iteration: i === 2 ? 2 : i === 1 && locked1 ? 1 : 0,
        })),
    pieces: paras.map((t, i) => ({
      piece_key: i,
      text: t,
      slide_index: i < 2 ? 0 : 1,
      take_index: 1,
      snippet_id: `snip-p${i}`,
      take_session_id: "sess-1",
      status: "settled",
      challenger: null,
    })),
    additions: [],
    changes,
    style_changes,
    // SLICE 2 — the decided-proposal history: one earlier round on p0's
    // words, kept readable with its texts.
    decision_history: [
      {
        change_key: "prior_take:garage",
        decision: "disregarded",
        lane: "lane:prior_take",
        intervention_type: "REWRITE",
        quote: "started this in a garage",
        proposed_text:
          "We began this in a garage with one borrowed mic.",
        why_key: "energy",
      },
    ],
  };
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  if (!window.__deckCalls) {
    window.__deckCalls = [];
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });

      if (url.includes("/ideal-text") && method === "GET") {
        return json(payload());
      }
      if (url.includes("/suggestion-feedback") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          action?: string;
          style_lane?: boolean;
        };
        window.__deckCalls!.push({ url, method, body, t: performance.now() });
        if (body.style_lane) styleApplied = true;
        else decided = body.action === "applied" ? "approved" : "dismissed";
        return json({ saved: true });
      }
      if (/\/parts\/[^/]+\/lock/.test(url) && method === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        window.__deckCalls!.push({ url, method, body, t: performance.now() });
        if (url.includes("part-1")) locked1 = true;
        return json({ locked: true, part_id: "stub" });
      }
      if (url.includes("/user-edit") && method === "PUT") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        window.__deckCalls!.push({ url, method, body, t: performance.now() });
        return json({ ok: true, version: 4 });
      }
      if (url.includes("/feedback") && method === "GET") {
        window.__deckCalls!.push({ url, method, body: null, t: performance.now() });
        return json({
          arc_id: "arc-deck",
          ideal_ready: true,
          takes: [
            {
              take_index: 1,
              session_id: "sess-1",
              free: true,
              locked: false,
              full_text: TEXT_BEFORE,
              key_moments: [
                {
                  snippet_id: "snip-coach",
                  slide_index: 1,
                  recording_kind: "spoken",
                  transcript: P2,
                  audio_ref: null,
                  start_offset_ms: 0,
                  duration_ms: 1000,
                  comment_text: "This is the turn — say it slower.",
                  comment_video_ref: "https://signed.example/coach.webm",
                },
              ],
            },
          ],
        });
      }
      if (url.startsWith("/api/")) {
        // Variants, revisions, deck ref, moments — all OFF in this harness.
        return json({}, 404);
      }
      return real(input, init);
    };
  }
}

export default function DeckHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <IdealTextOverlay
      arcId="arc-deck"
      onClose={() => {
        // The harness has nowhere to go back to.
      }}
    />
  );
}
