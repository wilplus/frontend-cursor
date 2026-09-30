/* -------------------------------------------------------------------------- */
/*  Canonical Ideal Text — one feedback bookmark per paragraph, exact         */
/*  decision wiring, slide-scoped editing, and a slide-only position rail.     */
/*                                                                            */
/*    DECK_URL=http://localhost:<port>/dev/deck                               */
/*      node e2e/ideal-text-canonical.spec.mjs                                 */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE = process.env.DECK_URL ?? "http://localhost:3111/dev/deck";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const calls = (page) => page.evaluate(() => window.__deckCalls ?? []);
const dialog = (page) => page.locator('[role="dialog"]');

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=Garage pitch");

/* ------------------------ page-level visual contract ---------------------- */
check(
  // ONE MARK, ON THE ONE PARAGRAPH WITH A CONFIDENT VOICE JUDGEMENT WAITING
  // (founder 2026-09-17: "visibility and openability of the overlay is
  // strictly for the confident voice"). The fixture's four paragraphs used to
  // wear four marks; three of them opened a sheet whose first question did
  // not exist, and a column of identical icons down a talk reads as
  // decoration.
  //
  // The protected paragraph is the founder's explicit trade: it carries a
  // style offer and a coach note but NO Confident Voice item, so it wears no
  // mark and cannot be opened from the deck. Asserted here rather than
  // hidden, because it is the cost of the rule.
  "one bookmark, on the paragraph whose voice is still in question",
  (await page.locator("button[data-status]").count()) === 1 &&
    (await page.locator('button[data-status="attention"]').count()) === 1 &&
    (await page.locator('button[data-status="filled"]').count()) === 0 &&
    // No digit anywhere on a mark — a count would scan as a ranking (AC-9).
    (await page.$$eval("button[data-status]", (marks) =>
      marks.every((mark) => !/\d/.test(mark.textContent ?? ""))))
);
check(
  "and it describes the feedback waiting there, in words",
  (await page.locator('button[aria-label="Feedback waiting — review it"]').count()) === 1 &&
    (await page.locator('button[aria-label*="Paragraph protected"]').count()) === 0
);
check(
  "feedback never paints ordinary paragraph text",
  await page.evaluate(() =>
    [...document.querySelectorAll("section *")].every((element) => {
      const value = element.className;
      return (
        typeof value !== "string" ||
        (!value.includes("decoration-pending") &&
          !value.includes("bg-pending/[0.08]") &&
          !value.includes("bg-pending/[0.14]") &&
          !value.includes("underline"))
      );
    })
  )
);
check(
  "the position rail has one control per slide and no paragraph grain",
  (await page.locator('button[aria-label^="Go to Slide"]').count()) === 2 &&
    (await page.locator('button[aria-label^="Go to chunk"]').count()) === 0
);
check(
  "the surface contains no legacy stars, scores, or review footer",
  await page.evaluate(() => {
    const text = document.body.innerText;
    return (
      document.querySelectorAll("svg.lucide-star").length === 0 &&
      !text.includes("★") &&
      !/\bto review\b/.test(text) &&
      !/\b\d+\s+words\b/.test(text) &&
      !/Slide \d+ of \d+/.test(text)
    );
  })
);

/* ------------------ the judgement, then the paragraph overlay -------------- */
/* THE JUDGEMENT IS ALWAYS FIRST (§1), whatever order the payload used. Since
   the founder lock of 2026-09-30 (B5) the answer is the whole of the
   judgement sheet: it hands the paragraph to its own overlay, where the
   speaker's answer is said back as one small line, the rewrite is the one
   practise card, and Next opens the helper words (24e). */
