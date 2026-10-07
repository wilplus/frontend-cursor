/* -------------------------------------------------------------------------- */
/*  THE SCREEN MANIFEST (build plan X7): every locked screen the harness       */
/*  draws, by area. capture.mjs reads this; nothing else does.                 */
/*                                                                            */
/*  HOW AN AREA ADDS A SCREEN — one entry in SCREENS:                          */
/*                                                                            */
/*    {                                                                       */
/*      area: "walk",                 ideal-text | walk | coach-panel |        */
/*                                    recording | consent (the output folder) */
/*      name: "praise",               the file name: <area>/<name>.<viewport>.png */
/*      audience: "speaker",          speaker | coach → the AC-9 number scan   */
/*                                    runs; admin → it does not               */
/*      path: "/dev/feedback-walk?screen=praise",   relative to BASE_URL      */
/*      waitFor: "[data-walk-player]",  the screen's key element; the shot    */
/*                                    waits for it (a selector, or "text=…")  */
/*      settleMs: 400,                optional: let arrive-motion finish       */
/*      viewports: { phone: {…} },    optional: an area's own frame for a      */
/*                                    viewport (the coach panel's prototype   */
/*                                    phone is 402 x 860)                     */
/*      reference: "docs/design/refs/walk/praise.png",                        */
/*                                    optional: the locked prototype's frame; */
/*                                    a string for both viewports, or         */
/*                                    { phone: "…", desktop: "…" }; when the  */
/*                                    file exists a side-by-side image is     */
/*                                    written next to the shot                */
/*      allow: [/\b18 years\b/],      optional: extra number forms this one   */
/*                                    screen legitimately shows (name each    */
/*                                    one in the PR); a percentage never      */
/*                                    passes                                  */
/*      prepare: async (context, page) => {},  optional: browser-side stubs   */
/*                                    (context.route), storage, cookies —     */
/*                                    runs before the navigation              */
/*      act: async (page) => {},      optional: clicks that reach the screen, */
/*                                    after the navigation and before waitFor */
/*    }                                                                       */
/*                                                                            */
/*  A screen must be reachable with fixtures: the /dev/* harness pages stub    */
/*  their own network, the real surfaces read e2e/_fixture-backend.mjs through */
/*  the BFF, and an entry's `prepare` can answer a route in the browser. The  */
/*  area that owns a screen owns its entry; the names below are the ones its  */
/*  lock uses.                                                                */
/* -------------------------------------------------------------------------- */

export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

export const AREAS = ["ideal-text", "walk", "coach-panel", "recording", "consent"];

/* ------------------------------ ideal-text ---------------------------------- */
/** The stand-in deck's slide notes ("back it with ~3 points"): the speaker's
 *  own slides, shown as they are (src/lib/willab/defaultDeck.ts). */
const DECK_ALLOW = [/~3 points/];
const IDEAL_TEXT = [
  // The Ideal Text page over the deck harness: four paragraphs, one Confident
  // Voice judgement waiting (the orange bar).
  { area: "ideal-text", name: "page", audience: "speaker",
    path: "/dev/deck?tier=confident", waitFor: "text=Garage pitch", allow: DECK_ALLOW },
  // The same page when the library holds a matched exercise (build plan P1-7).
  { area: "ideal-text", name: "page-library", audience: "speaker",
    path: "/dev/deck?tier=confident&library=full", waitFor: "text=Garage pitch", allow: DECK_ALLOW },
];

/* --------------------------------- walk ------------------------------------- */
/** The Feedback walk's still screens, as /dev/feedback-walk draws them (the
 *  names and key elements are e2e/feedback-walk.spec.mjs's). */
const WALK_KEYS = {
  coachnote: "[data-coach-video]",
  praise: "[data-walk-player]",
  clearer: "[data-walk-new-words] em",
  exVideo: "[data-coach-video]",
  practise: "[data-walk-recording-strip]",
  processing: "[data-walk-loading]",
  improved: "[data-walk-message]",
  encourage: "[data-walk-message]",
  helpers: "[data-walk-word-picker]",
  intro: "[data-walk-pill]",
  judge: "[data-walk-judgement]",
  community: "[data-walk-options]",
  end: "[data-walk-endsheet]",
};
/** The fixture project's title, "Q3 Board pitch": the speaker's own words,
 *  which the product shows as they are (a number in them is not a score). */
