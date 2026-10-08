/* -------------------------------------------------------------------------- */
/*  THE RECORDING SCREENS' LOCK, IN A REAL BROWSER (build plan D-RC-8;         */
/*  founder lock 2026-10-07, FOUNDER-LOCK-recording-screens-2026-10-07, N59). */
/*                                                                            */
/*    RECORDING_URL=http://localhost:<port>/dev/recording \                    */
/*      node e2e/recording-screens.spec.mjs                                    */
/*                                                                            */
/*  Runs the /dev/recording harness at 390x844 with touch (a phone) and at    */
/*  1180x860 (a desktop) and proves, screen by screen, what jsdom cannot:     */
/*                                                                            */
/*    - the learning screen's two variants (Scroll down to start / the arrow  */
/*      keys and Click down to start), with no slide, clock or Finish take;  */
/*    - ArrowDown with no click first starts the recording;                   */
/*    - the wheel: a push of 150 moves one slide; 100 then a 300ms rest moves */
/*      one; 60 springs back; a push inside 450ms of a move is ignored;       */
/*    - ↑ and Page Up go back;                                                */
/*    - the top bar and the strip are the SAME DOM nodes across a slide       */
/*      change (the still frame);                                             */
/*    - overscroll-behavior is "none" on the root while the screen is up;    */
/*    - with reduce motion a slide change is instant.                         */
/*                                                                            */
/*  The gesture numbers are read from src/lib/willab/recordingGesture.ts and */
/*  pinned here: a change to any locked constant fails this spec before a    */
/*  single screen is driven.                                                  */
/* -------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { launchChromium } from "./_launch.mjs";

const BASE = process.env.RECORDING_URL ?? "http://localhost:3111/dev/recording";
const PHONE = { name: "phone", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const DESKTOP = { name: "desktop", viewport: { width: 1180, height: 860 }, hasTouch: false, isMobile: false };

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

/* ------------------------ the lock's numbers, pinned ------------------------ */
const GESTURE = readFileSync(new URL("../src/lib/willab/recordingGesture.ts", import.meta.url), "utf8");
const constant = (name) => Number(GESTURE.match(new RegExp(`export const ${name} = (\\d+);`))?.[1]);
const LOCK = {
  TOUCH_COMMIT_PX: 90,
  WHEEL_COMMIT: 140,
  WHEEL_SOFT: 90,
  WHEEL_REST_MS: 220,
  MOMENTUM_MS: 450,
  GLIDE_OUT_MS: 200,
  LAND_MS: 420,
};
for (const [name, value] of Object.entries(LOCK)) {
  check(`the lock's ${name} is ${value}`, constant(name) === value, `found ${constant(name)}`);
}
check("the landing curve is cubic-bezier(.16,1,.3,1)", GESTURE.includes('export const LAND_EASE = "cubic-bezier(.16,1,.3,1)";'));
if (failures) {
  console.error(`\n${failures} locked constant(s) changed; the screens were not driven`);
  process.exit(1);
}
const SETTLE = LOCK.GLIDE_OUT_MS + LOCK.LAND_MS + 150;

/* ------------------------------ helpers ------------------------------------- */
const WHERE = '[data-testid="recording-where"]';
const STRIP = '[data-testid="recording-strip"]';