await page.locator('button[aria-label="Feedback waiting — review it"]').click();
await page.waitForSelector("text=Feedback");
await dialog(page).locator("button", { hasText: /Yes — Confident/ }).click();
await page.waitForTimeout(500);
await page.waitForSelector('[data-testid="paragraph-sheet"]');
check(
  "the answer hands over to the paragraph overlay, titled as the lock names it",
  (await dialog(page).locator("h2", { hasText: /^This paragraph$/ }).count()) === 1 &&
    (await dialog(page).locator("text=Does this sound confident to you?").count()) === 0
);
check(
  // D7: the speaker's own answer, in its colour, one line. Never the
  // machine's read.
  "the overlay says the judgement back as one small green line",
  (await dialog(page).locator('[data-testid="judgement-label"][data-tone="green"]').count()) === 1 &&
    (await dialog(page).locator('[data-testid="judgement-label"]').innerText()).includes("Confident")
);
check(
  // B5, D6: the rewrite is the practise card — the exact replacement, under
  // "Small rewrite" — and the paragraph text is not on the overlay.
  "the rewrite is the one practise card, and the paragraph text stays on the page",
  await (async () => {
    const card = dialog(page).locator('[data-testid="practise-card"][data-kind="rewrite"]');
    const text = (await card.count()) === 1 ? await card.innerText() : "";
    const sheet = await dialog(page).innerText();
    return (
      text.includes("SMALL REWRITE") &&
      text.includes("trusted the figures") &&
      !sheet.includes("Nobody believed the numbers")
    );
  })()
);
check(
  // The machine's whyLine() reason was removed from this sheet on 2026-09-15
  // (founder: delete the text "this makes your point easier to understand").
  "the overlay does not explain the rewrite back to the speaker",
  !/easier to understand|flow better|cleaner finish|smoother/.test(
    await dialog(page).innerText()
  )
);
check(
  // B5 as overridden: on a Yes the button reads Next and nothing sits under
  // it. Apply and Keep my wording are gone with the Suggestion screen (the
  // rewrite is a passage to practise, never an edit, L1); "Not now" and
  // "Continue" are retired (D10).
  "on a Yes the overlay offers Next alone",
  (await dialog(page).locator("button", { hasText: /^Next$/ }).count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Apply$/ }).count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Keep my wording$/ }).count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Skip$/ }).count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Practise$/ }).count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Not now$/ }).count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Continue$/ }).count()) === 0
);
check(
  "one collapsed History row sits at the bottom of the overlay",
  (await dialog(page).locator('[data-testid="paragraph-history"]').count()) === 1
);
let writes = await calls(page);
const responseWrites = writes.filter((entry) =>
  entry.url.includes("/feedback-response")
);
let suggestionWrites = writes.filter((entry) =>
  entry.url.includes("suggestion-feedback")
);
check(
  // The judgement wrote its own family response (confident_voice / yes) on
  // the tap. Nothing was written for the rewrite: it was shown, not decided.
  "the answer stores one immutable family response and no document decision",
  responseWrites.some(
    (w) => w.body.feedback_family === "confident_voice" && w.body.response === "yes"
  ) &&
    responseWrites.filter((w) => w.body.feedback_family === "rewrite_clarity").length === 0 &&
    suggestionWrites.length === 0,
  JSON.stringify({ responseWrites, suggestionWrites })
);
check(
  // L1: a rewrite never rewrites the Paragraph. The words on the page are
  // the speaker's own until the next Take.
  "the document is unchanged by the rewrite card",
  (await page.locator("text=Nobody believed the numbers").count()) >= 1 &&
    (await page.locator("text=Nobody trusted the figures").count()) === 0
);
check(
  "the answered bookmark disappears",
  (await page.locator('button[aria-label^="Feedback waiting — review it"]').count()) === 0
);

/* --------- Next opens the helper words, which save and lock at once -------- */
/* THE ROOT FACE IS GONE (founder 2026-09-15): the rooting phrase is chosen on
   its own step, and choosing it locks the words (Q24 B). Since the founder
   lock of 2026-09-30 that step follows Next on the overlay, after a Yes or
   an In-between (24e); a No or Not sure never reaches it. */
