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
// The moment was read confident (24e-1): its sheet opens on the feedback,
// then Next asks the judgement.
await page.goto(`${BASE}?tier=confident`, { waitUntil: "networkidle" });
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
  (await page.locator('button[aria-label^="Feedback waiting — review it"]').count()) === 1 &&
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

/* ------------- only a bookmark opens on tap (founder 2026-10-06) ----------- */
/* N56.5: "a paragraph that is not bookmarked should not open on tap",
   amending lock B7. P0 has no feedback, no coach moment and no helper
   words: plain text, no button, no focus, no pointer, and a tap opens
   nothing. P1 carries the bar: still its own tap target. */
const plainParagraph = page.locator("[data-chunk]", { hasText: "We started this in a garage" });
check(
  "a paragraph with no bookmark is plain text, not a button",
  (await plainParagraph.count()) === 1 &&
    (await plainParagraph.getAttribute("data-opens-sheet")) === null &&
    (await plainParagraph.getAttribute("role")) === null &&
    (await plainParagraph.getAttribute("tabindex")) === null &&
    (await plainParagraph.evaluate((el) => getComputedStyle(el).cursor)) !== "pointer"
);
await plainParagraph.click();
await page.waitForTimeout(300);
check(
  "tapping a paragraph with no bookmark opens nothing",
  (await page.locator('[role="dialog"]').count()) === 0
);
check(
  "the paragraph with the bar is still its own tap target",
  (await page.locator('[data-opens-sheet="true"]', { hasText: "Nobody believed the numbers" }).count()) === 1
);

/* --------------- the feedback, then the judgement, then the overlay -------- */
/* JUDGEMENT AFTER FEEDBACK (contract 24e-1; F1 Repair Plan Phase 6): opening
   a bookmark never asks for a judgement first. The machine's read chooses
   the feedback; on a confident moment the judgement comes right after it,
   on Next. The answer then hands the paragraph to its own overlay, where
   the speaker's answer is said back as one small line and Next opens the
   helper words (24e). */
