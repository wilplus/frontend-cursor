"use client";

import SpeakingErrorLibraryClient from "@/app/coach/errors/page.client";

/* -------------------------------------------------------------------------- */
/*  A harness for the speaking error library, driven in a REAL browser.        */
/*                                                                            */
/*  The real screen needs a coach JWT and a live BE. What needs an engine here */
/*  is the one distinction the whole surface is built around: that a `detected`*/
/*  entry is visibly locked and a coach cannot edit it, because saving over one*/
/*  would demote it to `observed` and silently stop it routing exercises —     */
/*  no exception, no log, nothing to notice.                                   */
/*                                                                            */
/*  Stubs the library endpoint at the fetch boundary and records every write   */
/*  on window.__libraryCalls. Forces the coach profile so the N4 gate opens.   */
/*  The stub REFUSES an already-detected id the way the service does, so the   */
/*  refusal an author actually reads is exercised rather than assumed.         */
/*                                                                            */
/*  DEV ONLY. Production renders nothing and patches nothing.                  */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    __libraryCalls?: { url: string; method: string; body: unknown }[];
  }
}

const ROWS = [
  {
    error_id: "rushing",
    label: "Rushing",
    definition:
      "The passage leaves too little silence between its words for a listener to keep up. Measured on the aligned word timings as pauses occupying under 8% of the clip (pause_ratio < 0.08), or pause regularity under 0.5.",
    asks: "Did this passage give the listener room to follow it?",
    status: "detected",
    detector_ref: "insufficient_pauses,irregular_rushed_pacing",
    active: true,
  },
  {
    error_id: "word_compression",
    label: "Word compression",
    definition:
      "Individual words are given less time and separation than a listener needs to resolve them. Measured as a median inter-word gap under 0.07s with at least half the gaps that tight.",
    asks: "Were the words given enough time to be heard as separate words?",
    status: "detected",
    detector_ref:
      "reduced_word_separation,dense_articulation,reduced_intelligibility",
    active: true,
  },
  {
    error_id: "ending_compression",
    label: "Ending compression",
    definition:
      "The end of the passage is given materially less time per word than the passage as a whole (ending_duration_ratio < 0.78).",
    asks: "Did the speaker shorten the end of this passage?",
    status: "detected",
    detector_ref: "compressed_ending",
    active: true,
  },
  {
    error_id: "trailing_mumble",
    label: "Trailing mumble",
    definition:
      "The last words of a sentence lose volume and articulation while the pace stays even — distinct from ending compression, which is about time rather than clarity.",
    asks: "Did the speaker carry the end of the sentence?",
    status: "observed",
    observed_by: "coach-1",
    active: true,
  },
];

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  if (!window.__libraryCalls) {
    window.__libraryCalls = [];
    const real = window.fetch.bind(window);
    const added: Record<string, unknown>[] = [];
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

      if (url.includes("/api/v2/coach/speaking-errors")) {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        window.__libraryCalls?.push({ url, method, body });
        if (method === "POST") {
          const id = String((body as Record<string, unknown>)?.error_id ?? "");
          // The service's 409: an already-detected entry cannot be saved from
          // an authoring surface, because the write is an upsert and would
          // carry status=observed over it.
          if (ROWS.some((r) => r.error_id === id && r.status === "detected")) {
            return new Response(
              JSON.stringify({
                code: "ALREADY_DETECTED",
                error:
                  "this error is already detected in code; saving it here would demote it to observed and silently stop it routing exercises",
              }),
              { status: 409, headers: { "Content-Type": "application/json" } },
            );
          }
          const saved = { ...(body as object), status: "observed", active: true };
          added.push(saved as Record<string, unknown>);
          return new Response(JSON.stringify({ error: saved }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ errors: [...ROWS, ...added] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return real(input, init);
    };
  }
  // useUserProfile only fetches when useSignedIn() is true, so the N4 gate
  // never opens without a session — the same stub the corpus harness uses.
  const session = {
    access_token: "dev-token",
    token_type: "bearer",
    expires_at: 4102444800,
    refresh_token: "dev-refresh",
    user: { id: "dev-user" },
  };
  document.cookie = `sb-dummy-auth-token=base64-${btoa(
    JSON.stringify(session),
  )}; path=/`;
}

export default function SpeakingErrorLibraryHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return <SpeakingErrorLibraryClient />;
}
