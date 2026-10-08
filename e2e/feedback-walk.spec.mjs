/* -------------------------------------------------------------------------- */
/*  The Feedback walk, phase 1, in a real browser (founder lock 2026-10-06).   */
/*                                                                            */
/*    WALK_P1_URL=http://localhost:<port>/dev/feedback-walk \                  */
/*      SHOTS_DIR=<dir> node e2e/feedback-walk.spec.mjs                        */
/*                                                                            */
/*  What this proves: every screen of the locked prototype draws from the     */
/*  walk's primitives at phone size (402 x 860) with no page error and its    */
/*  key element present; the messages carry no sender label; the two small    */
/*  answers are smaller than the three main ones; a chosen answer fills       */
/*  black; "None" stands alone; nothing on any screen is a score (AC-9: no    */
/*  percentage). Then the whole walk is driven through its own buttons in     */
/*  flow mode, checking the move each step plays, and recorded as a video.   */
/*  Last, the practise loop live (D-FW-16) on the PRODUCTION walk (?live=1),  */
/*  its routes answered in the browser and its microphone a tone              */
/*  (_walkPractise.mjs): praise on try 1, praise on try 2, the cap after     */
/*  three tries, and a late read (O5). Then the exercise (D-FW-17): the       */
/*  coach's video in the 4:5 frame with Practise and Skip, Practise opening   */
/*  the same loop on the exercise, and with no video the practise at once.    */
/*  Last, "Judgement time!" (D-FW-18): the intro cross-fades in, its link     */
/*  opens the Journal post inside the overlay (its route answered here) and  */
/*  Back returns; each judgement holds 0.28 s, moves on with "Yes ✓", and ‹   */
/*  reopens it with the earlier answer pressed; then the end card. Skip       */
/*  settles every moment and goes to the end; with no post, no link.         */
/*                                                                            */
/*  Video of the flow: <SHOTS_DIR>/flow.webm. SHOTS_DIR defaults to            */
/*  e2e/artifacts/feedback-walk (gitignored). The still screens are drawn by  */
/*  the shared harness, e2e/screenshots/capture.mjs, from its manifest.       */
/* -------------------------------------------------------------------------- */

import { mkdirSync, renameSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { launchChromium } from "./_launch.mjs";
import {
  TRY_WORDS, liveScreen, routePractise, seedPractise, stopTry, toLiveExercise, toLivePractise,
} from "./_walkPractise.mjs";
import { JOURNAL_POST, routeJournal, toLiveIntro } from "./_walkJudging.mjs";

const BASE = process.env.WALK_P1_URL ?? "http://localhost:3111/dev/feedback-walk";
const SHOTS = process.env.SHOTS_DIR ?? "e2e/artifacts/feedback-walk";
const VIEWPORT = { width: 402, height: 860 };
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

/** The key element each screen must draw. */
const KEY = {
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
  journal: "[data-walk-journal-title]",
  judge: "[data-walk-judgement]",
  community: "[data-walk-options]",
  end: "[data-walk-endsheet]",
};

const browser = await launchChromium();

/* ------------------------------ each screen --------------------------------- */
for (const [screen, selector] of Object.entries(KEY)) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}?screen=${screen}`, { waitUntil: "networkidle" });
  const found = await page.waitForSelector(selector, { timeout: 15000 }).then(() => true, () => false);
  check(`${screen}: draws its key element`, found, selector);
  if (screen !== "end") {
    check(`${screen}: is a full-screen overlay`,
      (await page.locator(`[data-testid="walk-screen-${screen}"]`).count()) === 1 &&
      (await page.evaluate(() => {
        const r = document.querySelector(".walk-ov")?.getBoundingClientRect();
        return Boolean(r) && r.width === window.innerWidth && r.height === window.innerHeight;
      })));
  }
  const text = await page.evaluate(() => document.body.innerText);
  check(`${screen}: no sender label`, !/Your coach|What you said/.test(text));
  check(`${screen}: no percentage on screen (AC-9)`, !/\d\s?%/.test(text));
  if (screen === "intro" || screen === "judge") {
    const overlay = await page.locator(`[data-testid="walk-screen-${screen}"]`).innerText();
    const rest = overlay.replace(/Slide \d+ · moment \d+ of \d+/, "").replace(/\d:\d{2}/g, "");
    check(`${screen}: no number on the overlay beyond the moment's position (AC-9)`, !/\d/.test(rest), rest);
  }
  await page.waitForTimeout(400); // let the arrive-animations settle
  check(`${screen}: no page errors`, errors.length === 0, errors.join(" | "));
  await page.close();
}

