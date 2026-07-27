/* -------------------------------------------------------------------------- */
/*  Confidence game — the interaction contract, driven in a real browser.      */
/*                                                                            */
/*  Run against `next dev` (harness at /dev/game stubs the endpoints and       */
/*  records POSTs on window.__gamePosts):                                      */
/*    GAME_URL=http://localhost:<port>/dev/game node e2e/game.spec.mjs         */
/*                                                                            */
/*  What only an engine can prove: ONE round per screen with no page scroll    */
/*  (founder 2026-07-28), no is-key tell across rounds (N1), exactly one POST  */
/*  per decision even under a same-tick double-click (N3), **kw** spans tint   */
/*  orange (N4), the decoy reveal reads neutral (N5), no tally (N2), and the   */
/*  Game / My best voice toggle preserves game state across switches.          */
/* -------------------------------------------------------------------------- */

import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;

const BASE = process.env.GAME_URL ?? "http://localhost:3111/dev/game";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};
const posts = (page) => page.evaluate(() => window.__gamePosts ?? []);
const noPageScroll = (page) =>
  page.evaluate(() => {
    // The viewport-locked column: neither the main column nor the root
    // layout's content slot may scroll — panes inside may.
    const main = document.querySelector("main");
    const slot = main?.parentElement;
    const fits = (el) => !el || el.scrollHeight <= el.clientHeight + 1;
    return fits(main) && fits(slot);
  });
const transcriptClass = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("p")].find((p) =>
      p.textContent?.includes(t)
    );
    return el?.parentElement?.className ?? "?";
  }, text);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=Round 1 of 2");

/* ------------------------- one screen, no scroll --------------------------- */
check("round 1 renders alone (one round per screen)", (await page.locator("text=Round 2 of 2").count()) === 0);
check("the page does not scroll on the question screen", await noPageScroll(page));
const keyClass = await transcriptClass(page, "tripled revenue");
check("the round transcript renders", keyClass !== "?");

/* --------------------- N3: one POST per decision -------------------------- */
const keyBtnHandle = await page
  .locator("button", { hasText: "Key moment" })
  .first()
  .elementHandle();
await page.evaluate((el) => {
  el.click();
  el.click();
}, keyBtnHandle);
await page.waitForTimeout(400);
let p = await posts(page);
check(
  "a same-tick double-click still sends exactly ONE answer POST (every answer is a peer label)",
  p.filter((x) => x.url.includes("/answers") && x.body?.round_id === "snip-key")
    .length === 1
);
check(
  "the POST body is the canonical shape with a strict boolean",
  JSON.stringify(p[0]?.body) ===
    JSON.stringify({ round_id: "snip-key", answer: true }),
  JSON.stringify(p[0]?.body)
);

/* ------------------- reveal below, same screen, no scroll ------------------ */
check("the verdict shows qualitatively", (await page.locator("text=Correct").count()) === 1);
check(
  "the truth line names the key moment",
  (await page.locator("text=This was one of your key moments.").count()) === 1
);
check(
  "**kw** spans tint orange, not bold (N4)",
  (await page.locator("span.text-primary", { hasText: "tripled" }).count()) === 1
);
check(
  "no raw ** markers leak into the reveal",
  !(await page.locator("body").innerText()).includes("**")
);
check("the reveal fits the same screen — still no page scroll", await noPageScroll(page));
check(
  "the answered round still shows alone; Next replaces, nothing stacks",
  (await page.locator("text=Round 2 of 2").count()) === 0 &&
    (await page.locator("button", { hasText: "Next" }).count()) === 1
);

/* -------------------- round 2 replaces; no is-key tell --------------------- */
await page.locator("button", { hasText: "Next" }).click();
await page.waitForSelector("text=Round 2 of 2");
check(
  "round 1 is gone — the screen was replaced",
  (await page.locator("text=Round 1 of 2").count()) === 0
);
const decoyClass = await transcriptClass(page, "second week of March");
check(
  "key and decoy transcript containers are class-identical — no is-key tell (N1)",
  keyClass === decoyClass && decoyClass !== "?",
  `${keyClass} vs ${decoyClass}`
);

/* --------------------------- decoy reveal (N5) ----------------------------- */
await page.locator("button", { hasText: "Key moment" }).click();
await page.waitForTimeout(400);
p = await posts(page);
check(
  "second decision sends the second POST",
  p.filter((x) => x.url.includes("/answers")).length === 2
);
check(
  "an incorrect guess shows 'Not quite' — and it is NOT styled red",
  (await page.locator("text=Not quite").count()) === 1 &&
    !(
      (await page
        .locator("span", { hasText: "Not quite" })
        .first()
        .getAttribute("class")) ?? ""
    ).includes("red")
);
check(
  "the decoy truth line reads neutral, never as criticism (N5)",
  (await page.locator("text=This one was solid — not a key moment.").count()) === 1
);

/* ------------------- toggle: My best voice, state kept --------------------- */
await page.locator("button", { hasText: "My best voice" }).click();
await page.waitForSelector("text=Moment 1 of 2");
check(
  "My best voice plays the coach-confirmed moments with the explanation below",
  (await page.locator("text=the room leaned in").count()) === 1
);
await page.locator("button", { hasText: "Next" }).last().click();
await page.waitForTimeout(200);
check(
  "the stepper advances one by one",
  (await page.locator("text=Moment 2 of 2").count()) === 1 &&
    (await page.locator("text=Steady pace under a hard sentence.").count()) === 1
);
check("still no page scroll in My best voice", await noPageScroll(page));

const answersBefore = (await posts(page)).filter((x) => x.url.includes("/answers")).length;
await page.locator("button", { hasText: "Game" }).first().click();
await page.waitForTimeout(300);
check(
  "toggling back keeps the game exactly where it was (no refetch, no lost verdicts)",
  (await page.locator("text=Round 2 of 2").count()) === 1 &&
    (await page.locator("text=Not quite").count()) === 1 &&
    (await posts(page)).filter((x) => x.url.includes("/answers")).length ===
      answersBefore
);

/* ---------------------- finish: library, save, no tally -------------------- */
await page.locator("button", { hasText: "Finish" }).click();
await page.waitForSelector("text=These moments are yours to come back to.");
const bodyText = await page.locator("body").innerText();
check(
  "no score, streak, or accuracy anywhere (N2)",
  !/\b\d+\s*\/\s*\d+\b|\b\d+%|\bstreak\b|\bscore\b/i.test(bodyText)
);
await page.locator("button", { hasText: "Save to daily practice" }).click();
await page.waitForTimeout(400);
p = await posts(page);
check(
  "save sends one POST and settles as saved",
  p.filter((x) => x.url.includes("/save")).length === 1 &&
    (await page.locator("text=Saved to daily practice").count()) === 1
);

/* ------------------------------ empty state -------------------------------- */
await page.goto(`${BASE}?arc=arc-empty`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check(
  "zero rounds renders the not-labeled-yet state, not an error",
  (await page.locator("text=hasn't marked key moments here yet").count()) === 1
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