const WALK_ALLOW = [/\bQ3\b/];
const WALK = Object.entries(WALK_KEYS).map(([name, waitFor]) => ({
  area: "walk", name, audience: "speaker",
  path: `/dev/feedback-walk?screen=${name}`, waitFor, settleMs: 400, allow: WALK_ALLOW,
}));

/* ------------------------------ coach-panel --------------------------------- */
/** The coach panel's P1 still screens, as /dev/coach-panel draws them (the
 *  names and key elements are e2e/coach-panel.spec.mjs's). */
const LIVE = "[data-walk-stage] .walk-layer:not(.walk-ghost)";
const PANEL_KEYS = {
  door: '[data-testid="coach-panel-pinned"]',
  queue: `${LIVE} [data-testid="coach-panel-queue"]`,
  speakers: `${LIVE} [data-testid="coach-panel-all-speakers"]`,
  speaker: `${LIVE} [data-walk-caption]`,
  judge: `${LIVE} [data-testid="coach-panel-judge"]`,
  reveal: `${LIVE} [data-testid="coach-panel-passage"]`,
  corpushome: `${LIVE} [data-testid="coach-panel-corpushome"] [data-walk-choice]`,
  corpusimport: `${LIVE} [data-testid="coach-panel-corpusimport"]`,
  corpusanalyse: `${LIVE} [data-testid="coach-panel-corpusanalyse"] [data-walk-loading]`,
  corpus: `${LIVE} [data-testid="coach-panel-judge"] [data-walk-player]`,
};
/** The prototype's phone (its `.ph` is 402 wide), as e2e/coach-panel.spec.mjs draws it. */
const PANEL_PHONE = { phone: { width: 402, height: 860 } };
/** Number forms the corpus screens legitimately show: an import's labelled
 *  count ("All 8 labelled", the signed "All {n} labelled") and the corpus
 *  page's own stage hint ("~16 model calls per file", a cost the coach
 *  chooses, in the corpus page's words). Neither is about a speaker. */
const PANEL_ALLOW = {
  corpushome: [/\bAll \d+ labelled\b/],
  corpusimport: [/~16 model calls per file/],
};
const COACH_PANEL = Object.entries(PANEL_KEYS).map(([name, waitFor]) => ({
  area: "coach-panel", name, audience: "coach",
  path: `/dev/coach-panel?screen=${name}`, waitFor, settleMs: 450, viewports: PANEL_PHONE,
  ...(PANEL_ALLOW[name] ? { allow: PANEL_ALLOW[name] } : {}),
}));
/** The founder's Library and Speaking errors pages (CP3 A; D-CP-21), as
 *  /dev/admin-library draws them over stubs: the admin area, so the AC-9
 *  scan does not run (the readiness line is the founder's own count). */
