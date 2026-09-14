/* -------------------------------------------------------------------------- */
/*  A stand-in backend for the BFF (audit Q-T7, Phase 2).                     */
/*                                                                            */
/*  `next start` is pointed at this with NEXT_PUBLIC_API_URL so the BFF's      */
/*  callBackend() has something to forward to. It logs every request it sees  */
/*  (FIXTURE_LOG=path) and answers from a small fixture table; anything        */
/*  unknown gets an empty 200 JSON body so a page never hangs on a missing     */
/*  backend. Nothing here resembles production data.                          */
/*                                                                            */
/*    node e2e/_fixture-backend.mjs            # listens on FIXTURE_PORT (3999) */
/* -------------------------------------------------------------------------- */
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const PORT = Number(process.env.FIXTURE_PORT || 3999);
const LOG = process.env.FIXTURE_LOG || "";

const trainings = {
  trainings: [
    { arc_id: "arc-1", topic: "My Q3 pitch", take_count: 2,
      takes: [{ session_id: "s1", take_index: 1 }, { session_id: "s2", take_index: 2 }] },
  ],
};
const idealText = { variant: "single", status: "unverified", version: 2,
  text: "This is my ideal text.", key_moments: [], key_phrases: [] };

/** path prefix → body (first match wins). */
const FIXTURES = [
  ["/v2/user/trainings", trainings],
  ["/v2/explore/arc/", idealText],
  ["/v2/user/profile", { profile: { id: "u1", email: "t@t.co" } }],
  ["/v2/user/lounge/messages", { messages: [] }],
  ["/v2/config/recording", { min_seconds: 30, max_seconds: 3600 }],
  ["/health", { ok: true }],
];

createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (LOG) appendFileSync(LOG, `${req.method} ${path}\n`);
  const hit = FIXTURES.find(([prefix]) => path.startsWith(prefix));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(hit ? hit[1] : {}));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`fixture backend on http://127.0.0.1:${PORT}`);
});