async function open(browser, device, query, { reduceMotion = false } = {}) {
  const context = await browser.newContext({
    viewport: device.viewport,
    hasTouch: device.hasTouch,
    isMobile: device.isMobile,
    reducedMotion: reduceMotion ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}${query}`, { waitUntil: "networkidle" });
  return { context, page, errors };
}

const whereText = (page) => page.locator(WHERE).textContent().catch(() => null);
const wheel = (page, deltaY) => page.mouse.wheel(0, deltaY);

/** Tag the frame's nodes so identity survives a slide change. */
const tagFrame = (page) =>
  page.evaluate(({ WHERE, STRIP }) => {
    const where = document.querySelector(WHERE);
    const strip = document.querySelector(STRIP);
    if (where) where.__frame = "where";
    if (strip) strip.__frame = "strip";
    return Boolean(where && strip);
  }, { WHERE, STRIP });
const frameKept = (page) =>
  page.evaluate(({ WHERE, STRIP }) => {
    const where = document.querySelector(WHERE);
    const strip = document.querySelector(STRIP);
    return where?.__frame === "where" && strip?.__frame === "strip";
  }, { WHERE, STRIP });

const browser = await launchChromium();

for (const device of [PHONE, DESKTOP]) {
  const tag = `@${device.name}`;

  /* ------------------------- the learning screen --------------------------- */
  {
    const { context, page, errors } = await open(browser, device, "?learn=1");
    const text = await page.evaluate(() => document.body.innerText);
    const phone = device.hasTouch;
    const scroll = page.getByText("Scroll down to start");
    const click = page.getByText("Click down to start");
    check(`${tag} learning: the touch screen reads Scroll down to start, the desktop Click down to start`,
      phone ? (await scroll.isVisible()) && !(await click.isVisible()) : (await click.isVisible()) && !(await scroll.isVisible()));
    check(`${tag} learning: the desktop draws the four arrow keys with the down key lit`,
      phone || (await page.locator(".border-primary.text-primary").count()) === 1);
    check(`${tag} learning: no slide, no clock, no Finish take, no dots`,
      !/Finish take/.test(text) && (await page.locator(".tabular-nums").count()) === 0 &&
      (await page.locator('nav[aria-label="Presentation slide position"]').count()) === 0 &&
      (await page.locator(WHERE).count()) === 0);
    check(`${tag} learning: no number on screen but the stand-in's own (AC-9)`, !/\d\s?%/.test(text));

    // ArrowDown with no click first.
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(SETTLE);
    check(`${tag} ArrowDown with no click starts the recording`,
      (await page.getByText("Finish take").count()) === 1 && (await whereText(page)) === "Take 1 · Slide 1 of 3");
    check(`${tag} learning: no page errors`, errors.length === 0, errors.join(" | "));
    await context.close();
  }

  /* ------------------------------ the wheel -------------------------------- */
  {
    const { context, page, errors } = await open(browser, device, "?take=2&slide=0&t=150");
    await page.waitForSelector(WHERE);
    await page.waitForTimeout(SETTLE);
    check(`${tag} recording: Take 2 · Slide 1 of 3 in the top bar`, (await whereText(page)) === "Take 2 · Slide 1 of 3");
    check(`${tag} recording: the helper words are orange, every one`,
      (await page.locator(".text-primary").filter({ hasText: /Open with the one idea|Show why it matters now/ }).count()) === 2);
    check(`${tag} recording: no line above the strip`,
      !(await page.locator(STRIP).evaluate((el) => getComputedStyle(el).borderTopWidth !== "0px")));

    await tagFrame(page);
    await wheel(page, 150);
    await page.waitForTimeout(SETTLE);
    check(`${tag} wheel 150 moves one slide`, (await whereText(page)) === "Take 2 · Slide 2 of 3");
    check(`${tag} the top bar and the strip are the same nodes after the move (the still frame)`, await frameKept(page));

    // Inside the momentum window a push is ignored.
    await page.waitForTimeout(Math.max(0, LOCK.MOMENTUM_MS - SETTLE - 80));
    await wheel(page, 150);
    await page.waitForTimeout(120);
    check(`${tag} a push within ${LOCK.MOMENTUM_MS}ms of a move is ignored`, (await whereText(page)) === "Take 2 · Slide 2 of 3");
    await page.waitForTimeout(LOCK.MOMENTUM_MS + SETTLE);

    // 100 then a 300ms rest: moves one.
    await wheel(page, 100);
    await page.waitForTimeout(300 + SETTLE);
    check(`${tag} wheel 100 then a 300ms rest moves one slide`, (await whereText(page)) === "Take 2 · Slide 3 of 3");
    await page.waitForTimeout(LOCK.MOMENTUM_MS);

    // Up and Page Up go back.
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(SETTLE);
    check(`${tag} ↑ goes back`, (await whereText(page)) === "Take 2 · Slide 2 of 3");
    await page.keyboard.press("PageUp");
    await page.waitForTimeout(SETTLE);
    check(`${tag} Page Up goes back`, (await whereText(page)) === "Take 2 · Slide 1 of 3");
    await page.waitForTimeout(LOCK.MOMENTUM_MS);

    // 60 springs back.
    await wheel(page, 60);
    await page.waitForTimeout(300 + SETTLE);
    check(`${tag} wheel 60 springs back`, (await whereText(page)) === "Take 2 · Slide 1 of 3");

    check(`${tag} overscroll-behavior is none while the screen is up`,
      (await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehavior)) === "none");
    check(`${tag} recording: no page errors`, errors.length === 0, errors.join(" | "));
    await context.close();
  }

  /* ---------------------------- reduce motion ------------------------------ */
  {
    const { context, page, errors } = await open(browser, device, "?take=2&slide=0&t=150", { reduceMotion: true });
    await page.waitForSelector(WHERE);
    await page.waitForTimeout(200);
    await wheel(page, 150);
    await page.waitForTimeout(40);
    const moved = (await whereText(page)) === "Take 2 · Slide 2 of 3";
    const still = await page.evaluate(() =>
      [...document.querySelectorAll(".will-change-transform")].every((el) => !el.style.transition || el.style.transition === "none"));
    check(`${tag} reduce motion: the slide changes at once, with no transition`, moved && still);
    check(`${tag} reduce motion: no page errors`, errors.length === 0, errors.join(" | "));
    await context.close();
  }
}

/* -------------------------- touch, on the phone only ------------------------ */
{
  const { context, page, errors } = await open(browser, PHONE, "?take=2&slide=0&t=150");
  await page.waitForSelector(WHERE);
  await page.waitForTimeout(SETTLE);
  const swipe = async (dy) => {
    const x = 195;
    const client = await context.newCDPSession(page);
    const y0 = 500;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - dy / 2 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - dy }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
  };
  await swipe(60);
  await page.waitForTimeout(SETTLE);
  check("@phone a swipe under 90px springs back", (await whereText(page)) === "Take 2 · Slide 1 of 3");
  await swipe(120);
  await page.waitForTimeout(SETTLE);
  check("@phone a swipe of 90px or more moves one slide", (await whereText(page)) === "Take 2 · Slide 2 of 3");
  check("@phone touch: no page errors", errors.length === 0, errors.join(" | "));
  await context.close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