const ADMIN_PAGES = [
  { area: "coach-panel", name: "library", audience: "admin",
    path: "/dev/admin-library?screen=library", waitFor: '[data-testid="admin-library"] [data-walk-choice]', settleMs: 450, viewports: PANEL_PHONE },
  { area: "coach-panel", name: "libitem", audience: "admin",
    path: "/dev/admin-library?screen=library", waitFor: `${LIVE} [data-testid="library-item"] [data-coach-words]`, settleMs: 450, viewports: PANEL_PHONE,
    act: async (page) => { await page.locator('[data-walk-choice="e:land-the-last-word"]').click(); } },
  { area: "coach-panel", name: "libpraise", audience: "admin",
    path: "/dev/admin-library?screen=library", waitFor: `${LIVE} [data-testid="library-praise"] [data-walk-choice]`, settleMs: 450, viewports: PANEL_PHONE,
    act: async (page) => { await page.locator('[data-walk-choice="p:landed_ending"]').click(); } },
  { area: "coach-panel", name: "libkind", audience: "admin",
    path: "/dev/admin-library?screen=library", waitFor: `${LIVE} [data-testid="library-kind"] [data-walk-choice]`, settleMs: 450, viewports: PANEL_PHONE,
    act: async (page) => { await page.locator('[data-testid="library-new"]').click(); } },
  { area: "coach-panel", name: "libwords", audience: "admin",
    path: "/dev/admin-library?screen=library", waitFor: `${LIVE} [data-testid="library-words"] [data-coach-words]`, settleMs: 450, viewports: PANEL_PHONE,
    act: async (page) => {
      await page.locator('[data-testid="library-new"]').click();
      await page.locator(`${LIVE} [data-walk-choice="rushing"]`).click();
      await page.locator(`${LIVE} [data-testid="library-kind-next"]`).click();
    } },
  { area: "coach-panel", name: "libvideo", audience: "admin",
    path: "/dev/admin-library?screen=library", waitFor: `${LIVE} [data-testid="library-video"] [data-coach-video-box]`, settleMs: 450, viewports: PANEL_PHONE,
    act: async (page) => {
      await page.locator('[data-testid="library-new"]').click();
      await page.locator(`${LIVE} [data-walk-choice="rushing"]`).click();
      await page.locator(`${LIVE} [data-testid="library-kind-next"]`).click();
      await page.locator(`${LIVE} [data-testid="library-words-next"]`).click();
    } },
  { area: "coach-panel", name: "errors", audience: "admin",
    path: "/dev/admin-library?screen=errors", waitFor: `${LIVE} [data-testid="errors-list"] [data-walk-choice]`, settleMs: 450, viewports: PANEL_PHONE },
  { area: "coach-panel", name: "error", audience: "admin",
    path: "/dev/admin-library?screen=errors", waitFor: `${LIVE} [data-testid="errors-item"] [data-testid="error-definition"]`, settleMs: 450, viewports: PANEL_PHONE,
    act: async (page) => { await page.locator(`${LIVE} [data-walk-choice="hedging"]`).click(); } },
];

/* ------------------------------- recording ---------------------------------- */
const RECORDING = [
  // Take 1's learning screen: the mic held, "Scroll down to start".
  { area: "recording", name: "learn", audience: "speaker",
    path: "/dev/recording?learn=1", waitFor: "text=/down to start/" },
  // Take 2, recording, slide 1 with its helper words, the strip below.
  { area: "recording", name: "recording", audience: "speaker",
    path: "/dev/recording?take=2&slide=0&t=150", waitFor: "text=Finish take" },
  // "Getting your mic ready" before a later Take.
  { area: "recording", name: "mic-ready", audience: "speaker",
    path: "/dev/recording?mic=1", waitFor: "text=Getting your mic ready", settleMs: 0 },
];

/* -------------------------------- consent ----------------------------------- */
/** A first-time guest's agreement, on the real surface (/chat), with the
 *  acceptance read answered in the browser the way the enforcing backend
 *  answers it (the stub is e2e/guest-first-visit.spec.mjs's). The policy
 *  text is a stand-in; the real screens show the active policy. */
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
async function guestWithPolicy(context, page) {
  await context.route("**/api/v2/processing-authorization/principal", (r) =>
    r.fulfill({ status: 201, contentType: "application/json",
      body: JSON.stringify({ owner_principal_id: "3f1c2a54-9b7e-4c1d-8a2f-6e5d4c3b2a10",
        is_guest: true, guest_owner_token: GUEST_TOKEN }) }));
  await context.route("**/api/v2/processing-authorization", (r) => {
    if (r.request().method() !== "GET") {
      return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    const token = r.request().headers()["x-willab-guest-owner"];
    return token === GUEST_TOKEN
      ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(POLICY) })
      : r.fulfill({ status: 401, contentType: "application/json",
          body: JSON.stringify({ code: "INVALID_GUEST_OWNER", error: "A verified owner is required." }) });
  });
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
}
async function enterTheLab(page) {
  // A visitor with no account sees the landing first and enters as a guest.
  const enter = page.getByRole("link", { name: /Enter the lab/i })
    .or(page.getByRole("button", { name: /Enter the lab/i })).first();
  if (await enter.waitFor({ timeout: 15_000 }).then(() => true, () => false)) await enter.click();
}
const CONSENT = [
  { area: "consent", name: "welcome", audience: "speaker",
    path: "/chat", waitFor: "text=I agree and continue", settleMs: 600,
    prepare: guestWithPolicy, act: enterTheLab },
];

export const SCREENS = [...IDEAL_TEXT, ...WALK, ...COACH_PANEL, ...ADMIN_PAGES, ...RECORDING, ...CONSENT];
