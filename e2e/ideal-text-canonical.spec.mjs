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
  "only actionable paragraphs have bookmarks",
  (await page.locator('button[data-status="outline"]').count()) === 2 &&
    (await page.locator('button[data-status="filled"]').count()) === 0 &&
    (await page.locator('button[data-status="attention"]').count()) === 0
);
check(
  "the two outline bookmarks describe feedback and protected-text attention",
  (await page.locator('button[aria-label="Feedback waiting — review it"]').count()) === 1 &&
    (await page.locator('button[aria-label*="Paragraph protected"][aria-label*="Coach note:"][aria-label*="Style"]').count()) === 1
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
await page.locator('button[aria-label="Feedback waiting — review it"]').click();
await page.waitForSelector("text=Suggested change");
check(
  "rewrite feedback shows exact source, replacement, and rationale",
  await (async () => {
    const text = await dialog(page).innerText();
    return (
      text.includes("WHAT YOU SAID") &&
      text.includes("believed the numbers") &&
      text.includes("CLEARER VERSION") &&
      text.includes("trusted the figures") &&
      /clearer|smoother|flow better|easier to understand|cleaner finish/.test(text)
    );
  })()
);
check(
  "rewrite offers the two canonical decisions",
  (await page.locator("button", { hasText: /^Use clearer version$/ }).count()) === 1 &&
    (await page.locator("button", { hasText: /^Keep mine$/ }).count()) === 1
);
await page.locator("button", { hasText: /^Use clearer version$/ }).click();
await page.waitForTimeout(700);
let writes = await calls(page);
let suggestionWrites = writes.filter((entry) =>
  entry.url.includes("suggestion-feedback")
);
check(
  "accepting the rewrite sends one exact decision",
  suggestionWrites.length === 1 &&
    suggestionWrites[0].body.action === "applied" &&
    suggestionWrites[0].body.target === "document_replace" &&
    suggestionWrites[0].body.quote === "believed the numbers" &&
    suggestionWrites[0].body.proposed_text === "trusted the figures",
  JSON.stringify(suggestionWrites[0]?.body)
);
check(
  "the document changes immediately and keeps Undo in the open feedback history",
  (await page.locator("text=Nobody trusted the figures").count()) >= 1 &&
    (await dialog(page).locator("text=Undo rewrite").count()) === 1
);
check(
  "the resolved rewrite bookmark disappears",
  (await page.locator('button[aria-label="Feedback waiting — review it"]').count()) === 0
);

await dialog(page).locator("button", { hasText: /^Lock in$/ }).click();
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

/* ------------------ protected paragraph: style + coach note --------------- */
const protectedBookmark = page.locator(
  'button[aria-label*="Paragraph protected"][aria-label*="Coach note:"]'
);
await protectedBookmark.click();
await page.waitForSelector("text=Locked chunk");
check(
  "protected feedback keeps coach and styling layers inside one bookmark",
  (await dialog(page).locator("text=Coach note:").count()) === 1 &&
    (await dialog(page).locator("text=Bolden").count()) === 1 &&
    (await dialog(page).locator("button", { hasText: "Apply emphasis" }).count()) === 1
);
await dialog(page).locator("button", { hasText: "Apply emphasis" }).click();
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
  (await dialog(page).locator("button", { hasText: "Apply emphasis" }).count()) === 0 &&
    !(await dialog(page).innerText()).includes("**")
);

await dialog(page).locator("button", { hasText: "Coach note:" }).click();
await page.waitForTimeout(500);
writes = await calls(page);
check(
  "coach copy loads only after the deliberate tap",
  writes.filter((entry) => entry.url.includes("/feedback")).length === 1 &&
    (await dialog(page).locator("text=This is the turn — say it slower.").count()) === 1
);
await dialog(page).locator('button[aria-label="Close"]').click();
await page.waitForTimeout(200);

/* -------------------------- slide-scoped editing -------------------------- */
check(
  "editing is explicit and slide-scoped, separate from bookmarks",
  (await page.locator("button", { hasText: /^Edit this slide$/ }).count()) === 2
);
await page.locator("button", { hasText: /^Edit this slide$/ }).first().click();
await page.waitForSelector('[role="dialog"][aria-label="Edit this slide"]');
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
  "saving one slide sends one atomic document edit with the touched paragraph protected",
  editWrites.length === 1 &&
    Array.isArray(editWrites[0].body.parts) &&
    editWrites[0].body.parts.some(
      (part) => part.text.includes("never looked back") && part.locked === true
    )
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
await fresh.locator("button", { hasText: /^Edit this slide$/ }).first().click();
await fresh.waitForSelector('[role="dialog"][aria-label="Edit this slide"]');
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
      (part) => part.text.includes("Fresh.") && part.locked === true
    ),
  JSON.stringify(freshEdits[0]?.body?.parts?.length ?? null)
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
