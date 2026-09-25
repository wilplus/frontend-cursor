/* -------------------------------------------------------------------------- */
/*  The record flow — the core of the app, end to end                          */
/*                                                                            */
/*  Picking from the project picker must GO somewhere:                         */
/*    "Start a new project" → the feelings check-in, then the setup form       */
/*    an existing project   → that project, i.e. its ideal text                */
/*                                                                            */
/*  This exists because both paths silently died. The picker unmounting as the */
/*  next overlay mounted is one React commit, and useBackDismiss's cleanup     */
/*  fired history.back() to balance its own entry while the stack looked empty */
/*  — the popstate landed on the INCOMING overlay and closed it. The user saw  */
/*  "I picked a project and nothing happened". No test could see it: it needs  */
/*  a real history stack and a real production build (dev adds a second        */
/*  StrictMode remount that changes the timing).                               */
/*                                                                            */
/*  WHAT IT NEEDS (Phase 2, audit Q-T7). A PRODUCTION build and NO backend:    */
/*  every API the flow reads is answered at the browser (ctx.route) or by      */
/*  e2e/_fixture-backend.mjs behind the BFF. The auth seed uses the Supabase   */
/*  project ref of the build's NEXT_PUBLIC_SUPABASE_URL — "dummy" in CI, the   */
/*  same harness contract as star-verdicts (e2e/README.md); override with      */
/*  SUPABASE_REF for a local build.                                            */
/*                                                                            */
/*  RUN IT:                                                                    */
/*    node e2e/_fixture-backend.mjs &                                          */
/*    NEXT_PUBLIC_API_URL=http://127.0.0.1:3999 npx next build && npx next start -p 3142 */
/*    node e2e/record-flow.spec.mjs                                            */
/*  Exits non-zero on failure.                                                 */
/*                                                                            */
/*  HISTORY OF PATH A. The 2026-07-27 rule ("a new topic goes straight to the  */
/*  setup form, no feelings check-in") was superseded on 2026-08-18 by         */
/*  54fd99ec ("ship the rehearsal feedback journey"): a brand-new project gets */
/*  the check-in exactly once, before Take 1; later takes skip it. This spec   */
/*  pins the 08-18 wire. If that is not the intended flow, this is the test    */
/*  that says so.                                                              */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3142";
const REF = process.env.SUPABASE_REF || "dummy";
const failures = [];
function expect(name, actual, needle) {
  const ok = actual.includes(needle);
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n      wanted "${needle}" in: ${actual}`));
}
function expectNot(name, actual, needle) {
  const ok = !actual.includes(needle);
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n      did not want "${needle}" in: ${actual}`));
}

const b = await launchChromium();
const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });

// Answer the two reads the flow makes, at the browser, so no backend is needed.
await ctx.route("**/api/v2/user/trainings", (r) =>
  r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ trainings: [{ arc_id: "arc-1", topic: "My Q3 pitch", take_count: 2,
      takes: [{ session_id: "s1", take_index: 1 }, { session_id: "s2", take_index: 2 }] }] }) })
);
await ctx.route("**/api/v2/explore/arc/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ variant: "single", status: "unverified", version: 2,
      text: "This is my ideal text.", key_moments: [], key_phrases: [] }) })
);

// A signed-in session, so getAuthToken() returns a token and the picker fetches
// its project list. The cookie is what the BFF reads; localStorage is what the
// browser client reads. Both keyed on the build's Supabase project ref.
const session = {
  access_token: "test-token", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
  user: { id: "u1", email: "t@t.co", aud: "authenticated", role: "authenticated" },
};
await ctx.addCookies([{
  name: `sb-${REF}-auth-token`,
  value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64"),
  domain: "localhost", path: "/",
}]);
const seed = async (p) => {
  await p.addInitScript(([ref, s]) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k);
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s));
    localStorage.setItem("willab.consent_accepted", "1");
  }, [REF, session]);
};
const body = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400));
const click = async (p, name) => {
  const el = p.getByRole("button", { name }).first();
  if (!(await el.count())) { failures.push(`button ${name} not found`); console.log(`FAIL  button ${name} never rendered`); return false; }
  await el.click();
  await p.waitForTimeout(2000);
  return true;
};
const openPicker = async (p) => {
  await p.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await click(p, /Start your first recording|^Record$/i);
  console.log("picker : " + (await body(p)));
  expect("the picker offers a new project", await body(p), "Start a new project");
};

// --- PATH A: new topic → feelings check-in → the setup form ---------------
{
  const p = await ctx.newPage();
  await seed(p);
  await openPicker(p);
  if (await click(p, /Start a new project/i)) {
    expect("new topic → the feelings check-in (once, before Take 1)", await body(p), "How do you feel");
    if (await click(p, /^Calm$/i)) {
      expect("feelings → the setup form", await body(p), "What is the topic?");
      expectNot("the check-in is not asked twice", await body(p), "How do you feel");
    }
  }
  await p.close();
}

// --- PATH B: existing project → its ideal text ----------------------------
{
  const p = await ctx.newPage();
  await seed(p);
  await openPicker(p);
  expect("the picker lists the existing project", await body(p), "My Q3 pitch");
  if (await click(p, /My Q3 pitch/i)) {
    const text = await body(p);
    expect("existing project → its ideal text", text, "Your ideal text");
    expect("the served text is the one on screen", text, "This is my ideal text.");
    expect("the loop continues: the next take is offered", text, "Record the next take");
    expectNot("no feelings check-in on a continuation", text, "How do you feel");
  }
  await p.close();
}
await b.close();

if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("\nall paths ok");
