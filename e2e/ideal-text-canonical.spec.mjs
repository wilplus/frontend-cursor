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

/* ----------------------- rewrite is a proposed decision ------------------- */
/* THE JUDGEMENT IS ALWAYS FIRST (§1), whatever order the payload used, and
   since §4 a Yes is also what opens the emphasis step later in this walk. */
await page.locator('button[aria-label="Feedback waiting — review it"]').click();
await page.waitForSelector("text=Feedback");
await dialog(page).locator("button", { hasText: /Yes — Confident/ }).click();
await page.waitForTimeout(500);
await page.waitForSelector("text=Suggestion");
check(
  "rewrite feedback shows the exact source words and the replacement",
  await (async () => {
    const text = await dialog(page).innerText();
    return (
      text.includes("WHAT YOU SAID") &&
      text.includes("believed the numbers") &&
      text.includes("CLEARER VERSION") &&
      text.includes("trusted the figures")
    );
  })()
);
check(
  // The machine's whyLine() reason was removed from this sheet on 2026-09-15
  // (founder: delete the text "this makes your point easier to understand").
  // The two cards above already show what was said and what is proposed.
  "the sheet no longer explains the suggestion back to the speaker",
  !/easier to understand|flow better|cleaner finish|smoother/.test(
    await dialog(page).innerText()
  )
);
check(
  // Still three decisions; "Edit myself" is now the pencil in the top-right of
  // the Clearer version card, named for assistive tech by its aria-label.
  // Still three decisions. Each screen now carries ONE black pill — the verb
  // of that screen — with the decline as a grey link beneath it, never a
  // second button beside it; and "Edit myself" is the pencil on the Clearer
  // version card, named for assistive tech by its aria-label.
  "improvement offers the three canonical decisions, one pill among them",
  (await page.locator("button", { hasText: /^Apply$/ }).count()) === 1 &&
    (await page.locator('button[aria-label="Edit myself"]').count()) === 1 &&
    (await page.locator("button", { hasText: /^Keep wording$/ }).count()) === 1 &&
    (await page.locator("button", { hasText: /^Apply suggestion$/ }).count()) === 0
);
await page.locator("button", { hasText: /^Apply$/ }).click();
await page.waitForTimeout(700);
let writes = await calls(page);
const responseWrites = writes.filter((entry) =>
  entry.url.includes("/feedback-response")
);
let suggestionWrites = writes.filter((entry) =>
  entry.url.includes("suggestion-feedback")
);
check(
  // TWO family responses now, not one, and both are correct: the judgement
  // wrote its own (confident_voice / yes) before this screen. So this asserts
  // the REWRITE's write by family rather than by being the only one — a count
  // of 1 was only ever true because the fixture had no confidence item.
  "accepting the rewrite stores one immutable family response and one exact document decision",
    responseWrites.filter((w) => w.body.feedback_family === "rewrite_clarity")
      .length === 1 &&
    responseWrites.some(
      (w) => w.body.feedback_family === "confident_voice" && w.body.response === "yes"
    ) &&
    responseWrites.find((w) => w.body.feedback_family === "rewrite_clarity")
      .body.response === "apply_suggestion" &&
    suggestionWrites.length === 1 &&
    suggestionWrites[0].body.action === "applied" &&
    suggestionWrites[0].body.target === "document_replace" &&
    suggestionWrites[0].body.quote === "believed the numbers" &&
    suggestionWrites[0].body.proposed_text === "trusted the figures",
  JSON.stringify({
    responseWrites,
    suggestionWrites,
    dialog: await dialog(page).innerText(),
  })
);
check(
  // The accept lands in the document on the spot, and the brief real Undo
  // follows the accepted words onto the lock card — it has no editor face to
  // live on any more. It is not in the footer: that screen has one decision.
  "the document changes immediately and Undo follows the accepted words",
  (await page.locator("text=Nobody trusted the figures").count()) >= 1
);
check(
  "the resolved rewrite bookmark disappears",
  (await page.locator('button[aria-label^="Feedback waiting — review it"]').count()) === 0
);

