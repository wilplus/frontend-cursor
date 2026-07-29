/* -------------------------------------------------------------------------- */
/*  Coach Star Verdict — the interaction contract, driven in a real browser.   */
/*                                                                            */
/*  Run against `next dev` (the harness at /dev/star-verdicts stubs the two    */
/*  endpoints and records every PUT on window.__starPuts):                     */
/*    node e2e/star-verdicts.spec.mjs        (STARS_URL overrides the target)  */
/*                                                                            */
/*  What only an engine can prove: that "Wrong kind" saves NOTHING until a     */
/*  correction is picked (N3 — the pick is the save), that the PUT bodies      */
/*  echo the row verbatim, that a saved verdict is re-editable (N5), that the  */
/*  migration-gate 500 surfaces its message verbatim, and that the internal    */
/*  summary bookkeeping never renders.                                         */
/* -------------------------------------------------------------------------- */

import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;

const BASE = process.env.STARS_URL ?? "http://localhost:3111/dev/star-verdicts";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

const puts = (page) => page.evaluate(() => window.__starPuts ?? []);
const progress = async (page) =>
  (await page.locator("header, div").first().innerText().catch(() => "")) &&
  page.locator("text=/\\d+ of \\d+ reviewed/").first().innerText().catch(() => "");

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("ul > li");

const rows = page.locator("ul > li");
check("all four stars render, in payload order", (await rows.count()) === 4);
check(
  "chips read kind · device from the wire, no copy table",
  (await rows.nth(0).innerText()).includes("Delivery · pace fast") &&
    (await rows.nth(1).innerText()).includes("Replace") &&
    (await rows.nth(2).innerText()).includes("Structure")
);
check(
  "the replacement text renders on the replace star",
  (await rows.nth(1).innerText()).includes("and that honestly floored me")
);
check(
  "the already-judged row arrives with its verdict as current state (N5)",
  await rows.nth(3).locator('button[aria-pressed="true"]', { hasText: "Keep" }).count() === 1
);
check(
  "progress counts the judged row",
  (await page.locator("text=1 of 4 reviewed").count()) === 1
);
check(
  "internal summary bookkeeping is never rendered",
  !(await page.locator("body").innerText()).includes("pace_fast->pace_slow")
);

/* --------------------- playback: verify the star by ear -------------------- */
check(
  "rows with served audio render a clamped player",
  (await rows.nth(0).locator("audio").count()) === 1 &&
    (await rows.nth(1).locator("audio").count()) === 1
);
check(
  "the player is playable, not errored (real decodable WAV)",
  (await rows.nth(0).locator('button[aria-label="Play snippet"]').count()) === 1
);
check(
  "the transcript of the fired-on moment renders with the star",
  (await rows.nth(0).innerText()).includes(
    "and we shipped it in a week which nobody believed"
  )
);
check(
  "the take label renders when the BE says which take",
  (await rows.nth(0).innerText()).includes("Take 2") &&
    (await rows.nth(1).innerText()).includes("Take 3")
);
check(
  "a payload without audio degrades to a text-only row, no broken player",
  (await rows.nth(2).locator("audio").count()) === 0 &&
    (await rows.nth(3).locator("audio").count()) === 0
);

/* ------------------------------- Keep saves ------------------------------- */
await rows.nth(0).locator("button", { hasText: "Keep" }).click();
await page.waitForTimeout(300);
let p = await puts(page);
check("Keep saves on tap — one PUT", p.length === 1);
check(
  "the PUT echoes the row verbatim",
  JSON.stringify(p[0]?.body) ===
    JSON.stringify({ star_kind: "delivery", star_device: "pace_fast", verdict: "keep" }),
  JSON.stringify(p[0]?.body)
);
check("progress moves to 2 of 4", (await page.locator("text=2 of 4 reviewed").count()) === 1);

/* --------------------- Wrong kind: the pick is the save -------------------- */
await rows.nth(0).locator("button", { hasText: "Wrong kind…" }).click();
await page.waitForTimeout(200);
p = await puts(page);
check("opening the picker saves NOTHING (N3)", p.length === 1);
const picker = rows.nth(0).locator("text=What should it have been?");
check("the picker opened", (await picker.count()) === 1);
const options = await rows
  .nth(0)
  .locator("button", { hasText: /pace slow|emphasis|pause|congruence|pace fast/ })
  .allInnerTexts();
