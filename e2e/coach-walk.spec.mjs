/* -------------------------------------------------------------------------- */
/*  The coach's walk, screens 1 to 7, in a real browser (groups 3 and 4).      */
/*                                                                            */
/*    WALK_URL=http://localhost:<port>/dev/coach-walk node e2e/coach-walk.spec.mjs */
/*                                                                            */
/*  What this proves, in order: the Lounge door counts speakers, not quality;  */
/*  the Queue says one word per moment and no kind before a rating; the Judge  */
/*  sheet shows the clip and the question only, and nothing of the moment     */
/*  (passage, kind, what fired, the slide) is on the page before the rating   */
/*  is saved; the rating PUT carries the answer; Read then shows the slide as */
/*  a thumbnail (B5), the passage, both answers as words, what fired by its   */
/*  name and the library line; then one answer of each kind is walked end to  */
/*  end through Words, Video and Home (P2-11): an error becomes a library     */
/*  exercise, a praise line is filed and shared, a clearer version is shared  */
/*  with its move and never reaches the library; after the last moment the    */
/*  word for the Take opens.                                                  */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE = process.env.WALK_URL ?? "http://localhost:3111/dev/coach-walk";
const PASSAGE_1 = "We, we rebuilt the, the pipeline from scratch.";
const PASSAGE_3 = "So the thing is that we, um, need more time to ship it.";
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
/** The Read thumbnail's accessible name (the slide's own title first), or ""
 *  when there is none: a missing slide must print FAIL, not time out. */
const readSlideLabel = async () => {
  await page.waitForSelector('[data-testid="coach-read-slide"] [role="img"]', { timeout: 5000 }).catch(() => null);
  return page.evaluate(() =>
    document.querySelector('[data-testid="coach-read-slide"] [role="img"]')?.getAttribute("aria-label") ?? "");
};

/* ------------------------------ the door ----------------------------------- */
// Two: Quiet Heron with moments to judge, Calm Otter with a Take still
// waiting for its text (founder 2026-10-01, A1: listed, never absent).
check("the bubble counts speakers waiting, in words",
  (await page.locator('[data-testid="coach-walk-bubble"]').textContent()).includes("2 speakers waiting"));

await page.locator('[data-testid="coach-walk-bubble"]').click();
await page.waitForSelector('[data-testid="coach-queue"]');
const queueText = await page.locator('[data-testid="coach-queue"]').textContent();
check("the queue lists the speaker, the take and one word per moment",
  queueText.includes("Quiet Heron") && queueText.includes("Take 2 · 3 moments") &&
  queueText.includes("Judge it") && queueText.includes("Calm Otter"));
check("a take whose bookmarks are not frozen yet says so, with no moment to judge",
  queueText.includes("Waiting for the text") &&
  (await page.locator('[data-testid="coach-queue-waiting-for-text"]').count()) === 1);
check("no kind is on the queue before a rating", !queueText.includes("Error"));

/* ------------------------------ judge -------------------------------------- */
await page.locator('[data-testid="coach-queue-moment"]').first().click();
await page.waitForSelector('[data-testid="coach-judge-sheet"]');
const judgeText = await sheetText();
check("the judge sheet asks the one question with the coach's words",
  judgeText.includes("Judge this moment") && judgeText.includes("Does the speaker sound confident here?") &&
  judgeText.includes("Private · training · saved on tap") && judgeText.includes("Quiet Heron · moment 1 of 3"));
check("nothing of the moment is on the page before the rating, the slide included",
  !judgeText.includes(PASSAGE_1) && !judgeText.includes("Restarting a phrase") && !judgeText.includes("Error") &&
  !judgeText.includes("Main premise") && (await page.locator('[data-testid="coach-read-slide"]').count()) === 0);
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
check("read shows the slide the moment began on, as a thumbnail (B5)",
  (await readSlideLabel()).startsWith("Main premise"));

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
check("the next moment opens on its own", (await sheetText()).includes("Quiet Heron · moment 2 of 3"));

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
await page.waitForSelector('[data-testid="coach-judge-sheet"]');
const praiseCall = (await page.evaluate(() => window.__walkCalls)).filter((c) => c.url.endsWith("/exercise-request") && c.method === "PUT").pop();
check("a praise line resolves as line_written, shared, with the coach's pattern",
  praiseCall?.body.resolution === "line_written" && praiseCall.body.share_with_user === true &&
  praiseCall.body.answer_text === "You let the number land." && praiseCall.body.pattern_key === "confident_read");
check("the rewrite moment opens on its own after the praise", (await sheetText()).includes("Quiet Heron · moment 3 of 3"));

