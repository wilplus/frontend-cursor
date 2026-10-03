/* -------------------------------------------------------------------------- */
/*  A first-time guest reaches the Terms (F1 Repair Plan Phase 0.5)            */
/*                                                                            */
/*  Under PLF1 enforce, a visitor with no account and no stored guest token    */
/*  got "A verified owner is required." on the acceptance read and on project  */
/*  creation. The acceptance gate fails open on an unreadable status, so the   */
/*  visitor never saw the Terms, reached the Lab, and could not record: a      */
/*  closed loop from 2026-09-21 until 2026-10-03, found by the founder         */
/*  recording as a new user. Nothing in the frontend ever called the mint      */
/*  route the backend offers for exactly this case.                            */
/*                                                                            */
/*  The stub below answers the acceptance read the way the enforcing backend   */
/*  does: 401 OWNER_REQUIRED without a guest token, the policy with one. So    */
/*  the page shows the Terms only if the client minted an identity first.      */
/*                                                                            */
/*  RUN IT (same harness as record-flow):                                      */
/*    node e2e/_fixture-backend.mjs &                                          */
/*    NEXT_PUBLIC_API_URL=http://127.0.0.1:3999 npx next build && npx next start -p 3142 */
/*    node e2e/guest-first-visit.spec.mjs                                      */
/*  Exits non-zero on failure.                                                 */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3142";
const failures = [];
function check(name, ok, detail = "") {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n      ${detail}`));
}

const GUEST_TOKEN = "3f1c2a54-9b7e-4c1d-8a2f-6e5d4c3b2a10." + "s".repeat(43);
const POLICY = {
  authorized: false,
  code: "PROCESSING_AUTHORIZATION_REQUIRED",
  policy_available: true,
  policy_id: "policy-uuid",
  policy_version: "phase1-2026.1",
  terms_version: "3.3",
  terms_copy: "These are the Terms a first-time guest must see.",
  terms_copy_sha256: "a".repeat(64),
  privacy_version: "3.3",
  privacy_copy: "Privacy text",
  privacy_copy_sha256: "b".repeat(64),
  ai_notice_version: "1.0",
  ai_notice_copy: "AI notice text",
  ai_notice_copy_sha256: "c".repeat(64),
  agreement_copy: "I agree and continue",
  agreement_copy_sha256: "d".repeat(64),
  minimum_age: 18,
  allowed_countries: ["pl"],
  ai_notice_rendered: false,
};

const b = await launchChromium();
const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
let mints = 0;
let readsWithToken = 0;
let readsWithout = 0;

await ctx.route("**/api/v2/processing-authorization/principal", (r) => {
  mints += 1;
  return r.fulfill({ status: 201, contentType: "application/json",
    body: JSON.stringify({ owner_principal_id: "3f1c2a54-9b7e-4c1d-8a2f-6e5d4c3b2a10",
      is_guest: true, guest_owner_token: GUEST_TOKEN }) });
});
await ctx.route("**/api/v2/processing-authorization", (r) => {
  if (r.request().method() !== "GET") return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  const token = r.request().headers()["x-willab-guest-owner"];
  if (token === GUEST_TOKEN) {
    readsWithToken += 1;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(POLICY) });
  }
  readsWithout += 1;
  return r.fulfill({ status: 401, contentType: "application/json",
    body: JSON.stringify({ code: "INVALID_GUEST_OWNER", error: "A verified owner is required." }) });
});

const p = await ctx.newPage();
// A brand-new visitor: no session, no stored guest identity.
await p.addInitScript(() => {
  for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
});
await p.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
// A visitor with no account sees the landing first and enters as a guest.
const enter = p.getByRole("link", { name: /Enter the lab/i }).or(p.getByRole("button", { name: /Enter the lab/i })).first();
if (await enter.count()) {
  await enter.click();
  await p.waitForLoadState("networkidle");
}
await p.waitForTimeout(2500);
const text = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const stored = await p.evaluate(() => localStorage.getItem("willab_guest_owner:v1"));

check("the guest identity was minted exactly once", mints === 1, `mints=${mints}`);
check("the identity is kept for the next screens", stored === GUEST_TOKEN, `stored=${stored}`);
check("the acceptance read carried it", readsWithToken >= 1 && readsWithout === 0,
  `with=${readsWithToken} without=${readsWithout}`);
check("the first-time guest sees the agreement, not the Lab",
  text.includes("I agree and continue"), text.slice(0, 400));
check("no 'verified owner' refusal on screen",
  !text.includes("A verified owner is required"), text.slice(0, 400));

await b.close();
if (failures.length) {
  console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("\nfirst visit ok");