/* --------------------------- the judgement screen --------------------------- */
{
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE}?screen=judge`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-walk-judgement]");
  const size = (v) => page.locator(`[data-walk-answer="${v}"]`).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check("the two small answers are smaller than the three main ones",
    (await size("not_sure")) < (await size("yes")) && (await size("audio_unclear")) < (await size("no")));
  await page.locator('[data-walk-answer="in_between"]').click();
  await page.waitForTimeout(220); // the fill is a 0.16 s fade
  const filled = await page.locator('[data-walk-answer="in_between"]').evaluate((el) => getComputedStyle(el).backgroundColor);
  check("a chosen answer fills black", filled === "rgb(18, 18, 18)", filled);
  await page.close();
}

/* ------------------------------- sharing ------------------------------------ */
{
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE}?screen=community`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-walk-options]");
  const ticked = () => page.locator('[role="checkbox"][aria-checked="true"]').count();
  const tap = (v) => page.locator(`[data-walk-option="${v}"] [role="checkbox"]`).click();
  check("Continue waits for a tick", await page.locator('[data-testid="walk-forward"]').isDisabled());
  await tap("general");
  await tap("mine");
  check("several choices may be ticked", (await ticked()) === 2);
  check("a ticked option with a field shows it", (await page.locator('[data-walk-option="mine"] input').count()) === 1);
  await tap("none");
  check("None stands alone", (await ticked()) === 1 &&
    (await page.locator('[data-walk-option="none"] [role="checkbox"]').getAttribute("aria-checked")) === "true");
  await tap("own");
  check("ticking another clears None", (await ticked()) === 1 &&
    (await page.locator('[data-walk-option="none"] [role="checkbox"]').getAttribute("aria-checked")) === "false");
  await page.close();
}

