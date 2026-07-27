/* -------------------------------------------------------------------------- */
/*  Key-moments game — the interaction contract, driven in a real browser.     */
/*                                                                            */
/*  Run against `next dev` (harness at /dev/game stubs the endpoints and       */
/*  records POSTs on window.__gamePosts):                                      */
/*    GAME_URL=http://localhost:<port>/dev/game node e2e/game.spec.mjs         */
/*                                                                            */
/*  What only an engine can prove: rounds render with NO is-key tell (N1),     */
/*  exactly one POST leaves per decision even under a double-click (N3),       */
/*  **kw** spans tint orange instead of bolding (N4), the decoy reveal reads   */
/*  neutral (N5), and no tally ever renders (N2).                              */
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

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=Round 1");

/* ----------------------------- N1: no tell -------------------------------- */
check(
  "only the first round shows before it is answered (blind, one at a time)",
  (await page.locator("text=Round 2").count()) === 0
);
const keyBlock = page.locator("text=tripled revenue");
check("the round transcript renders", (await keyBlock.count()) === 1);
// The transcript containers of key and decoy must be class-identical when both
// visible (checked after answering round 1, below).

/* --------------------- N3: one POST per decision -------------------------- */
// Double-fire the SAME button synchronously (two clicks in one task — before
// any re-render can disable it): the ref guard must swallow the second.
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
  p.filter(
    (x) => x.url.includes("/answers") && x.body?.round_id === "snip-key"
  ).length === 1,
  `${p.filter((x) => x.url.includes("/answers")).length} answer posts`
);
check(
  "the POST body is the canonical shape with a strict boolean",
  JSON.stringify(p[0]?.body) === JSON.stringify({ round_id: "snip-key", answer: true }),
  JSON.stringify(p[0]?.body)
);

/* ------------------------- reveal: key moment ------------------------------ */
check("the verdict shows qualitatively", (await page.locator("text=Correct").count()) === 1);
check(
  "the truth line names the key moment",
  (await page.locator("text=This was one of your key moments.").count()) === 1
);
const tinted = page.locator("span.text-primary", { hasText: "tripled" });
check("**kw** spans tint orange, not bold (N4)", (await tinted.count()) === 1);
check(
  "no raw ** markers leak into the reveal",
  !(await page.locator("body").innerText()).includes("**")
);

/* ---------------- round 2 appears only now; classes identical -------------- */
await page.waitForSelector("text=Round 2");
const classes = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll("div")].filter((d) =>
    ["tripled revenue", "second week of March"].some((t) =>
      d.textContent?.includes(t)
    )
  );
  // innermost transcript wrappers
  const wrappers = ["tripled revenue", "second week of March"].map((t) => {
    const el = [...document.querySelectorAll("p")].find((p2) =>
      p2.textContent?.includes(t)
    );
    return el?.parentElement?.className ?? "?";
  });
  void blocks;
  return wrappers;
});
check(
  "key and decoy transcript containers are class-identical — no is-key tell (N1)",
  classes[0] === classes[1] && classes[0] !== "?",
  classes.join(" vs ")
);

/* --------------------------- decoy reveal (N5) ----------------------------- */
await page.locator("button", { hasText: "Key moment" }).last().click();
await page.waitForTimeout(400);
p = await posts(page);
check(
  "second decision sends the second POST",
  p.filter((x) => x.url.includes("/answers")).length === 2
);
check(
  "an incorrect guess shows 'Not quite' — and it is NOT styled red",
  (await page.locator("text=Not quite").count()) === 1 &&
    !(await page
      .locator("span", { hasText: "Not quite" })
      .first()
      .getAttribute("class"))?.includes("red")
);
check(
  "the decoy truth line reads neutral, never as criticism (N5)",
  (await page.locator("text=This one was solid — not a key moment.").count()) === 1
);

/* ------------------------------ N2: no tally ------------------------------- */
const bodyText = await page.locator("body").innerText();
check(
  "no score, streak, or accuracy anywhere (N2)",
  !/\b\d+\s*\/\s*\d+\b|\b\d+%|\bstreak\b|\bscore\b/i.test(bodyText),
  ""
);

/* ------------------------------- save flow -------------------------------- */
const saveBtn = page.locator("button", { hasText: "Save to daily practice" });
check("all rounds answered → the save offer appears", (await saveBtn.count()) === 1);
await saveBtn.click();
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
