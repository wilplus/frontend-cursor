/* -------------------------------------------------------------------------- */
/*  The coach panel, redrawn, P1, in a real browser (founder lock 2026-10-06,  */
/*  FOUNDER-LOCK-coach-panel-redesign-2026-10-06).                             */
/*                                                                            */
/*    PANEL_URL=http://localhost:<port>/dev/coach-panel \                     */
/*      SHOTS_DIR=<dir> node e2e/coach-panel.spec.mjs                          */
/*                                                                            */
/*  What this proves: each screen (door, queue, Your speakers, speaker,       */
/*  judge, What happened) draws at phone size (402 x 860) with no page error, nothing on  */
/*  it is a percentage (AC-9), and the overlays cover the screen. Then the    */
/*  real door is driven through the switch (?coach2=1): the bubble opens the  */
/*  queue; Speakers opens every speaker with the orange dot on those waiting  */
/*  (D-CP-12); the speaker's goal and Takes; Judge shows the player, the      */
/*  question and the                                                          */
/*  five answers and NOTHING of the moment — no passage text anywhere in the  */
/*  DOM and no moment read asked for — until the rating is saved; the rating */
/*  moves on by itself with "Answer saved"; the moment read is asked for only */
/*  after the rating PUT; the counter counts moments only; › onto an unrated  */
/*  moment lands on Judge; ‹ goes back through the history and never reopens */
/*  a rated moment's Judge; Next hands the moment to today's answer flow,    */
/*  which hands back to the panel's next open moment. Off (no ?coach2=1), the */
/*  door is today's, unchanged.                                               */
/*                                                                            */
/*  Screenshots of the flow: <SHOTS_DIR>/flow-*.png. SHOTS_DIR defaults to      */
/*  e2e/artifacts/coach-panel (gitignored). The still screens are drawn by    */
/*  the shared harness, e2e/screenshots/capture.mjs, from its manifest.       */
/* -------------------------------------------------------------------------- */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launchChromium } from "./_launch.mjs";

const BASE = process.env.PANEL_URL ?? "http://localhost:3111/dev/coach-panel";
const SHOTS = process.env.SHOTS_DIR ?? "e2e/artifacts/coach-panel";
const VIEWPORT = { width: 402, height: 860 };
mkdirSync(SHOTS, { recursive: true });

const PASSAGES = [
  "We grew revenue forty percent last quarter, and we're ready to scale.",
  "This is the moment the board leans in.",
  "So basically what we're kind of trying to do is grow the team.",
  "And then, well, the numbers.",
];

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

/** The live layer of the stage (never the copy that is leaving). */
const LIVE = "[data-walk-stage] .walk-layer:not(.walk-ghost)";
/** Every text node on the page that is not a script: what the DOM holds. */
const domText = (page) => page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let out = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out += `${n.textContent} `;
  return out;
});
const attrs = (page) => page.evaluate(() =>
  [...document.querySelectorAll("*")].map((el) => [...el.attributes].map((a) => a.value).join(" ")).join(" "));
const calls = (page) => page.evaluate(() => window.__panelCalls ?? []);
const liveText = (page) => page.locator(LIVE).last().innerText();
const navText = (page) => page.locator(`${LIVE} [data-walk-nav]`).last().getAttribute("aria-label");
const settle = (page) => page.waitForTimeout(450);

const browser = await launchChromium();

