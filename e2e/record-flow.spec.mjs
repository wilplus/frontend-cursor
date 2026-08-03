/* -------------------------------------------------------------------------- */
/*  The record flow — the core of the app, end to end                          */
/*                                                                            */
/*  Picking from the project picker must GO somewhere:                         */
/*    "Start a new topic"   → the recording onboarding                         */
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
/*  RUN IT (a PRODUCTION build — dev will not reproduce the timing):           */
/*    1. npx next build && npx next start -p 3142                              */
/*    2. node e2e/record-flow.spec.mjs                                         */
/*  Exits non-zero on failure.                                                 */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3142";
const failures = [];
function expect(name, actual, needle) {
  const ok = actual.includes(needle);
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n      wanted "${needle}" in: ${actual}`));
}
const b = await launchChromium();
const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });

// Serve a fake trainings payload so the "existing project" path is reachable
// without a real session.
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

const body = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 140));
// Seed a Supabase session so getAuthToken() returns a token and the picker
// actually fetches its project list.
const seedCookie = async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = { access_token: "test-token", token_type: "bearer", expires_in: 3600,
    expires_at: exp, refresh_token: "r",
    user: { id: "u1", email: "t@t.co", aud: "authenticated", role: "authenticated" } };
  const val = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  await ctx.addCookies([
    { name: "sb-localhost-auth-token", value: val, domain: "localhost", path: "/" },
  ]);
};
const seedSession = async (p) => {
  await p.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const session = { access_token: "test-token", token_type: "bearer", expires_in: 3600,
      expires_at: exp, refresh_token: "r", user: { id: "u1", email: "t@t.co", aud: "authenticated", role: "authenticated" } };
    for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k);
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
    localStorage.setItem("willab.consent_accepted", "1");
  });
};
const consent = async (p) => {
  const a = p.getByRole("button", { name: /Accept & enter/i });
  if (await a.count()) { await a.click(); await p.waitForTimeout(1500); }
};

// --- PATH A: new topic → recording onboarding -----------------------------
{
  const p = await ctx.newPage();
  await p.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500); await consent(p);
  await p.getByRole("button", { name: /first recording/i }).first().click();
  await p.waitForTimeout(1800);
  console.log("A picker : " + (await body(p)));
  await p.getByRole("button", { name: /Start a new topic/i }).first().click();
  await p.waitForTimeout(2500);
  // A new topic lands on the setup form itself — the feelings check-in is
  // skipped here and kept on every continuation (founder 2026-07-27).
  expect("new topic → the setup form, no feelings check-in", await body(p), "What are you speaking on?");
  if ((await body(p)).includes("How are you feeling")) {
    failures.push("new topic still shows the feelings check-in");
    console.log("FAIL  the feelings check-in is still in the new-topic path");
  }
  await p.close();
}

// --- PATH B: existing project → the ideal text ----------------------------
{
  const p = await ctx.newPage();
  await seedCookie();
  await seedSession(p);
  await p.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2000); await consent(p);
  await p.getByRole("button", { name: /first recording|^Record$/i }).first().click();
  await p.waitForTimeout(2000);
  console.log("B picker : " + (await body(p)));
  const proj = p.getByRole("button", { name: /My Q3 pitch/i });
  if (await proj.count()) {
    await proj.first().click();
    await p.waitForTimeout(2500);
    expect("existing project → its ideal text", await body(p), "Your ideal text");
  } else { failures.push("existing project row not rendered"); console.log("FAIL  the project row never rendered"); }
  await p.close();
}
await b.close();

if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("\nall paths ok");