/* --------------------------- the walk, in motion ---------------------------- */
{
  const videoDir = join(SHOTS, "video-tmp");
  rmSync(videoDir, { recursive: true, force: true });
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: videoDir, size: VIEWPORT } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}?flow=1`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="walk-review"]');
  await page.waitForTimeout(600);

  const stepKey = () => page.locator("[data-walk-step]").getAttribute("data-walk-step");
  const moveNow = () => page.locator("[data-walk-move]").last().getAttribute("data-walk-move").catch(() => null);
  const pause = () => page.waitForTimeout(900);
  const moves = [];
  const record = async () => moves.push(`${(await stepKey()).split(":")[1]}:${await moveNow()}`);

  await page.locator('[data-testid="walk-review"]').click();
  await page.waitForSelector('[data-testid="walk-screen-coachnote"]');
  await record();
  check("opening feedback rises", moves.at(-1) === "coachnote:open", moves.at(-1));
  await pause();

  // Forward through the walk with each screen's own buttons.
  for (let guard = 0; guard < 40; guard += 1) {
    const before = await stepKey();
    const key = before.split(":")[1];
    if (key === "end") break;
    if (key === "helpers") {
      await page.locator("[data-walk-word-picker] button").first().click();
      await page.waitForTimeout(250);
    }
    if (key === "community") {
      await page.locator('[data-walk-option="general"] [role="checkbox"]').click();
      await page.waitForTimeout(250);
    }
    if (key === "judge") {
      await page.locator('[data-walk-answer="yes"]').click();
    } else if (key === "processing") {
      // the machine's check answers on its own
    } else if (key === "practise") {
      await page.waitForTimeout(1200);
      await page.locator("[data-walk-recording-strip] button").click();
    } else {
      await page.locator('[data-testid="walk-forward"]').last().click();
    }
    await page.waitForFunction((prev) => document.querySelector("[data-walk-step]")?.getAttribute("data-walk-step") !== prev,
      before, { timeout: 5000 }).catch(() => null);
    await record();
    await pause();
  }
  const has = (m) => moves.includes(m);
  check("next slides: praise → helper words", has("helpers:next"), moves.join(" "));
  check("a practise changing state cross-fades", has("processing:fade") && (has("encourage:fade") || has("improved:fade")));
  check("the screens that stand apart cross-fade", has("intro:fade") && has("community:fade"));
  check("an answer moves on with the toast", has("judge:next") &&
    (await page.locator("[data-walk-toast]").count()) >= 0);
  check("the walk reaches the end card", (await stepKey()).endsWith(":end") &&
    (await page.locator("[data-walk-endsheet]").count()) === 1);

  // Back to the text: the card sinks and the page is there.
  await page.locator('[data-testid="walk-end-back"]').click();
  await page.waitForTimeout(700);
  check("back to the text", (await stepKey()).endsWith(":page"));
  // And once more: open, then back with ‹.
  await page.locator('[data-testid="walk-review"]').click();
  await pause();
  await page.locator('[data-testid="walk-forward"]').last().click();
  await pause();
  await page.locator('[data-walk-nav] button').first().click();
  await page.waitForTimeout(40);
  check("‹ mirrors the move", (await moveNow()) === "back");
  await pause();
  await page.locator('.walk-ov button[aria-label="Close"]').first().click();
  await page.waitForTimeout(80);
  check("✕ sinks the overlay", (await page.locator("[data-walk-ghost].walk-m-close").count()) === 1);
  await page.waitForTimeout(700);

  check("flow: no page errors", errors.length === 0, errors.join(" | "));
  const video = page.video();
  await context.close();
  const path = await video.path();
  if (existsSync(path)) renameSync(path, join(SHOTS, "flow.webm"));
  rmSync(videoDir, { recursive: true, force: true });
  check("the flow video was recorded", existsSync(join(SHOTS, "flow.webm")));
}

/* ------------------------- the practise loop, live -------------------------- */
const LIVE_URL = `${BASE}?live=1`;
const LIVE_LAYER_OF = (key) =>
  `[data-feedback-walk] .walk-layer:not(.walk-ghost):has([data-testid="walk-screen-${key}"])`;
const CM3B = "Great effort! Let's move on and come back to this one later.";
const NX3A = ["Let's try it once more. I have another practice for you!", "Let's give it another go. I have one more practice for you!"];

/** One practise run: the routes answer `answers`, `drive` taps through. */
async function practiseRun(name, answers, drive) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await seedPractise(context);
  const calls = await routePractise(context, answers);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(LIVE_URL, { waitUntil: "networkidle" });
  await toLivePractise(page);
  const shown = async (key) =>
    page.waitForSelector(liveScreen(key), { timeout: 20_000 }).then(() => true, () => false);
  const text = (key) => page.locator(liveScreen(key)).innerText();
  await drive({ page, shown, text, calls });
  const body = await page.evaluate(() => document.body.innerText);
  check(`${name}: no lane, value or score on screen (AC-9)`, !/lane|cue:|1\.37|score|%/i.test(body));
  check(`${name}: no page errors`, errors.length === 0, errors.join(" | "));
  await context.close();
}

await practiseRun("praise on try 1", [{ next: "praise", key: "cue:landed_ending" }], async ({ page, shown, text, calls }) => {
  check("practise: records at once, no title, no slide bar",
    (await page.locator(`${liveScreen("practise")} h2`).count()) === 0 &&
    (await page.locator(`${liveScreen("practise")} [data-walk-nav]`).count()) === 0);
  check("practise on a clearer version: the served line above the words to say",
    (await page.locator(`${liveScreen("practise")} [data-walk-message]`).innerText()) ===
      "Say it this way, and let \u201cprice\u201d land at the end." &&
    (await page.locator(`${liveScreen("practise")} [data-walk-say]`).innerText()) === TRY_WORDS);
  await stopTry(page);
  check("Stop: the voice mark while the machine checks", await shown("processing"));
  check("praise on try 1: the praise after the try", await shown("improved"));
  check("praise on try 1: a line of the signed bank (B07)",
    (await text("improved")).includes("That was great. You weren't asking me"));
  check("Stop went through open, upload and check", calls.join(",") === "open,upload:1,check:praise", calls.join(","));
  await page.locator(`${liveScreen("improved")} [data-testid="walk-forward"]`).click();
  check("praise → helper words from the try's own words", await shown("helpers") &&
    (await page.locator(`${liveScreen("helpers")} [data-walk-word-picker] button`).allInnerTexts()).join(" ") === TRY_WORDS);
  check("helper words: the prototype's subtitle under the title",
    (await page.locator(`${liveScreen("helpers")} [data-walk-subtitle]`).innerText()) ===
      "These words show while you record your next take");
});

await practiseRun("praise on try 2", [{ next: "again", key: "effort" }, { next: "praise", key: "more_assured" }],
  async ({ page, shown, text }) => {
    await stopTry(page);
    check("try 1 not yet: the encouragement (NX3a)", await shown("encourage") && (await text("encourage")).includes(NX3A[0]));
    await page.locator(`${liveScreen("encourage")} [data-testid="walk-forward"]`).click();
    check("Continue: the next try records", await shown("practise"));
    await stopTry(page);
    check("praise on try 2", await shown("improved") &&
      (await text("improved")).includes("Sounded more confident than usual!"));
  });

await practiseRun("the cap", [{ next: "again", key: "effort" }, { next: "again", key: "effort" }, { next: "moved_on", key: "CM3b" }],
  async ({ page, shown, text, calls }) => {
    for (const line of NX3A) {
      await stopTry(page);
      check(`a try that is not praise: "${line.slice(0, 22)}…"`, await shown("encourage") && (await text("encourage")).includes(line));
      await page.locator(`${liveScreen("encourage")} [data-testid="walk-forward"]`).click();
      await shown("practise");
    }
    await stopTry(page);
    check("after the third try: a CM3b line", await shown("thanks") && (await text("thanks")).includes(CM3B));
    check("three tries, three checks", calls.filter((c) => c.startsWith("check:")).length === 3, calls.join(","));
    await page.locator(`${liveScreen("thanks")} [data-testid="walk-forward"]`).click();
    // The next moment's exercise, then "Judgement time!" (D-FW-18).
    check("then the walk moves on", await shown("exVideo"));
  });

await practiseRun("a late read", ["hang"], async ({ page, shown }) => {
  await stopTry(page);
  check("a late read (O5): Next and Practise again", await shown("late") &&
    (await page.locator(`${liveScreen("late")} [data-testid="walk-forward"]`).innerText()) === "Next" &&
    (await page.locator(`${liveScreen("late")} [data-testid="walk-again"]`).innerText()) === "Practise again");
  await page.locator(`${liveScreen("late")} [data-testid="walk-again"]`).click();
  check("Practise again records the next try", await shown("practise"));
});

/* ----------------------------- the exercise --------------------------------- */
/** One exercise run on the live walk: `query` adds to ?live=1. */
async function exerciseRun(name, query, drive) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await seedPractise(context);
  const calls = await routePractise(context, []);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const bodies = [];
  page.on("request", (r) => {
    if (r.url().includes("/snippets/") && r.url().endsWith("/confidence-practice")) bodies.push(r.postDataJSON());
  });
  await page.goto(`${LIVE_URL}${query}`, { waitUntil: "networkidle" });
  await toLiveExercise(page);
  const shown = async (key) =>
    page.waitForSelector(liveScreen(key), { timeout: 20_000 }).then(() => true, () => false);
  await drive({ page, shown, calls, bodies });
  const body = await page.evaluate(() => document.body.innerText);
  check(`${name}: never the coach still working (WQ2 B)`, !body.includes("Your coach is working on your exercise."));
  check(`${name}: no score on screen (AC-9)`, !/score|%/i.test(body));
  check(`${name}: no page errors`, errors.length === 0, errors.join(" | "));
  await context.close();
}

await exerciseRun("the exercise video", "", async ({ page, shown, calls, bodies }) => {
  check("the exercise: its video, under the moment bar", await shown("exVideo") &&
    (await page.locator(`${liveScreen("exVideo")} [data-walk-nav]`).count()) === 1);
  const ratio = await page.locator(`${liveScreen("exVideo")} [data-coach-video] video`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width / r.height;
  });
  check("the video sits in the 4:5 frame", Math.abs(ratio - 0.8) < 0.01, String(ratio));
  check("Practise and Skip",
    (await page.locator(`${liveScreen("exVideo")} [data-testid="walk-forward"]`).innerText()) === "Practise" &&
    (await page.locator(`${liveScreen("exVideo")} [data-testid="walk-skip"]`).innerText()) === "Skip");
  const before = calls.filter((c) => c === "open").length;
  await page.locator(`${liveScreen("exVideo")} [data-testid="walk-forward"]`).click();
  check("Practise opens the practise loop, recording at once", await shown("practise") &&
    (await page.locator(`${liveScreen("practise")} [data-walk-recording-strip]`).count()) === 1);
  check("its instruction, then the words to say",
    (await page.locator(`${liveScreen("practise")} [data-walk-message]`).innerText()).includes("Slow down on") &&
    (await page.locator(`${liveScreen("practise")} [data-walk-say]`).innerText()) === "Two hires by March keep that lead.");
  await page.waitForTimeout(400);
  check("opened on the exercise", calls.filter((c) => c === "open").length === before + 1 &&
    bodies.at(-1)?.kind === "exercise" && bodies.at(-1)?.exercise_id === "harness-exercise", JSON.stringify(bodies.at(-1)));
});

await exerciseRun("Skip on the exercise", "", async ({ page, shown }) => {
  await shown("exVideo");
  await page.locator(`${liveScreen("exVideo")} [data-testid="walk-skip"]`).click();
  check("Skip moves on past the exercise, to \"Judgement time!\"", await shown("intro"));
});

await exerciseRun("no video at all", "&exvideo=0", async ({ page, shown }) => {
  check("with no video, straight to the practise", await shown("practise") &&
    (await page.locator(`${liveScreen("practise")} [data-walk-message]`).count()) === 1 &&
    (await page.locator("[data-testid='walk-screen-exVideo']").count()) === 0);
});

/* ----------------------------- "Judgement time!" ---------------------------- */
/** One judging run on the live walk; `journal` answers the post's route. */
async function judgingRun(name, journal, drive) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await routeJournal(context, journal);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(LIVE_URL, { waitUntil: "networkidle" });
  await toLiveIntro(page);
  const shown = async (key) =>
    page.waitForSelector(liveScreen(key), { timeout: 20_000 }).then(() => true, () => false);
  const tapIn = (key, testId) => page.locator(`${liveScreen(key)} [data-testid="${testId}"]`).click({ timeout: 20_000 });
  const judged = () => page.locator("[data-walk-harness]").getAttribute("data-walk-judged");
  await drive({ page, shown, tapIn, judged });
  const body = await page.evaluate(() => document.body.innerText);
  check(`${name}: no score on screen (AC-9)`, !/score|%/i.test(body));
  check(`${name}: no page errors`, errors.length === 0, errors.join(" | "));
  await context.close();
}

await judgingRun("intro → journal → judge → end", "published", async ({ page, shown, tapIn, judged }) => {
  check("the intro cross-fades in", (await page.locator(`${LIVE_LAYER_OF("intro")}`).getAttribute("data-walk-move")) === "fade");
  const intro = await page.locator(liveScreen("intro")).innerText();
  check("the intro: the signed words", intro.includes("Judgement time!") &&
    intro.includes("I am going to judge them honestly") && intro.includes("Skip") &&
    intro.includes("More about self-modeling theory"));
  await tapIn("intro", "walk-journal");
  check("the link opens the Journal post inside the overlay", await shown("journal") &&
    (await page.locator(`${liveScreen("journal")} [data-walk-eyebrow]`).innerText()).toLowerCase() === "journal" &&
    (await page.locator(`${liveScreen("journal")} [data-walk-journal-title]`).innerText()) === JOURNAL_POST.title &&
    (await page.locator("[data-walk-stage]").count()) === 1);
  await tapIn("journal", "walk-journal-back");
  check("Back returns to the intro", await shown("intro"));
  await tapIn("intro", "walk-forward");
  check("I am going to judge them honestly: the first judgement", await shown("judge"));
  await page.locator(`${liveScreen("judge")} [data-walk-answer="yes"]`).click();
  await page.waitForTimeout(150);
  check("the answer holds before it moves on",
    (await page.locator(`${liveScreen("judge")} [data-walk-answer="yes"][aria-pressed="true"]`).count()) === 1 &&
    (await page.locator("[data-walk-toast]").count()) === 0);
  await page.waitForSelector("[data-walk-toast]", { timeout: 5000 });
  check("then moves on with the toast", (await page.locator("[data-walk-toast]").innerText()) === "Yes ✓" &&
    (await page.locator(`${liveScreen("judge")} [data-walk-nav]`).getAttribute("aria-label")).includes("moment 2 of 4"));
  await page.locator(`${liveScreen("judge")} [data-walk-nav] button`).first().click();
  await page.waitForTimeout(500);
  check("‹ reopens the judgement with the earlier answer pressed",
    (await page.locator(`${liveScreen("judge")} [data-walk-nav]`).getAttribute("aria-label")).includes("moment 1 of 4") &&
    (await page.locator(`${liveScreen("judge")} [data-walk-answer="yes"][aria-pressed="true"]`).count()) === 1);
  await page.locator(`${liveScreen("judge")} [data-walk-answer="no"]`).click();
  for (let i = 2; i <= 4; i += 1) {
    await page.waitForFunction((n) => document.querySelector(
      '[data-feedback-walk] .walk-layer:not(.walk-ghost) [data-testid="walk-screen-judge"] [data-walk-nav]',
    )?.getAttribute("aria-label")?.includes(`moment ${n} of 4`), i, { timeout: 10_000 });
    await page.locator(`${liveScreen("judge")} [data-walk-answer="in_between"]`).click();
  }
  check("the last judgement leads to sharing (D-FW-20)", await shown("community"));
  await page.locator(`${liveScreen("community")} [data-walk-option="none"] [role="checkbox"]`).click();
  await tapIn("community", "walk-forward");
  check("\"None\" takes the share back, then the end card",
    await page.waitForSelector("[data-walk-endsheet]", { timeout: 10_000 }).then(() => true, () => false) &&
    (await page.locator("[data-walk-harness]").getAttribute("data-walk-shared")) === "none");
  await page.waitForTimeout(700);
  check("no toast sits on the end card's pill", (await page.locator("[data-walk-toast]").count()) === 0);
  check("each answer handed over once, a change with the earlier answer",
    (await judged()) === "cv-0:yes|cv-0:no<yes|cv-1:in_between|cv-2:in_between|cv-3:in_between", await judged());
});

await judgingRun("Skip on Judgement time!", "published", async ({ page, shown, tapIn, judged }) => {
  await tapIn("intro", "walk-skip");
  check("Skip settles every moment and still asks to share (Q-B6 A)",
    (await shown("community")) &&
    (await judged()) === "cv-0:skipped|cv-1:skipped|cv-2:skipped|cv-3:skipped", await judged());
  await page.locator(`${liveScreen("community")} [data-walk-option="general"] [role="checkbox"]`).click();
  await tapIn("community", "walk-forward");
  check("a share carries the signed words' version, then the end card",
    await page.waitForSelector("[data-walk-endsheet]", { timeout: 10_000 }).then(() => true, () => false) &&
    (await page.locator("[data-walk-harness]").getAttribute("data-walk-shared")) === "general,sharing-screen-2026-10-06");
});

await judgingRun("no post to open", "missing", async ({ page }) => {
  check("with no post, no link", (await page.locator(`${liveScreen("intro")} [data-testid="walk-journal"]`).count()) === 0 &&
    !(await page.locator(liveScreen("intro")).innerText()).includes("More about self-modeling theory"));
});

/* ------------------- desktop: the phone's column, centred ------------------- */
/* Founder 2026-10-08, Q-WALK-DESK A: on a desktop the walk is the phone's
   column on the same white; the top bar, the content and the actions all sit
   in it. The overlay itself still covers the screen. */
{
  const DESK = { width: 1440, height: 900 };
  const COLUMN = 430;
  const context = await browser.newContext({ viewport: DESK });
  await routeJournal(context, "published");
  const page = await context.newPage();
  await page.goto(LIVE_URL, { waitUntil: "networkidle" });
  await page.waitForSelector(liveScreen("coachnote"), { timeout: 20_000 });
  await page.waitForTimeout(600);
  const inColumn = (key) => page.evaluate(([sel, col]) => {
    const ov = document.querySelector(sel);
    if (!ov) return { ok: false, why: "no overlay" };
    const r = ov.getBoundingClientRect();
    const left = (window.innerWidth - col) / 2 - 1;
    const right = (window.innerWidth + col) / 2 + 1;
    const parts = [...ov.children].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0);
    const buttons = [...ov.querySelectorAll("button, video, [data-coach-video]")]
      .map((b) => b.getBoundingClientRect()).filter((b) => b.width > 0);
    const outside = [...parts, ...buttons].filter((b) => b.left < left || b.right > right);
    return { ok: r.width === window.innerWidth && r.height === window.innerHeight && outside.length === 0 && parts.length > 1,
      why: `overlay ${r.width}x${r.height}, ${outside.length} outside the column` };
  }, [liveScreen(key), COLUMN]);
  let r = await inColumn("coachnote");
  check("desktop: the coach's note sits in the centred column on a full white overlay", r.ok, r.why);
  await page.locator(`${liveScreen("coachnote")} [data-testid="walk-forward"]`).click();
  await page.waitForTimeout(600);
  r = await inColumn("praise");
  check("desktop: a praise sits in the column", r.ok, r.why);
  await page.close();
  await context.close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
