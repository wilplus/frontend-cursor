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
  // Four paragraphs, four marks, from first paint. Since 2026-09-15 the ring
  // is plain `unresolved` rather than `flagship && unresolved`, so the two
  // paragraphs with something waiting wear it and the two settled ones do
  // not. That binary is what replaced the small 2/3 the mark used to print —
  // a column reading 3 / 1 / 2 scans as a ranking of how bad each paragraph
  // is, which is the reading AC-9 exists to prevent.
  "every paragraph has a stable bookmark, and waiting is shown not counted",
  (await page.locator("button[data-status]").count()) === 4 &&
    (await page.locator('button[data-status="attention"]').count()) === 2 &&
    (await page.locator('button[data-status="outline"]').count()) === 2 &&
    (await page.locator('button[data-status="filled"]').count()) === 0 &&
    // No digit anywhere on a mark.
    (await page.$$eval("button[data-status]", (marks) =>
      marks.every((mark) => !/\d/.test(mark.textContent ?? ""))))
);
check(
  "the actionable bookmarks describe feedback and protected-text attention",
  // "Emphasis", not "Style": the sheet's step is titled Emphasis and the mark
  // reads from that same constant, so the two cannot spell one thing twice.
  (await page.locator('button[aria-label="Feedback waiting — review it"]').count()) === 1 &&
    (await page.locator('button[aria-label*="Paragraph protected"][aria-label*="Coach note:"][aria-label*="Emphasis"]').count()) === 1
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
await page.locator('button[aria-label^="Feedback waiting — review it"]').click();
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
  "accepting the rewrite stores one immutable family response and one exact document decision",
    responseWrites.length === 1 &&
    responseWrites[0].body.feedback_family === "rewrite_clarity" &&
    responseWrites[0].body.response === "apply_suggestion" &&
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

/* ------- the emphasis step, then the lock that promotes what it chose ------ */
/* THE ROOT FACE IS GONE (founder 2026-09-15). The rooting phrase is chosen
   BEFORE the lock, on its own step, and the lock promotes it. The speaker
   already said which words matter; asking again after the lock was asking
   twice. So this walk is: decide the rewrite -> choose words -> Lock. */
await page.waitForSelector("text=Emphasis");
check(
  // THIS paragraph has no emphasis PROPOSAL — the style lane sits on the
  // protected one below — so the step opens straight into tap-to-select. That
  // is the "none proposable" state, and it is the reason the step exists for
  // every paragraph rather than only for the ones with an offer: it is now
  // the only place a rooting phrase is ever chosen.
  "with nothing proposed, the emphasis step opens straight into choosing",
  (await dialog(page).locator("text=TAP THE WORDS").count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Emphasise$/ }).count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Skip$/ }).count()) === 1
);
for (const word of ["trusted", "the", "figures"]) {
  await dialog(page).locator("button", { hasText: new RegExp(`^${word}$`) }).first().click();
}
check(
  "tapped words preview in the accent, which is how a rooting phrase records",
  (await dialog(page).locator("button.text-primary[aria-pressed='true']").count()) === 3
);
await dialog(page).locator("button", { hasText: /^Emphasise$/ }).click();

await page.waitForSelector("text=Lock");
await dialog(page).locator("button", { hasText: /^Lock$/ }).last().click();
await page.waitForTimeout(700);
writes = await calls(page);
const lockWrites = writes.filter((entry) => entry.url.includes("/lock"));
check(
  "locking accepted words uses the paragraph lock wire with the full document identity",
  lockWrites.length === 1 &&
    lockWrites[0].body.locked === true &&
    typeof lockWrites[0].body.text_echo === "string" &&
    Array.isArray(lockWrites[0].body.parts)
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

/* ------------------ protected paragraph: style + coach note --------------- */
const protectedBookmark = page.locator(
  'button[aria-label*="Paragraph protected"][aria-label*="Coach note:"]'
);
await protectedBookmark.click();
await page.waitForSelector("text=Emphasis");
check(
  // The style lane is the POST-LOCK offer — "open takes rewrites; locked
  // takes emphasis only" — so a locked paragraph with an offer still gets the
  // emphasis step, now with the bolding PREVIEWED so the speaker confirms
  // something they can see rather than a description of it.
  "a protected paragraph still gets its emphasis offer, previewed",
  (await dialog(page).locator("text=WITH EMPHASIS").count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Emphasise$/ }).count()) === 1 &&
    (await dialog(page).locator("button", { hasText: /^Choose different words$/ }).count()) === 1
);
await dialog(page).locator("button", { hasText: /^Emphasise$/ }).click();
await page.waitForTimeout(700);
writes = await calls(page);
const styleWrites = writes.filter((entry) => entry.body?.style_lane === true);
check(
  "accepted styling is one explicit style-lane decision",
  styleWrites.length === 1 &&
    styleWrites[0].body.action === "applied" &&
    styleWrites[0].body.target === "document_bold"
);
check(
  "accepted styling is no longer offered and marker syntax never leaks",
  (await dialog(page).locator("button", { hasText: /^Emphasise$/ }).count()) === 0 &&
    !(await dialog(page).innerText()).includes("**")
);
await dialog(page).locator('button[aria-label="Close"]').click();
await page.waitForTimeout(200);

/* -------------------------- slide-scoped editing -------------------------- */
check(
  "editing is explicit and slide-scoped, separate from bookmarks",
  (await page.locator("button", { hasText: /^Edit the text$/ }).count()) === 2
);
await page.locator("button", { hasText: /^Edit the text$/ }).first().click();
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
await fresh.locator("button", { hasText: /^Edit the text$/ }).first().click();
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
      !labels.some((label) => /edit/i.test(label))
    );
  })
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