/* ------------------------------ each screen --------------------------------- */
const KEY = {
  door: '[data-testid="coach-panel-pinned"]',
  queue: `${LIVE} [data-testid="coach-panel-queue"]`,
  speakers: `${LIVE} [data-testid="coach-panel-all-speakers"]`,
  speaker: `${LIVE} [data-testid="coach-panel-speaker"]`,
  judge: `${LIVE} [data-testid="coach-panel-judge"]`,
  reveal: `${LIVE} [data-testid="coach-panel-passage"]`,
  corpushome: `${LIVE} [data-testid="coach-panel-corpushome"] [data-walk-choice]`,
  corpusimport: `${LIVE} [data-testid="coach-panel-corpusimport"]`,
  corpusanalyse: `${LIVE} [data-testid="coach-panel-corpusanalyse"] [data-walk-loading]`,
  corpus: `${LIVE} [data-testid="coach-panel-judge"] [data-walk-player]`,
};
const CORPUS_WORDS = [
  "Our margins held through the second quarter.",
  "I think, maybe, we could consider the other option.",
  "This is where the numbers tell the story.",
];
for (const [screen, selector] of Object.entries(KEY)) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}?screen=${screen}`, { waitUntil: "networkidle" });
  const found = await page.waitForSelector(selector, { timeout: 20000 }).then(() => true, () => false);
  check(`${screen}: draws its key element`, found, selector);
  if (screen !== "door") {
    check(`${screen}: is a full-screen overlay`, await page.evaluate((sel) => {
      const r = document.querySelector(sel)?.closest(".walk-ov")?.getBoundingClientRect();
      return Boolean(r) && r.width === window.innerWidth && r.height === window.innerHeight;
    }, selector));
  }
  const text = await page.evaluate(() => document.body.innerText);
  check(`${screen}: no percentage on screen (AC-9)`, !/\d\s?%/.test(text));
  if (screen === "speakers") {
    const rows = await page.locator(`${LIVE} [data-walk-choice]`).allInnerTexts();
    check("speakers: every speaker, the queue's and the answered ones",
      rows.length === 4 && /Quiet Heron[\s\S]*4 moments waiting/.test(rows[0]) && /Calm Otter[\s\S]*Waiting for the text/.test(rows[1]) &&
      /Bold Finch[\s\S]*All answered · 3 Takes/.test(rows[2]) && /Quick Wren[\s\S]*All answered · 1 Take$/.test(rows[3]), rows.join(" | "));
    check("speakers: the orange dot on the one waiting only",
      (await page.locator(`${LIVE} [data-walk-choice-dot]`).count()) === 1 &&
      (await page.locator(`${LIVE} [data-walk-choice="0"] [data-walk-choice-dot]`).count()) === 1);
    const dom = await domText(page);
    check("speakers: no passage anywhere in the DOM (BLIND COACH)", PASSAGES.every((p) => !dom.includes(p)));
  }
  if (screen === "speaker") {
    check("speaker: the goal under the name", (await liveText(page)).includes("Goal: Sound calm and sure in the board meeting."));
  }
  if (screen === "corpushome") {
    const rows = await page.locator(`${LIVE} [data-walk-choice]`).allInnerTexts();
    check("corpushome: the imports as the prototype draws them",
      rows.length === 3 && /Workshop recording[\s\S]*Set-up not finished · finish it before judging/.test(rows[0]) &&
      /Board update, March[\s\S]*Jane Doe · 3 of 3 moments to judge/.test(rows[1]) && /Keynote rehearsal[\s\S]*Sam Lee · All 8 labelled/.test(rows[2]),
      rows.join(" | "));
    check("corpushome: the pill Import audio", (await page.locator(`${LIVE} [data-walk-pill]`).innerText()) === "Import audio");
  }
  if (screen === "corpusimport") {
    const t = await liveText(page);
    check("corpusimport: the file row and the corpus page's fields, Import off",
      t.includes("Choose a file") && t.includes("Audio or video, up to 30 minutes") && t.includes("What the talk is about") &&
      t.includes("Whose voice this is") && t.includes("What language it is in") && t.includes("Where it came from") && /what to run/i.test(t) &&
      (await page.locator(`${LIVE} [data-testid="corpus-submit"]`).isDisabled()), t.replace(/\n/g, " | ").slice(0, 200));
  }
  if (screen === "corpus") {
    const dom = await domText(page);
    check("corpus: the words of a piece are nowhere in the DOM (N1)", CORPUS_WORDS.every((w) => !dom.includes(w)));
    check("corpus: the judge screen, the topic and the moment counter", (await navText(page)) === "Board update, March · moment 1 of 3", await navText(page));
    check("corpus: the question and the five answers", (await liveText(page)).includes("Does the speaker sound confident here?") &&
      (await page.locator(`${LIVE} [data-walk-answer]`).count()) === 5);
    check("corpus: the clip asked for by snippet through the playback route",
      (await calls(page)).some((c) => c.url.includes("/corpus/clips/") && c.url.endsWith("/playback")));
  }
  if (screen === "judge") {
    const dom = await domText(page);
    check("judge: no passage anywhere in the DOM (BLIND COACH)", PASSAGES.every((p) => !dom.includes(p)));
    check("judge: no kind, no machine read, no slide, no training line",
      !/Private|training|The machine heard|Error|Praise|Rewrite|Slide/.test(await liveText(page)));
    check("judge: no moment read asked for", !(await calls(page)).some((c) => c.url.endsWith("/moment")));
  }
  await settle(page);
  check(`${screen}: no page errors`, errors.length === 0, errors.join(" | "));
  await page.close();
}

/* ----------------------- the flow, through the switch ----------------------- */
{
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}?flow=1&coach2=1`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="coach-panel-pinned"]', { timeout: 20000 });

  // The door.
  const bubble = await page.locator('[data-testid="coach-walk-bubble"]').innerText();
  check("door: the bubble counts speakers waiting", bubble.includes("2 speakers waiting") && bubble.includes("Open your queue"), bubble);
  check("door: two pinned buttons, Speakers and Training corpus",
    (await page.locator('[data-testid="coach-panel-speakers-button"]').innerText()) === "Speakers" &&
    (await page.locator('[data-testid="coach-panel-corpus-button"]').innerText()) === "Training corpus");
  check("door: Training corpus opens inside the panel, not today's corpus page",
    (await page.locator('[data-testid="coach-panel-corpus-button"]').getAttribute("href")) === null);
  check("door: each pinned button has its icon",
    (await page.locator('[data-testid="coach-panel-pinned"] svg').count()) === 2);
  check("door: today's queue button is gone", (await page.getByRole("button", { name: "Your queue", exact: true }).count()) === 0);

  // Speakers: every speaker, the orange dot on those waiting; a speaker with
  // every moment answered opens on their goal and their Takes, all answered.
  await page.locator('[data-testid="coach-panel-speakers-button"]').click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-all-speakers"]`);
  await settle(page);
  let text = await liveText(page);
  check("speakers: Your speakers, every speaker", text.includes("Your speakers") && text.includes("Bold Finch") && text.includes("Quick Wren"));
  check("speakers: no moment read asked for", !(await calls(page)).some((c) => c.url.endsWith("/moment")));
  await page.locator(`${LIVE} [data-walk-choice="2"]`).click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-speaker"]`);
  await settle(page);
  text = await liveText(page);
  check("speaker (all answered): the goal and three answered Takes",
    text.includes("Goal: Open the keynote without notes.") &&
    /Take 3[\s\S]*All moments answered[\s\S]*Take 2[\s\S]*All moments answered[\s\S]*Take 1[\s\S]*All moments answered/.test(text) &&
    (await page.locator(`${LIVE} button[data-walk-choice]`).count()) === 0, text.replace(/\n/g, " | "));
  await page.screenshot({ path: join(SHOTS, "flow-speakers-answered.png") });
  await page.locator(`${LIVE} button[aria-label="Back"]`).last().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-all-speakers"]`);
  await settle(page);
  await page.locator(`${LIVE} button[aria-label="Close"]`).last().click();
  await page.waitForTimeout(500);

  // Training corpus from its pinned button: the imports; an unfinished
  // set-up opens the set-up first; an import's moments are judged blind on
  // the panel's Judge screen and an answer moves on by itself.
  await page.locator('[data-testid="coach-panel-corpus-button"]').click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-corpushome"] [data-walk-choice]`);
  await settle(page);
  check("corpus: Training corpus opens inside the panel", (await liveText(page)).includes("Training corpus"));
  await page.locator(`${LIVE} [data-walk-choice]`).first().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-corpusimport"]`);
  await settle(page);
  text = await liveText(page);
  check("corpus: an unfinished import opens its set-up first", text.includes("Finish the set-up") && text.includes("Before its moments can be judged") &&
    (await page.locator(`${LIVE} [data-testid="corpus-topic"]`).inputValue()) === "Workshop recording" &&
    (await page.locator(`${LIVE} [data-testid="corpus-file"]`).count()) === 0);
  check("corpus: Set up is off until the language is chosen", await page.locator(`${LIVE} [data-testid="corpus-submit"]`).isDisabled());
  await page.locator(`${LIVE} [data-testid="corpus-language"]`).selectOption("en");
  check("corpus: Set up is on with topic and language", !(await page.locator(`${LIVE} [data-testid="corpus-submit"]`).isDisabled()));
  await page.locator(`${LIVE} [data-testid="corpus-submit"]`).click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-corpushome"] [data-walk-choice]`);
  const setupPut = (await calls(page)).find((c) => c.url.includes("/api/v2/coach/training-imports/") && c.method === "PUT");
  check("corpus: the set-up was saved with topic and language", Boolean(setupPut) && setupPut.body?.topic === "Workshop recording" && setupPut.body?.language === "en",
    JSON.stringify(setupPut?.body));
  await settle(page);
  await page.locator(`${LIVE} [data-walk-choice]`).nth(1).click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-judge"] [data-walk-player]`);
  await settle(page);
  check("corpus: judging opens on the panel's Judge screen, moment 1 of 3", (await navText(page)) === "Board update, March · moment 1 of 3", await navText(page));
  let corpusDom = await domText(page);
  check("corpus: no words of any piece in the DOM before the label (N1)", CORPUS_WORDS.every((w) => !corpusDom.includes(w)));
  await page.screenshot({ path: join(SHOTS, "flow-corpus-judge.png") });
  await page.locator(`${LIVE} [data-walk-answer="yes"]`).click();
  await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute("aria-label")?.includes("moment 2 of 3"), `${LIVE} [data-walk-nav]`, { timeout: 10000 }).catch(() => undefined);
  const corpusPut = (await calls(page)).find((c) => c.url.endsWith("/confidence-label") && c.method === "PUT" && c.url.includes("77777777"));
  check("corpus: the label PUT carried the answer and the piece moved on by itself",
    Boolean(corpusPut) && corpusPut.body?.value === "yes" && (await navText(page)) === "Board update, March · moment 2 of 3", String(await navText(page)));
  corpusDom = await domText(page);
  check("corpus: no words of any piece in the DOM after the label either", CORPUS_WORDS.every((w) => !corpusDom.includes(w)));
  await settle(page);
  await page.locator(`${LIVE} button[aria-label="Close"]`).last().click();
  await page.waitForTimeout(500);

  // The queue.
  await page.locator('[data-testid="coach-walk-bubble"]').click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-queue"]`);
  check("queue: rises over the Lounge", (await page.locator(`${LIVE}`).last().getAttribute("data-walk-move")) === "open");
  await settle(page);
  text = await liveText(page);
  check("queue: Your queue, Your speakers", text.includes("Your queue") && /your speakers/i.test(text));
  check("queue: Quiet Heron with 4 moments waiting", text.includes("Quiet Heron") && text.includes("4 moments waiting"));
  check("queue: Calm Otter waiting for the text, not pressable",
    text.includes("Calm Otter") && text.includes("Waiting for the text") &&
    (await page.locator(`${LIVE} div[data-walk-choice]`).count()) === 1);
  check("queue: the blind lines are off, so not drawn", !text.includes("Also waiting") &&
    (await page.locator(`${LIVE} [data-testid="coach-panel-blind"]`).count()) === 0);
  check("queue: no ‹ on the first screen", (await page.locator(`${LIVE} button[aria-label="Back"]`).count()) === 0);
  const shades = await page.locator(`${LIVE} [data-walk-choice]`).evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  check("queue: the choices shade by position (white, then #f7f7f8)",
    shades[0] === "rgb(255, 255, 255)" && shades[1] === "rgb(247, 247, 248)", shades.join(", "));

  // A speaker.
  await page.locator(`${LIVE} [data-walk-choice]`).first().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-speaker"]`);
  await settle(page);
  text = await liveText(page);
  check("speaker: the Takes, newest first, with their moments",
    /Take 2[\s\S]*4 of 4 moments waiting[\s\S]*Take 1[\s\S]*Answered · 3 moments/.test(text), text.replace(/\n/g, " | "));
  check("speaker: the goal under the name", text.includes("Goal: Sound calm and sure in the board meeting."));

  // Judge, blind.
  await page.locator(`${LIVE} button[data-walk-choice]`).first().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-judge"]`);
  await settle(page);
  check("judge: the counter counts moments", (await navText(page)) === "Quiet Heron · moment 1 of 4", await navText(page));
  text = await liveText(page);
  check("judge: the question and the five answers",
    text.includes("Does the speaker sound confident here?") &&
    (await page.locator(`${LIVE} [data-walk-answer]`).allInnerTexts()).join("|") ===
      "Yes — Confident|In-between|No — Not confident|Not sure|Audio unclear");
  check("judge: exactly one player", (await page.locator(`${LIVE} [data-walk-player]`).count()) === 1);
  let dom = await domText(page);
  check("judge: no passage text anywhere in the DOM before the rating", PASSAGES.every((p) => !dom.includes(p)));
  const attrBlob = await attrs(page);
  check("judge: no passage in any attribute either", PASSAGES.every((p) => !attrBlob.includes(p)));
  check("judge: no moment read asked for before the rating", !(await calls(page)).some((c) => c.url.endsWith("/moment")));

  // › onto an unrated moment: Judge. ‹ back.
  await page.locator(`${LIVE} button[aria-label="Next"]`).last().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-judge"]`);
  check("›: moment 2 of 4, unrated, lands on Judge", (await navText(page)) === "Quiet Heron · moment 2 of 4");
  check("›: the content slides, the top bar stays", (await page.locator(LIVE).last().getAttribute("data-walk-move")) === "next");
  await settle(page);
  await page.locator(`${LIVE} button[aria-label="Back"]`).last().click();
  await settle(page);
  check("‹: back to moment 1, still Judge", (await navText(page)) === "Quiet Heron · moment 1 of 4" &&
    (await page.locator(`${LIVE} [data-testid="coach-panel-judge"]`).count()) === 1);
  await page.screenshot({ path: join(SHOTS, "flow-judge.png") });

  // The rating: saved, moves on by itself, then the read.
  await page.locator(`${LIVE} [data-walk-answer="in_between"]`).click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-reveal"]`, { timeout: 10000 });
  const toast = await page.locator("[data-walk-toast]").innerText().catch(() => "");
  check("judge: moves on by itself with the toast", toast === "Answer saved", toast);
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-passage"]`, { timeout: 10000 });
  const log = await calls(page);
  // The speaker's moment (the corpus pieces, labelled earlier in this flow, have their own ids).
  const putAt = log.findIndex((c) => c.url.endsWith("/confidence-label") && c.method === "PUT" && c.url.includes("55555555"));
  const readAt = log.findIndex((c) => c.url.endsWith("/moment"));
  check("the rating PUT carried the answer", putAt >= 0 && log[putAt].body?.value === "in_between", JSON.stringify(log[putAt]?.body));
  check("the moment read was asked for only after the rating PUT", putAt >= 0 && readAt > putAt, `put ${putAt}, read ${readAt}`);
  await settle(page);
  text = await liveText(page);
  check("What happened: the title, the passage with its player",
    text.includes("What happened") && text.includes(PASSAGES[0]) &&
    (await page.locator(`${LIVE} [data-walk-player] [data-testid="coach-panel-passage"]`).count()) === 1);
  const facts = await page.locator(`${LIVE} [data-testid="coach-panel-facts"] > div`).allInnerTexts();
  check("What happened: You / Quiet Heron / The machine heard",
    facts.length === 3 && /^You\s+In-between$/.test(facts[0]) && /^Quiet Heron\s+Not confident$/.test(facts[1]) &&
    /^The machine heard\s+Rushing · Ending compression$/.test(facts[2]), facts.join(" | "));
  check("What happened: the counter still counts moments", (await navText(page)) === "Quiet Heron · moment 1 of 4");
  await page.screenshot({ path: join(SHOTS, "flow-reveal.png") });

  // ‹ never reopens a rated moment's Judge.
  await page.locator(`${LIVE} button[aria-label="Back"]`).last().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-speaker"]`);
  check("‹ from What happened skips the rated Judge, back to the speaker", true);
  await settle(page);

  // Reopen the Take: the first open moment is rated, so What happened.
  await page.locator(`${LIVE} button[data-walk-choice]`).first().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-reveal"]`);
  check("a rated open moment opens on What happened", (await navText(page)) === "Quiet Heron · moment 1 of 4");
  await settle(page);
  await page.locator(`${LIVE} button[aria-label="Next"]`).last().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-judge"]`);
  check("› onto the next, unrated, moment: Judge", (await navText(page)) === "Quiet Heron · moment 2 of 4");
  dom = await domText(page);
  check("that Judge holds no passage of its own moment", !dom.includes(PASSAGES[1]));
  await settle(page);
  await page.locator(`${LIVE} button[aria-label="Back"]`).last().click();
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-reveal"]`);
  await settle(page);

  // Next: today's answer flow takes the moment.
  await page.waitForSelector(`${LIVE} [data-testid="coach-panel-reveal-next"]`);
  await page.locator(`${LIVE} [data-testid="coach-panel-reveal-next"]`).click();
  const handed = await page.waitForSelector('[data-testid="coach-read-sheet"]', { timeout: 10000 }).then(() => true, () => false);
  check("Next hands the moment to today's answer flow (its read screen)", handed);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, "handover-old-read.png") });
  const nothing = page.getByRole("button", { name: "Nothing to add" });
  check("today's flow offers Answer and Nothing to add", (await nothing.count()) >= 1 &&
    (await page.getByRole("button", { name: "Answer", exact: true }).count()) >= 1);
  await nothing.first().click();
  const back = await page.waitForSelector(`${LIVE} [data-testid="coach-panel-judge"]`, { timeout: 10000 }).then(() => true, () => false);
  check("…and hands back to the panel's next open moment, on Judge", back && (await navText(page)) === "Quiet Heron · moment 2 of 4",
    String(await navText(page).catch(() => "")));
  check("the old flow is gone", (await page.locator('[data-testid="coach-read-sheet"]').count()) === 0);
  const resolvedPut = (await calls(page)).some((c) => c.url.endsWith("/exercise-request") && c.method === "PUT" && c.body?.resolution === "no_safe_match");
  check("today's flow saved Nothing to add", resolvedPut);

  // ✕ closes to the Lounge.
  await settle(page);
  await page.locator(`${LIVE} button[aria-label="Close"]`).last().click();
  await page.waitForTimeout(500);
  check("✕ closes to the Lounge", (await page.locator(LIVE).count()) === 0);
  await page.screenshot({ path: join(SHOTS, "flow-closed.png") });
  check("flow: no page errors", errors.length === 0, errors.join(" | "));
  await page.close();
}

/* ----------------------------- the switch off ------------------------------- */
{
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE}?flow=1`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="coach-walk-bubble"]', { timeout: 20000 });
  await page.waitForTimeout(300);
  check("switch off: today's door (its queue button), no pinned buttons",
    (await page.getByRole("button", { name: "Your queue", exact: true }).count()) === 1 &&
    (await page.locator('[data-testid="coach-panel-pinned"]').count()) === 0);
  await page.screenshot({ path: join(SHOTS, "door-switch-off.png") });
  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
