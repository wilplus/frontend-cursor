"use client";

import GamePageClient from "@/app/game/page.client";

/* -------------------------------------------------------------------------- */
/*  A harness for the key-moments game, driven in a REAL browser.              */
/*                                                                            */
/*  The real page needs the arc owner's JWT and a live Engine 5. What needs a  */
/*  real engine is the interaction contract: that rounds carry NO is-key tell  */
/*  (N1), that exactly one POST leaves per decision (N3 — every answer is a    */
/*  peer label), that the reveal tints **kw** spans instead of bolding (N4),   */
/*  and that a decoy reveal reads neutral (N5). Stubs the four game endpoints  */
/*  at the fetch boundary; every answer POST is recorded on window.__gamePosts.*/
/*                                                                            */
/*  DEV ONLY. Production renders nothing and patches nothing.                  */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    __gamePosts?: { url: string; body: unknown }[];
  }
}

// ~0.25s of decodable 8kHz mono silence, so the playback hero really plays.
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

const ROUNDS = [
  {
    round: 0,
    round_id: "snip-key",
    snippet_id: "snip-key",
    transcript: "and that quarter we tripled revenue with half the team",
    get audio_ref() { return wavDataUri(); },
    start_offset_ms: 0,
    duration_ms: 250,
  },
  {
    round: 1,
    round_id: "snip-decoy",
    snippet_id: "snip-decoy",
    transcript: "so we moved the launch to the second week of March",
    get audio_ref() { return wavDataUri(); },
    start_offset_ms: 0,
    duration_ms: 250,
  },
];

const VERDICTS: Record<string, unknown> = {
  "snip-key": {
    correct: true,
    truth_is_key: true,
    why: [
      "The load-bearing words in this moment: **tripled** and **revenue**.",
      "A longer-than-usual pause tends to come right before your strongest moments.",
    ],
    keywords: ["tripled", "revenue"],
    video_ref: null,
  },
  "snip-decoy": {
    correct: false,
    truth_is_key: false,
    why: ["Comfortable pace, natural rise and fall."],
    keywords: [],
    video_ref: null,
  },
};

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  if (!window.__gamePosts) {
    window.__gamePosts = [];
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (/\/api\/v2\/arc\/[^/]+\/game\/answers/.test(url)) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          round_id?: string;
        };
        window.__gamePosts!.push({ url, body });
        return new Response(
          JSON.stringify(VERDICTS[body.round_id ?? ""] ?? { correct: false }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (/\/api\/v2\/arc\/[^/]+\/game\/save/.test(url)) {
        window.__gamePosts!.push({ url, body: null });
        return new Response(JSON.stringify({ saved: true, arc_id: "arc-demo" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (/\/api\/v2\/arc\/[^/]+\/game/.test(url)) {
        const empty = url.includes("arc%3Dempty") || url.includes("arc-empty");
        return new Response(
          JSON.stringify(
            empty
              ? { arc_id: "arc-empty", rounds: [], reason: "NO_KEY_MOMENTS_YET" }
              : { arc_id: "arc-demo", rounds: ROUNDS }
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (/\/api\/v2\/explore\/arc\/[^/]+\/breakthroughs/.test(url)) {
        return new Response(
          JSON.stringify({
            breakthroughs: [
              {
                id: "bt-1",
                text: "and that quarter we tripled revenue with half the team",
                // BOTH comments served: the coach's note must OVERRIDE.
                breakthrough_note:
                  "Your voice dropped and slowed here — the room leaned in.",
                comment: "SYSTEM COMMENT THAT MUST NOT RENDER",
                audio_ref: null,
                start_offset_ms: 0,
                duration_ms: 0,
              },
              {
                id: "bt-2",
                text: "we said no to the easy deal and it saved the company",
                // System comment only — renders as the fallback; plus video.
                comment: "Steady pace under a hard sentence.",
                video_ref: "https://example.test/breakthrough.mp4",
                audio_ref: null,
                start_offset_ms: 0,
                duration_ms: 0,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (/\/api\/v2\/user\/game-sessions/.test(url)) {
        return new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return real(input, init);
    };
  }
  // The service's auth header is cookie-session based; seed the same fake
  // session the star-verdict harness uses so getAuthToken resolves.
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

export default function GameHarness() {
  if (process.env.NODE_ENV === "production") return null;
  const arc =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("arc") ?? "arc-demo"
      : "arc-demo";
  return <GamePageClient initialArcId={arc} initialSnippetId={null} />;
}
