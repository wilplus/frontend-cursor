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
/*                                                                            */
/*  Screenshots: <SHOTS_DIR>/<screen>.png; video: <SHOTS_DIR>/flow.webm.     */
/*  SHOTS_DIR defaults to e2e/artifacts/feedback-walk (gitignored).           */
/* -------------------------------------------------------------------------- */

import { mkdirSync, renameSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { launchChromium } from "./_launch.mjs";

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
  await page.waitForTimeout(400); // let the arrive-animations settle
  await page.screenshot({ path: join(SHOTS, `${screen}.png`) });
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

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