/* ------------- answer: a clearer version, end to end (P2-11) --------------- */
const callsBeforeRewrite = (await page.evaluate(() => window.__walkCalls)).length;
await page.locator("button", { hasText: "In-between" }).click();
await page.waitForSelector('[data-testid="coach-read-sheet"]');
await page.waitForSelector('[data-testid="coach-read-passage"]');
const rewriteRead = await sheetText();
check("read names the kind Rewrite, the passage, both answers, and that nothing fired",
  rewriteRead.includes("Rewrite") && rewriteRead.includes(PASSAGE_3) &&
  rewriteRead.includes("You: In-between") && rewriteRead.includes("Quiet Heron: In-between") &&
  rewriteRead.includes("Nothing fired."));
check("its slide is the one this moment began on", (await readSlideLabel()).startsWith("Conclusion"));
await page.locator("button", { hasText: /^Answer$/ }).click();
await page.waitForSelector('[data-testid="coach-words-sheet"]');
await page.waitForFunction(() => (document.querySelector('[data-testid="coach-words-field"]')?.value?.length ?? 0) > 0);
const rewriteWords = await sheetText();
check("words opens with the model's clearer version in the field, under the passage the speaker will say",
  rewriteWords.includes("Your clearer version") && rewriteWords.includes("Drafted from this moment") &&
  (await page.locator('[data-testid="coach-words-field"]').inputValue()) === "We need more time to ship it." &&
  rewriteWords.includes("The passage Quiet Heron will say") && rewriteWords.includes(PASSAGE_3));
const rewriteDraft = (await page.evaluate(() => window.__walkCalls)).slice(callsBeforeRewrite)
  .find((c) => c.url.endsWith("/exercise-request/draft"));
check("the clearer version was drafted for this moment, after its rating",
  Boolean(rewriteDraft) && decodeURIComponent(rewriteDraft.url).includes("33333333-3333-3333-3333-333333333333"));
await page.locator('[data-testid="coach-words-field"]').fill("We need two more weeks to ship it.");
await page.locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector('[data-testid="coach-video-sheet"]');
const rewriteVideo = await sheetText();
check("video is optional for a rewrite: Next is the primary, a video only on request",
  rewriteVideo.includes("Optional") && rewriteVideo.includes("Add a video") &&
  (await page.locator('[data-testid="coach-video-record"]').count()) === 0);
await page.locator("button", { hasText: /^Next$/ }).click();
await page.waitForSelector('[data-testid="coach-home-sheet"]');
const rewriteHome = await sheetText();
check("home asks for the move, the three moves and nothing of the library's exercise form",
  rewriteHome.includes("The move") && rewriteHome.includes("drop the filler") &&
  rewriteHome.includes("split the clause") && rewriteHome.includes("repair the structure") &&
  (await page.locator('[data-testid="coach-home-name"]').count()) === 0 &&
  (await page.locator('[data-testid="coach-home-target"]').count()) === 0);
await page.locator('[data-testid="coach-home-pattern"] button', { hasText: "split the clause" }).click();
check("the chosen move is marked",
  (await page.locator('[data-testid="coach-home-pattern"] [aria-pressed="true"]').textContent()) === "split the clause");
check("share is open without a name or a video", !(await page.locator('[data-testid="coach-home-primary"]').isDisabled()));
await page.locator('[data-testid="coach-home-primary"]').click();
await page.waitForSelector('[data-testid="coach-word-sheet"]');
const rewriteCalls = (await page.evaluate(() => window.__walkCalls)).slice(callsBeforeRewrite);
const versionCall = rewriteCalls.filter((c) => c.url.endsWith("/exercise-request") && c.method === "PUT").pop();
check("a clearer version resolves as version_written, shared, with the coach's words and move",
  versionCall?.body.resolution === "version_written" && versionCall.body.share_with_user === true &&
  versionCall.body.answer_text === "We need two more weeks to ship it." &&
  versionCall.body.pattern_key === "split_the_clause" && !("file_in_catalogue" in versionCall.body),
  JSON.stringify(versionCall?.body));
check("a clearer version never reaches the library: no catalogue line, no exercise, no video upload (C4)",
  !rewriteCalls.some((c) => c.url.includes("/api/v2/coach/catalogue") || c.url.includes("/api/v2/coach/exercises/") ||
    c.url.endsWith("/exercise-request/video")));
check("the toast says it went to the speaker only",
  (await page.locator('[role="status"]').allTextContents()).some((t) => t.trim() === "Shared with Quiet Heron"));
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