await dialog(page).locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector("text=Choose your helper words");
check(
  "Next after a Yes opens straight into choosing the words",
  (await dialog(page).locator("text=TAP THE WORDS").count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Use these helper words$/ }).count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Skip$/ }).count()) === 0
);
// Two taps make the phrase (founder 2026-09-26): the first word, then the
// last one, and every word in between is marked. Four words at most (B3).
for (const word of ["believed", "numbers"]) {
  await dialog(page).locator("button", { hasText: new RegExp(`^${word}$`) }).first().click();
}
check(
  "tapped words preview in the accent, which is how a rooting phrase records",
  (await dialog(page).locator("button.text-primary[aria-pressed='true']").count()) === 3 &&
    (await dialog(page).locator("text=3 of 4 words").count()) === 1
);
// ONE SCREEN (founder 2026-09-25, Q24 B): "Use these helper words" locks the words
// at once and the sheet closes. There is no Lock screen after it, and no
// "Keep evolving" anywhere.
await dialog(page).locator("button", { hasText: /^Use these helper words$/ }).click();
await page.waitForTimeout(700);
// That was the walk's only moment, so the sheet hands over to the end card
// (founder 2026-09-26): "That's every moment for this Take", then back to the
// text.
check(
  "choosing the helper words locks them and moves on, with no Lock screen",
  (await page.locator('[role="dialog"][aria-label="That\'s every moment for this Take"]').count()) === 1 &&
    (await page.locator('[role="dialog"]').count()) === 1 &&
    (await page.locator("button", { hasText: /^Keep evolving$/ }).count()) === 0
);
await page.locator("button", { hasText: /^Back to the text$/ }).click();
await page.waitForTimeout(300);
writes = await calls(page);
const lockWrites = writes.filter((entry) => entry.url.includes("/lock"));
check(
  "locking the words uses the paragraph lock wire with the full document identity",
  lockWrites.length === 1 &&
    lockWrites[0].body.locked === true &&
    typeof lockWrites[0].body.text_echo === "string" &&
    Array.isArray(lockWrites[0].body.parts)
);
check(
  // THE LOCK DOES NOT INVENT A DOCUMENT EDIT. Tapping words previews them in
  // the accent (asserted above) and promotes them through the anchor below —
  // it does not fold a marker into the text. The words the speaker picked
  // belong in the SPAN that §5 stores, not in the paragraph.
  "the lock carries the speaker's words as an anchor, not as an invented edit",
  lockWrites[0].body.parts.every(
    (part) =>
      typeof part.text !== "string" ||
      (!part.text.includes("{{orange:") && !part.text.includes("**"))
  ),
  JSON.stringify(lockWrites[0]?.body?.parts ?? null)
);
const rootWrites = writes.filter((entry) => entry.url.includes("/root"));
check(
  "the lock promotes the chosen words itself, with no second question",
  rootWrites.length === 1 &&
    rootWrites[0].body.phrase === "believed the numbers" &&
    Number.isInteger(rootWrites[0].body.start) &&
    rootWrites[0].body.end - rootWrites[0].body.start === "believed the numbers".length,
  JSON.stringify(rootWrites)
);

/* ------------- protected paragraph: the cost of the new rule --------------- */
/* THE FOUNDER'S EXPLICIT TRADE (2026-09-17), asserted rather than hidden.

   This paragraph is locked and carries a style-lane offer and a coach note,
   but NO Confident Voice item. Since the bookmark is strictly the Confident
   Voice door — "first you see the confident voice and then eventually emphasis
   or a rewrite or an exercise, but first your voice" — it wears no mark, and
   there is no way into its sheet from the deck at all.

   WHAT THIS WALK LOST, said plainly rather than quietly dropped: it used to
   open this paragraph and prove the §4 gate from the inside — that an unjudged
   paragraph is offered no emphasis step even when the Manager has a proposal
   for it. That assertion is now unreachable through the UI, because the door
   it used is gone. The gate itself is unchanged and still covered by
   DeckChunkModal's unit tests ("a judgement that was not Yes skips step four
   entirely"); what is no longer covered end to end is the style lane's
   behaviour on a paragraph nobody can open. If the style offer was meant to
   survive without a judgement, this is the test that says so. */
check(
  "a locked paragraph with no Confident Voice item offers no door",
  (await page.locator('button[aria-label*="Paragraph protected"]').count()) === 0 &&
    (await page.locator("button[data-status]").count()) === 0
);
/* THE PARAGRAPH'S OWN SHEET, SAVED STATE (founder lock 2026-09-30, B8, D6). A
   paragraph with saved helper words has no bar, but tapping its words opens
   the saved screen: "Helper words saved", the words, History, one button.
   Never the paragraph text. No Discard (Q6 A), no Lock. */
await page
  .locator('[data-opens-sheet="true"]', { hasText: "Nobody believed the numbers" })
  .first()
  .click();