check(
  "options come from device_options minus the star's own device (N4)",
  options.join("|").includes("pace slow") && !options.includes("pace fast"),
  options.join(", ")
);
await rows.nth(0).locator("button", { hasText: "pace slow" }).click();
await page.waitForTimeout(300);
p = await puts(page);
check("the pick IS the save — second PUT", p.length === 2);
check(
  "wrong_kind carries the labeled confusion pair",
  JSON.stringify(p[1]?.body) ===
    JSON.stringify({
      star_kind: "delivery",
      star_device: "pace_fast",
      verdict: "wrong_kind",
      corrected_device: "pace_slow",
    }),
  JSON.stringify(p[1]?.body)
);
check(
  "re-judging replaced the verdict on screen (N5)",
  (await rows.nth(0).locator('button[aria-pressed="true"]', { hasText: "Wrong kind…" }).count()) === 1
);
check(
  "progress did not double-count the re-judged row",
  (await page.locator("text=2 of 4 reviewed").count()) === 1
);

/* -------------- single-device kinds correct to another family ------------- */
await rows.nth(1).locator("button", { hasText: "Wrong kind…" }).click();
await page.waitForTimeout(200);
const famOptions = await rows
  .nth(1)
  .locator("div:has(> p) button")
  .allInnerTexts();
check(
  "empty device_options falls back to the other families",
  ["emphasize", "structure", "delivery"].every((f) => famOptions.includes(f)),
  famOptions.join(", ")
);

/* ----------------------- note rides the verdict PUT ------------------------ */
await rows.nth(1).locator("button", { hasText: "Add note" }).click();
await rows.nth(1).locator("textarea").fill("she meant it exactly that way");
await rows.nth(1).locator("button", { hasText: "structure" }).click();
await page.waitForTimeout(300);
p = await puts(page);
check(
  "the note rode the same PUT (no second request)",
  p.length === 3 && p[2]?.body?.note === "she meant it exactly that way",
  JSON.stringify(p[2]?.body)
);
check(
  "null star_device echoed as null — never reconstructed",
  p[2]?.body?.star_device === null && p[2]?.body?.star_kind === "replace"
);

/* ------------------- migration gate degrades gracefully -------------------- */
await rows.nth(2).locator("button", { hasText: "Shouldn't fire" }).click();
await page.waitForTimeout(300);
check(
  "the 500's message shows verbatim, naming the migration",
  (await rows.nth(2).innerText()).includes("run migrations/add_star_verdicts.sql")
);
check(
  "a failed save does not mark the row judged",
  (await rows.nth(2).locator('button[aria-pressed="true"]').count()) === 0
);
check(
  "progress unchanged after the failure (3 rows judged before it)",
  (await page.locator("text=3 of 4 reviewed").count()) === 1
);

/* ------------------- the editor: rewrite what the star says ---------------- */
const row0 = rows.nth(0);
check(
  "an already-rewritten row shows the COACH's wording, not the machine's",
  (await rows.nth(3).innerText()).includes("this is her at her best") &&
    !(await rows.nth(3).innerText()).includes("A beat of silence here")
);
check(
  "and wears the neutral Edited chip once judged",
  (await rows.nth(3).innerText()).includes("Edited") &&
    !(await rows.nth(3).innerText()).includes("add a verdict")
);

await row0.locator("button", { hasText: "Edit what it says" }).click();
const whyBox = row0.locator('textarea[aria-label="What this star says"]');
check(
  "the editor seeds from what the row currently says",
  (await whyBox.inputValue()) === "You moved faster here than you usually do."
);
const before = (await puts(page)).length;
await whyBox.fill("She always talks this fast — this is her normal.");
await page.waitForTimeout(150);
check(
  "typing alone sends nothing — the edit rides the verdict (edit → keep)",
  (await puts(page)).length === before
);
// Row 0 already carries a verdict from earlier, so the editor offers an
// explicit re-save of the SAME verdict carrying the new wording.
await row0.locator("button", { hasText: "Save wording" }).click();
await page.waitForTimeout(400);
const edits = await puts(page);
const last = edits[edits.length - 1];
check(
  "the rewrite rides the verdict PUT as why_final",
  last?.body?.why_final === "She always talks this fast — this is her normal." &&
    last?.body?.verdict === "wrong_kind" &&
    last?.body?.star_kind === "delivery",
  JSON.stringify(last?.body)
);
check(
  "the row now shows the coach's wording and turns Edited",
  (await row0.innerText()).includes("this is her normal") &&
    (await row0.innerText()).includes("Edited")
);
const afterSave = (await puts(page)).length;
await row0.locator("button", { hasText: "Save wording" }).click();
await page.waitForTimeout(400);
check(
  "re-saving an untouched rewrite sends the verdict WITHOUT why_final — no phantom edit",
  (await puts(page)).length === afterSave + 1 &&
    !((await puts(page)).at(-1)?.body ?? {}).hasOwnProperty("why_final"),
  JSON.stringify((await puts(page)).at(-1)?.body)
);

/* ------------------------------- empty state ------------------------------- */
await page.goto(`${BASE}?arc=empty`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check(
  "total: 0 is a valid state, not an error",
  (await page.locator("text=No stars fired on this arc.").count()) === 1
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