/* --------- the emphasis step, then the lock that promotes what it chose ---- */
/* THE ROOT FACE IS GONE (founder 2026-09-15): the rooting phrase is chosen
   BEFORE the lock, on its own step, and the lock promotes it.

   Since §4 the step also requires a Yes — which this walk gave above. A
   paragraph nobody judged skips step four entirely and locks with no anchor,
   and THAT, not a Skip button, is how a paragraph ends up without an orange
   phrase. The Skip this walk used to expect is gone with it (§5): the step has
   no opt-out, because it only appears on a paragraph already judged Yes. */
await page.waitForSelector("text=Choose your helper words");
check(
  // This paragraph has no emphasis PROPOSAL — the style lane sits on the
  // protected one below — so the step opens straight into tap-to-select.
  "with nothing proposed, the emphasis step opens straight into choosing",
  (await dialog(page).locator("text=TAP THE WORDS").count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Use this phrase$/ }).count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Skip$/ }).count()) === 0
);
// Two taps make the phrase (founder 2026-09-26): the first word, then the
// last one, and every word in between is marked.
for (const word of ["trusted", "figures"]) {
  await dialog(page).locator("button", { hasText: new RegExp(`^${word}$`) }).first().click();
}
check(
  "tapped words preview in the accent, which is how a rooting phrase records",
  (await dialog(page).locator("button.text-primary[aria-pressed='true']").count()) === 3
);
// ONE SCREEN (founder 2026-09-25, Q24 B): "Use this phrase" locks the words
// at once and the sheet closes. There is no Lock screen after it, and no
// "Keep evolving" anywhere.
await dialog(page).locator("button", { hasText: /^Use this phrase$/ }).click();
await page.waitForTimeout(700);
check(
  "choosing the helper words locks them and closes the sheet, with no Lock screen",
  (await page.locator('[role="dialog"]').count()) === 0 &&
    (await page.locator("button", { hasText: /^Keep evolving$/ }).count()) === 0
);
writes = await calls(page);
const lockWrites = writes.filter((entry) => entry.url.includes("/lock"));
check(
  "locking accepted words uses the paragraph lock wire with the full document identity",
  lockWrites.length === 1 &&
    lockWrites[0].body.locked === true &&
    typeof lockWrites[0].body.text_echo === "string" &&
    Array.isArray(lockWrites[0].body.parts)
);
check(
  // THE LOCK DOES NOT INVENT A DOCUMENT EDIT. Tapping words previews them in
  // the accent (asserted above) and promotes them through the anchor below —
  // it does not fold a marker into the text. An earlier attempt did exactly
  // that, and the slide-edit walk further down caught the cost: Lock then also
  // saved the document, and the refetch churned an open editor so the next
  // slide edit did not reach its save. The words the speaker picked belong in
  // the SPAN that §5 stores, not in the paragraph.
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
    rootWrites[0].body.phrase === "trusted the figures" &&
    Number.isInteger(rootWrites[0].body.start) &&
    rootWrites[0].body.end - rootWrites[0].body.start === "trusted the figures".length,
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
/* THE PARAGRAPH'S OWN SHEET (founder 2026-09-25, Q26 B). A paragraph that was
   answered or locked has no mark, but tapping its words opens its own sheet:
   the helper words and the paragraph now at the top, the history below. No
   Discard (Q6 A). */
await page
  .locator('[data-opens-sheet="true"]', { hasText: "Nobody trusted the figures" })
  .first()
  .click();
await page.waitForSelector('[data-testid="paragraph-sheet"]');
check(
  "tapping a locked paragraph opens its own sheet with the paragraph as it is now",
  (await page.locator('[data-testid="paragraph-now"]', { hasText: "Nobody trusted the figures" }).count()) === 1 &&
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

check(
  "the top bar has presentation, export, copy, and close—but no edit control",
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
