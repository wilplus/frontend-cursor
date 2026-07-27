"use client";

import CoachStarVerdictOverlay from "@/components/willab/CoachStarVerdictOverlay";

/* -------------------------------------------------------------------------- */
/*  A harness for CoachStarVerdictOverlay, driven in a REAL browser.           */
/*                                                                            */
/*  The real surface sits behind coach auth AND a live backend — unreachable   */
/*  in a container with neither. What needs a real engine is the interaction   */
/*  contract, not the proxy: that "Wrong kind" never saves without a pick      */
/*  (N3), that the pick IS the save, that a saved verdict re-edits (N5), that  */
/*  the migration-gate 500 shows its message verbatim. So this page seeds a    */
/*  fake Supabase session cookie (the client reads cookies, not localStorage   */
/*  — @supabase/ssr) and stubs ONLY the two star endpoints at the fetch        */
/*  boundary, recording every PUT body on window.__starPuts for the spec.      */
/*                                                                            */
/*  DEV ONLY. Production renders nothing and patches nothing — this is a test  */
/*  fixture, not a surface, and it must not become one. The separation test    */
/*  exempts app/dev fixtures from the import fence ONLY while this gate        */
/*  holds, and asserts it.                                                     */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    __starPuts?: { url: string; body: unknown }[];
  }
}

// ~0.25s of 8kHz mono silence — a real, decodable WAV so MediaPlayer is
// genuinely playable in the harness, not just present.
const WAV =
  "data:audio/wav;base64," +
  btoaSafe();
function btoaSafe(): string {
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
  return btoa(bin);
}

const ROWS = [
  {
    snippet_id: "snip-pace",
    star_kind: "delivery",
    star_device: "pace_fast",
    trigger: "pace_fast",
    get audio_ref() { return WAV; },
    start_offset_ms: 0,
    duration_ms: 250,
    transcript: "and we shipped it in a week which nobody believed",
    take_index: 2,
    why: "You moved faster here than you usually do.",
    replacement_text: null,
    verdict: null,
    corrected_device: null,
    note: null,
    judged: false,
    device_options: ["emphasis", "pace_fast", "pace_slow", "pause", "congruence"],
  },
  {
    snippet_id: "snip-replace",
    star_kind: "replace",
    star_device: null,
    trigger: "profanity",
    get audio_ref() { return WAV; },
    start_offset_ms: 0,
    duration_ms: 250,
    transcript: "and that damn demo finally worked",
    take_index: 3,
    why: "This word lands harder than you mean it to.",
    replacement_text: "and that honestly floored me",
    verdict: null,
    corrected_device: null,
    note: null,
    judged: false,
    device_options: [],
  },
  {
    snippet_id: "snip-500",
    star_kind: "structure",
    star_device: null,
    trigger: "contrast",
    why: "Not the slow build you think — the sharp turn you don't see coming.",
    replacement_text: null,
    verdict: null,
    corrected_device: null,
    note: null,
    judged: false,
    device_options: ["contrast", "list_of_three"],
  },
  {
    snippet_id: "snip-pause",
    star_kind: "delivery",
    star_device: "pause",
    trigger: "pause",
    why: "A beat of silence here would let that land.",
    replacement_text: null,
    verdict: "keep",
    corrected_device: null,
    note: null,
    judged: true,
    device_options: ["emphasis", "pace_fast", "pace_slow", "pause", "congruence"],
  },
];

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // A fake session where the supabase client actually looks for one: the
  // auth cookie (base64-JSON). getAuthToken() then yields "dev-token".
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

  if (!window.__starPuts) {
    window.__starPuts = [];
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const stars = url.match(/\/api\/v2\/coach\/arc\/([^/]+)\/stars/);
      if (stars) {
        const empty = decodeURIComponent(stars[1]) === "empty";
        return new Response(
          JSON.stringify({
            arc_id: stars[1],
            total: empty ? 0 : ROWS.length,
            judged: empty ? 0 : 1,
            stars: empty ? [] : ROWS,
            // Internal bookkeeping the surface must NEVER render — present in
            // the stub so a leak would be visible to the spec.
            summary: {
              total: 1,
              confusions: { "pace_fast->pace_slow": 1 },
              false_negatives_captured: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      const put = url.match(/\/api\/v2\/coach\/snippets\/([^/]+)\/star-verdict/);
      if (put) {
        const body = JSON.parse(String(init?.body ?? "{}")) as unknown;
        window.__starPuts!.push({ url, body });
        if (decodeURIComponent(put[1]) === "snip-500") {
          return new Response(
            JSON.stringify({
              code: "SERVER_ERROR",
              error:
                "star_verdicts table missing (run migrations/add_star_verdicts.sql)",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ saved: true, snippet_id: put[1] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return real(input, init);
    };
  }
}

export default function StarVerdictHarness() {
  if (process.env.NODE_ENV === "production") return null;
  const arc =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("arc") ?? "arc-demo"
      : "arc-demo";
  return <CoachStarVerdictOverlay arcId={arc} onClose={() => {}} />;
}
