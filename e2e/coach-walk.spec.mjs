/* -------------------------------------------------------------------------- */
/*  The coach's walk, screens 1 to 3, in a real browser (group 3).             */
/*                                                                            */
/*    WALK_URL=http://localhost:<port>/dev/coach-walk node e2e/coach-walk.spec.mjs */
/*                                                                            */
/*  What this proves, in order: the Lounge door counts speakers, not quality;  */
/*  the Queue says one word per moment and no kind before a rating; the Judge  */
/*  sheet shows the clip and the question only, and nothing of the moment     */
/*  (passage, kind, what fired) is on the page before the rating is saved;    */
/*  the rating PUT carries the answer; Read then shows the passage, both      */
/*  answers as words, what fired by its name and the library line; Nothing to */
/*  add writes no_safe_match and the next moment opens on its own.            */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE = process.env.WALK_URL ?? "http://localhost:3111/dev/coach-walk";
const PASSAGE_1 = "We, we rebuilt the, the pipeline from scratch.";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 560, height: 1100 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="coach-walk-bubble"]');

/** The text of the open sheet only: the page's own scripts carry words like
 *  "Error" in their payload, so a whole-document read would lie. */
const sheetText = () =>
  page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    return dialogs[dialogs.length - 1]?.textContent ?? "";
  });
const bodyText = () => page.evaluate(() => document.body.textContent ?? "");

/* ------------------------------ the door ----------------------------------- */
check("the bubble counts speakers waiting, in words",
  (await page.locator('[data-testid="coach-walk-bubble"]').textContent()).includes("1 speaker waiting"));

await page.locator('[data-testid="coach-walk-bubble"]').click();
await page.waitForSelector('[data-testid="coach-queue"]');
const queueText = await page.locator('[data-testid="coach-queue"]').textContent();
check("the queue lists the speaker, the take and one word per moment",
  queueText.includes("Quiet Heron") && queueText.includes("Take 2 · 2 moments") &&
  queueText.includes("Judge it") && queueText.includes("Calm Otter"));
check("no kind is on the queue before a rating", !queueText.includes("Error"));

/* ------------------------------ judge -------------------------------------- */
await page.locator('[data-testid="coach-queue-moment"]').first().click();
await page.waitForSelector('[data-testid="coach-judge-sheet"]');
const judgeText = await sheetText();
check("the judge sheet asks the one question with the coach's words",
  judgeText.includes("Judge this moment") && judgeText.includes("Does the speaker sound confident here?") &&
  judgeText.includes("Private · training · saved on tap") && judgeText.includes("Quiet Heron · moment 1 of 2"));
check("nothing of the moment is on the page before the rating",
  !judgeText.includes(PASSAGE_1) && !judgeText.includes("Restarting a phrase") && !judgeText.includes("Error"));
check("the five answers are the speaker's five",
  judgeText.includes("Yes — Confident") && judgeText.includes("In-between") &&
  judgeText.includes("No — Not confident") && judgeText.includes("Not sure") && judgeText.includes("Audio unclear"));

const callsBefore = await page.evaluate(() => window.__walkCalls.length);
check("no write happened by opening the sheet", callsBefore === 0);

await page.locator("button", { hasText: "No — Not confident" }).click();
await page.waitForSelector('[data-testid="coach-read-sheet"]');
const calls = await page.evaluate(() => window.__walkCalls);
check("tapping an answer saves the rating, once, with the value",
  calls.length === 1 && calls[0].method === "PUT" && calls[0].url.includes("/confidence-label") &&
  calls[0].body.value === "no" && calls[0].body.state_id === "confidence");

/* ------------------------------ read --------------------------------------- */
await page.waitForSelector('[data-testid="coach-read-passage"]');
const readText = await sheetText();
check("read shows the passage, both answers as words, the kind and what fired",
  readText.includes("What you judged") && readText.includes(PASSAGE_1) &&
  readText.includes("You: Not confident") && readText.includes("Quiet Heron: Not confident") &&
  readText.includes("Error") && readText.includes("Restarting a phrase") &&
  readText.includes("Nothing treats this yet.") && readText.includes("Sound calm in front of the board"));
check("no number about the speaker is on the read screen", !/\d+\s?%/.test(readText));

await page.locator("button", { hasText: /^Nothing to add$/ }).click();
await page.waitForSelector('[data-testid="coach-judge-sheet"]');
const after = await page.evaluate(() => window.__walkCalls);
check("nothing to add writes no_safe_match and the next moment opens on its own",
  after.length === 2 && after[1].url.endsWith("/exercise-request") &&
  after[1].body.resolution === "no_safe_match" &&
  (await sheetText()).includes("Quiet Heron · moment 2 of 2"));

check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