await page.waitForSelector('[data-testid="paragraph-sheet"]');
check(
  "tapping a saved paragraph opens its saved screen with the words, never the text",
  (await dialog(page).locator("h2", { hasText: /^Helper words saved$/ }).count()) === 1 &&
    (await page.locator('[data-testid="paragraph-helper-card"]', { hasText: "believed the numbers" }).count()) === 1 &&
    !(await dialog(page).innerText()).includes("Nobody believed the numbers") &&
    (await dialog(page).locator('[data-testid="judgement-label"]').count()) === 0 &&
    (await dialog(page).locator('[data-testid="practise-card"]').count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Discard$/ }).count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Lock$/ }).count()) === 0
);
await dialog(page).locator('button[aria-label="Close"]').first().click();
await page.waitForTimeout(300);
check(
  // ...and the page still does its job: marker syntax never reaches the reader,
  // on a paragraph that carries a style offer it can no longer be shown.
  "marker syntax never leaks onto the page",
  await page.evaluate(() => {
    const text = document.body.innerText;
    return !text.includes("**") && !text.includes("{{orange:");
  })
);
await page.waitForTimeout(200);

/* -------------------------- slide-scoped editing -------------------------- */
check(
  "editing is explicit and slide-scoped, separate from bookmarks",
  (await page.locator('button[aria-label="Edit the text"]').count()) === 2
);
await page.locator('button[aria-label="Edit the text"]').first().click();
await page.waitForSelector('[role="dialog"][aria-label="Edit the text"]');
const editors = dialog(page).locator('[role="textbox"][contenteditable]');
check(
  "the first slide editor contains only its two paragraphs",
  (await editors.count()) === 2 &&
    (await dialog(page).locator("text=So we moved the launch").count()) === 0
);
await editors.first().click();
await page.keyboard.press("Control+End");
await page.keyboard.type(" And we never looked back.");
check(
  "the typed words are in the editor before Save is pressed",
  (await editors.first().innerText()).includes("never looked back")
);
await dialog(page).locator("button", { hasText: /^Save$/ }).click();
await page.waitForTimeout(800);
writes = await calls(page);
const editWrites = writes.filter((entry) => entry.url.includes("/user-edit"));
check(
  "saving one slide sends one atomic document edit while leaving the touched paragraph evolvable",
  editWrites.length === 1 &&
    Array.isArray(editWrites[0].body.parts) &&
    editWrites[0].body.parts.some(
      (part) => part.text.includes("never looked back") && part.locked === false
    ),
  JSON.stringify(editWrites[0]?.body?.parts ?? null)
);
check(
  "the other slide remains unchanged",
  (await page.locator("text=So we moved the launch and it changed everything for us.").count()) === 1
);

/* -------- a document with no stored parts still supports slide editing ---- */
const fresh = await browser.newPage({ viewport: { width: 520, height: 900 } });
await fresh.emulateMedia({ reducedMotion: "reduce" });
await fresh.goto(`${BASE}?noparts=1`, { waitUntil: "networkidle" });
await fresh.waitForSelector("text=Garage pitch");
await fresh.locator('button[aria-label="Edit the text"]').first().click();
await fresh.waitForSelector('[role="dialog"][aria-label="Edit the text"]');
const freshEditor = fresh.locator(
  '[role="dialog"] [role="textbox"][contenteditable]'
).first();
await freshEditor.click();
await fresh.keyboard.press("Control+End");
await fresh.keyboard.type(" Fresh.");
await fresh.locator('[role="dialog"] button', { hasText: /^Save$/ }).click();
await fresh.waitForTimeout(800);
const freshEdits = (await calls(fresh)).filter((entry) =>
  entry.url.includes("/user-edit")
);
check(
  "editing a fresh document mints and sends one complete paragraph identity list",
  freshEdits.length === 1 &&
    Array.isArray(freshEdits[0].body.parts) &&
    freshEdits[0].body.parts.length === 4 &&
    freshEdits[0].body.parts.some(
      (part) => part.text.includes("Fresh.") && part.locked === false
    ),
  JSON.stringify(freshEdits[0]?.body?.parts ?? null)
);
await fresh.close();

// ONE ⋯ (founder 2026-09-26): Presentation Mode, Export and Copy live in
// the header's menu now. Open it, then read the same labels.
await page.locator('button[aria-label="More"]').first().click();
check(
  "the top bar's ⋯ holds presentation, export and copy—and there is no edit control",
  await page.evaluate(() => {
    const labels = [...document.querySelectorAll("button[aria-label]")].map(
      (button) => button.getAttribute("aria-label") ?? ""
    );
    return (
      labels.includes("Use Presentation Mode") &&
      labels.includes("Export") &&
      labels.includes("Copy the text") &&
      // The per-slide pencil under each slide is named "Edit the text"
      // (founder 2026-09-26); it is not a top-bar control.
      !labels.some((label) => /edit/i.test(label) && label !== "Edit the text")
    );
  })
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
