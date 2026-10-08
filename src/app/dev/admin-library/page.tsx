"use client";

/* -------------------------------------------------------------------------- */
/*  Dev harness for the founder's Library and Speaking errors pages (coach    */
/*  panel lock CP3 A; build plan D-CP-21), for the X7 screenshot harness:      */
/*                                                                            */
/*    /dev/admin-library?screen=library | errors     the REAL panel screens,   */
/*    drawn over stubbed routes (the exercises, the catalogue, the speaking   */
/*    errors, the founder's ledger, the coach's profile); the manifest's      */
/*    `act` taps into one exercise or one error.                              */
/*                                                                            */
/*  DEV ONLY. Production renders nothing — this is a test fixture, not a       */
/*  surface, and the founder gate on the real pages is not here.              */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import LibraryClient from "@/app/admin/library/LibraryPanel";
import SpeakingErrorsClient from "@/app/admin/errors/SpeakingErrorsPanel";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ERRORS = [
  { error_id: "rushing", label: "Rushing", definition: "Too little silence between words for a listener to keep up.", asks: "Did this passage give the listener room to follow it?", status: "detected", detector_ref: "insufficient_pauses", observed_by: null, active: true },
  { error_id: "ending_compression", label: "Ending compression", definition: "The last words of a sentence are swallowed or hurried.", asks: "Did the speaker carry the end of the sentence?", status: "detected", detector_ref: "ending_compression", observed_by: null, active: true },
  { error_id: "hedging", label: "Hedging", definition: "Softening words that take the weight off a claim.", asks: "Did the claim keep its weight?", status: "shadow", detector_ref: "verbal_cues:hedging", observed_by: null, active: true },
  { error_id: "word_compression", label: "Word compression", definition: "Words run together so single words are lost.", asks: "Could every word be heard on its own?", status: "shadow", detector_ref: "verbal_cues:word_compression", observed_by: null, active: true },
  { error_id: "filler_words", label: "Filler words", definition: "“Um”, “like”, “you know” between ideas.", asks: "Did a filler word sit between the ideas?", status: "observed", detector_ref: null, observed_by: "coach-1", active: true },
];
const version = (status: string) => ({ version: 1, source: "coach", transcript_status: status, ai_draft_text: null, created_at: null });
const EXERCISES = [
  { exercise_id: "land-the-last-word", title: "Land the last word", instruction: "Slow down on the last three words of the sentence and let them land before you breathe. Say it twice: once fast, once slow, and keep the slow one.", introduction_copy: "", explanation_video_url: "https://example.invalid/land.mp4", acoustic_problem_tags: ["ending_compression"], matching_criteria: { primary_problem_tag: "ending_compression" }, active: true, version: 1, latest_version: version("done") },
  { exercise_id: "one-breath-to-the-end", title: "One breath to the end", instruction: "Take one full breath before the sentence and spend it all the way to the last word. No new breath in the middle.", introduction_copy: "", explanation_video_url: "https://example.invalid/breath.mp4", acoustic_problem_tags: ["rushing"], matching_criteria: { primary_problem_tag: "rushing" }, active: true, version: 1, latest_version: version("pending") },
  { exercise_id: "slow-finish", title: "Slow finish", instruction: "Say the sentence at your normal pace, then say only its last four words at half speed. Join them together on the third try.", introduction_copy: "", explanation_video_url: "https://example.invalid/slow.mp4", acoustic_problem_tags: ["ending_compression"], matching_criteria: { primary_problem_tag: "ending_compression" }, active: false, version: 1, latest_version: version("done") },
];
const LINES = [
  "You brought the ending down and let it sit.", "The last word landed; nobody had to guess where the sentence ended.", "You finished the thought before you took a breath.",
].map((text, i) => ({ id: `line-${i}`, lane: "praise", pattern_kind: "cue", pattern_key: "landed_ending", text, version: 1, active: true, signed_by: null }));
const PACE = [{ jar: "shadow_cues.hedging", current: 6, bar: 10, rate: null, observed_rate: null, weeks_to_bar: null, caught_rate: null, caught_bar: null, ready: false }];

function installStub(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/v2/user/profile")) return json({ is_coach: true, proficient_languages: ["en"] });
    if (url.includes("/api/v2/coach/exercises")) return json({ exercises: EXERCISES, speaking_errors: ERRORS });
    if (url.includes("/api/v2/coach/catalogue")) return json({ lines: LINES });
    if (url.includes("/api/v2/coach/speaking-errors")) return json({ errors: ERRORS });
    if (url.includes("/api/v2/admin/learning/ledger")) return json({ pace: PACE, weeks: [], ready_cues: [], migration_drafts: {}, exported: [], updated_at: null });
    return real(input, init);
  };
  const session = { access_token: "dev-token", token_type: "bearer", expires_at: 4102444800, refresh_token: "dev-refresh", user: { id: "dev-founder" } };
  document.cookie = `sb-dummy-auth-token=base64-${btoa(JSON.stringify(session))}; path=/`;
}

function Harness() {
  const [screen, setScreen] = useState<"library" | "errors" | null>(null);
  useEffect(() => {
    installStub();
    setScreen(new URLSearchParams(window.location.search).get("screen") === "errors" ? "errors" : "library");
  }, []);
  if (screen === "errors") return <SpeakingErrorsClient founder />;
  if (screen === "library") return <LibraryClient />;
  return null;
}

export default function AdminLibraryHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return <Harness />;
}
