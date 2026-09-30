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
const SNIP_1 = "33333333-3333-3333-3333-333333333331";

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

/* ------------------ answer: Words → Video → Home (error) ------------------ */
await page.locator("button", { hasText: /^Answer$/ }).click();
await page.waitForSelector('[data-testid="coach-words-sheet"]');
await page.waitForFunction(() => (document.querySelector('[data-testid="coach-words-field"]')?.value?.length ?? 0) > 0);
const wordsText = await sheetText();
check("words opens with the model's draft in the field, labelled as the coach's instruction",
  wordsText.includes("Your instruction") && wordsText.includes("Drafted from this moment") &&
  (await page.locator('[data-testid="coach-words-field"]').inputValue()) === "Say the phrase once, then pause." &&
  wordsText.includes(PASSAGE_1));
const draftCall = (await page.evaluate(() => window.__walkCalls)).find((c) => c.url.endsWith("/exercise-request/draft"));
check("the draft was asked for, after the rating", Boolean(draftCall));
await page.locator('[data-testid="coach-words-field"]').fill("Say the whole phrase once, then pause.");
await page.locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector('[data-testid="coach-video-sheet"]');
check("video is the default for an error", (await sheetText()).includes("A video is the default for an error"));
await page.locator('[data-testid="coach-video-file"]').setInputFiles({
  name: "clip.webm", mimeType: "video/webm", buffer: Buffer.from("not really a video"),
});
await page.waitForSelector('[data-testid="coach-video-kept"]');
await page.locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector('[data-testid="coach-home-sheet"]');
const homeText = await sheetText();
check("home asks for a name and the one main target, with what fired chosen",
  homeText.includes("Where it lives") && homeText.includes("Main target") &&
  (await page.locator('[data-testid="coach-home-target"] [aria-pressed="true"]').textContent()).includes("Restarting a phrase"));
check("a named-only error is locked", homeText.includes("Trailing mumble"));
check("share is refused until it has a name", await page.locator('[data-testid="coach-home-primary"]').isDisabled());
await page.locator('[data-testid="coach-home-name"]').fill("Land the last word");
await page.locator('[data-testid="coach-home-primary"]').click();
await page.waitForSelector('[data-testid="coach-judge-sheet"]');
const afterShare = await page.evaluate(() => window.__walkCalls);
const upload = afterShare.find((c) => c.url.includes("/exercises/") && c.url.endsWith("/video"));
const chosen = afterShare.filter((c) => c.url.endsWith("/exercise-request") && c.method === "PUT").pop();
check("share saves the exercise through the upload seam under the request's id, then resolves and shares it",
  Boolean(upload) && decodeURIComponent(upload.url).includes("coach-request-req-" + SNIP_1) &&
  chosen?.body.resolution === "exercise_chosen" && chosen.body.share_with_user === true);
check("the next moment opens on its own", (await sheetText()).includes("Quiet Heron · moment 2 of 2"));

/* --------------------- answer: a praise line, then the Take word ------------ */
await page.locator("button", { hasText: "Yes — Confident" }).click();
await page.waitForSelector('[data-testid="coach-read-sheet"]');
await page.waitForSelector('[data-testid="coach-read-passage"]');
await page.locator("button", { hasText: /^Answer$/ }).click();
await page.waitForSelector('[data-testid="coach-words-sheet"]');
await page.waitForFunction(() => (document.querySelector('[data-testid="coach-words-field"]')?.value?.length ?? 0) > 0);
check("praise words are labelled as praise", (await sheetText()).includes("Your praise"));
await page.locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector('[data-testid="coach-video-sheet"]');
check("video is optional for praise", (await sheetText()).includes("Optional"));
await page.locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector('[data-testid="coach-home-sheet"]');
check("praise home asks for a read or a cue", (await sheetText()).includes("A read or a cue"));
await page.locator('[data-testid="coach-home-primary"]').click();
await page.waitForSelector('[data-testid="coach-word-sheet"]');
const praiseCall = (await page.evaluate(() => window.__walkCalls)).filter((c) => c.url.endsWith("/exercise-request") && c.method === "PUT").pop();
check("a praise line resolves as line_written, shared, with the coach's pattern",
  praiseCall?.body.resolution === "line_written" && praiseCall.body.share_with_user === true &&
  praiseCall.body.answer_text === "You let the number land." && praiseCall.body.pattern_key === "confident_read");
check("after the last moment the word for the Take opens, optional",
  (await sheetText()).includes("A word for this Take") && (await sheetText()).includes("optional"));
await page.locator('[data-testid="coach-word-field"]').fill("Strong Take. Watch the endings.");
await page.locator('[data-testid="coach-word-send"]').click();
await page.waitForFunction(() => !document.querySelector('[data-testid="coach-word-sheet"]'));
const wordCall = (await page.evaluate(() => window.__walkCalls)).find((c) => c.url.endsWith("/word"));
check("the word is saved and shared, and the walk returns to the queue",
  wordCall?.method === "PUT" && wordCall.body.share === true && wordCall.body.text === "Strong Take. Watch the endings.");

check("no page errors", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