await page.locator('button[aria-label^="Feedback waiting — review it"]').click();
await page.waitForSelector('[data-testid="paragraph-sheet"]');
check(
  "the bookmark opens on the feedback, not on the question",
  (await dialog(page).locator("text=Does this sound confident to you?").count()) === 0 &&
    (await dialog(page).locator('[data-testid="judgement-label"]').count()) === 0 &&
    (await dialog(page).locator('[data-testid="practise-card"][data-kind="rewrite"]').count()) === 0 &&
    (await dialog(page).locator("button", { hasText: /^Next$/ }).count()) === 1
);
await dialog(page).locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector("text=Feedback");
await dialog(page).locator("button", { hasText: /^Yes$/ }).click();
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
  // The matrix on a Yes (24f; Phase 6): the praise where the machine found
  // one, and nothing else -- the rewrite is not shown on a Yes. This
  // fixture's moment carries no praise, so no card. The paragraph text is
  // not on the overlay (D6).
  "on a Yes the rewrite is not shown, and the paragraph text stays on the page",
  (await dialog(page).locator('[data-testid="practise-card"]').count()) === 0 &&
    !(await dialog(page).innerText()).includes("Nobody believed the numbers")
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
// One tap per word (founder Q-B5 A, 2026-10-07): each tap adds the next
// word beside the phrase, four words at most (B3); a word that is not beside
// it cannot be tapped yet.
for (const word of ["believed", "the", "numbers"]) {
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

/* -------- accepting the rewrite (founder 2026-09-30, C11; contract 29b) --- */
const accepting = await browser.newPage({ viewport: { width: 520, height: 900 } });
await accepting.emulateMedia({ reducedMotion: "reduce" });
await accepting.goto(`${BASE}?tier=weak`, { waitUntil: "networkidle" });
await accepting.waitForSelector("text=Garage pitch");
// A weak read with nothing to practise draws no bar (B7): the paragraph is
// plain text and is its own tap target.
await accepting
  .locator('[data-opens-sheet="true"]', { hasText: "Nobody believed the numbers" })
  .first()
  .click();
await accepting.waitForSelector('[data-testid="paragraph-sheet"]');
check(
  // The cold start (P1-7): an empty library and no coach. A moment read
  // weak opens on the rewrite (24e-1), its words shown as text, the one
  // button accepts them and the grey link keeps the speaker's own. No coach
  // sentence, and no question before it.
  "a moment that needed work opens on the rewrite, Accept and practise with Keep my words under it",
  (await dialog(accepting).locator('[data-testid="practise-card"][data-kind="rewrite"]').count()) === 1 &&
    (await dialog(accepting).locator('[data-testid="paragraph-sheet-accept"]').count()) === 1 &&
    (await dialog(accepting).locator("button", { hasText: /^Accept and practise$/ }).count()) === 1 &&
    (await dialog(accepting).locator("button", { hasText: /^Keep my words$/ }).count()) === 1 &&
    (await dialog(accepting).locator("button", { hasText: /^Skip$/ }).count()) === 0 &&
    !(await dialog(accepting).innerText()).includes("Your coach is working") &&
    (await dialog(accepting).locator("text=Does this sound confident to you?").count()) === 0
);
await dialog(accepting).locator('[data-testid="paragraph-sheet-accept"]').click();
await accepting.waitForSelector('[data-testid="practise-sheet"]');
const acceptWrites = await calls(accepting);
check(
  // The acceptance is the owner's response on the rewrite item AND the
  // document decision (the ledger bakes it); then the practise opens on
  // the accepted words, and says so.
  "Accept writes the response and the decision, then practises the accepted words",
  acceptWrites.some(
    (w) => w.url.includes("/feedback-response") &&
      w.body.feedback_family === "rewrite_clarity" && w.body.response === "apply_suggestion"
  ) &&
    acceptWrites.some(
      (w) => w.url.includes("suggestion-feedback") && w.body.action === "applied"
    ) &&
    // textContent, not innerText: the eyebrow is set in small caps by CSS.
    (await accepting.locator('[data-testid="practise-say"]').evaluate((el) => el.textContent ?? "")).includes("Say it this way · accepted") &&
    (await accepting.locator('[data-testid="practise-say"]').evaluate((el) => el.textContent ?? "")).includes("trusted the figures"),
  JSON.stringify(acceptWrites.map((w) => [w.url, w.body]))
);
await accepting.locator('[data-testid="practise-sheet"] button[aria-label="Close"]').first().click();
await accepting.waitForTimeout(600);
check(
  // L1 with the user's acceptance (29b): the accepted words are the
  // paragraph's now, and History will show "Correction accepted".
  "after Accept the paragraph on the page carries the accepted words",
  (await accepting.locator("text=Nobody trusted the figures").count()) >= 1 &&
    (await accepting.locator("text=Nobody believed the numbers").count()) === 0
);
await accepting.close();

/* -------- the cold start's other half: a library with a video (P1-7) ------ */
const stocked = await browser.newPage({ viewport: { width: 520, height: 900 } });
await stocked.emulateMedia({ reducedMotion: "reduce" });
await stocked.goto(`${BASE}?library=full&tier=weak`, { waitUntil: "networkidle" });
await stocked.waitForSelector("text=Garage pitch");
await stocked.locator('button[aria-label^="Feedback waiting — review it"]').click();
await stocked.waitForSelector('[data-testid="paragraph-sheet"]');
check(
  // With a video in the library the exercise is the card the weak read
  // opens on (the follow-up matrix), not the rewrite: Practise, Skip under
  // it, and nothing to accept.
  "with a library video the exercise is the card, Practise and Skip, no Accept",
  (await dialog(stocked).locator('[data-testid="practise-card"][data-kind="exercise"]').count()) === 1 &&
    (await dialog(stocked).innerText()).includes("Give the last four words") &&
    (await dialog(stocked).locator('[data-testid="paragraph-sheet-practise"]').count()) >= 1 &&
    (await dialog(stocked).locator('[data-testid="paragraph-sheet-skip"]').count()) === 1 &&
    (await dialog(stocked).locator("button", { hasText: /^Accept and practise$/ }).count()) === 0
);
await dialog(stocked).locator('[data-testid="paragraph-sheet-practise"]').first().click();
await stocked.waitForSelector('[data-testid="practise-sheet"]');
check(
  // Practise opens the card shown (close-out audit 2026-10-04): the exercise.
  "Practise on the exercise opens the practise loop on the exercise",
  // textContent, not innerText: the sheet fades in under reduced motion too.
  (await stocked.locator('[data-testid="practise-sheet"]').evaluate((el) => el.textContent ?? "")).includes("Give the last four words")
);
await stocked.close();

/* ------- tap and go: a skipped moment's bar leaves at once (2026-10-05) ---- */
const skipping = await browser.newPage({ viewport: { width: 520, height: 900 } });
await skipping.emulateMedia({ reducedMotion: "reduce" });
await skipping.goto(`${BASE}?library=full&tier=weak`, { waitUntil: "networkidle" });
await skipping.waitForSelector("text=Garage pitch");
await skipping.locator('button[aria-label^="Feedback waiting — review it"]').click();
await skipping.waitForSelector('[data-testid="paragraph-sheet"]');
await dialog(skipping).locator('[data-testid="paragraph-sheet-skip"]').click();
await skipping.waitForTimeout(400);
check(
  "Skip settles the moment on the tap: its bar is gone without a reload",
  (await skipping.locator('button[aria-label^="Feedback waiting — review it"]').count()) === 0
);
await skipping.close();

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
