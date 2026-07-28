/* -------------------------------------------------------------------------- */
/*  Voice-game — the founder's design pass (2026-07-28), in a real browser.    */
/*                                                                            */
/*    GAME_URL=http://localhost:<port>/dev/game node e2e/game.spec.mjs         */
/*                                                                            */
/*  What only an engine can prove: the binary dilemma renders neutral-LEFT /   */
/*  Confident-RIGHT with the big playback hero centered, no transcript on      */
/*  game rounds (ear-first), the explanation lands BELOW inside the same       */
/*  screen with no page scroll, one POST per decision (N3), the toggle keeps   */
/*  game state, and Best voices shows ONE comment (coach overrides system)     */
/*  plus the video when attached.                                              */
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
    const main = document.querySelector("main");
    const slot = main?.parentElement;
    const fits = (el) => !el || el.scrollHeight <= el.clientHeight + 1;
    return fits(main) && fits(slot);
  });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=Does this sound confident?");

/* ------------------------------ the chrome --------------------------------- */
check("the title is Voice-game", (await page.locator("h1", { hasText: "Voice-game" }).count()) === 1);
check(
  "the toggle is small and reads Game / Best voices",
  (await page.locator("button", { hasText: "Game" }).first().count()) === 1 &&
    (await page.locator("button", { hasText: "Best voices" }).count()) === 1 &&
    (await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => x.textContent === "Best voices"
      );
      return (b?.closest("div")?.getBoundingClientRect().width ?? 999) <= 240;
    }))
);
check("the playback hero is big (>=72px button)", await page.evaluate(() => {
  const b = document.querySelector('button[aria-label="Play"]');
  return (b?.getBoundingClientRect().height ?? 0) >= 72;
}));
check(
  "no transcript on game rounds — the guess is by ear",
  !(await page.locator("body").innerText()).includes("tripled revenue")
);
const geometry = await page.evaluate(() => {
  const not = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Not this one")
  );
  const conf = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Confident"
  );
  if (!not || !conf) return null;
  return {
    leftIsNeutral: not.getBoundingClientRect().x < conf.getBoundingClientRect().x,
    confGreen: conf.className.includes("success"),
  };
});
check(
  "neutral grey LEFT, green Confident RIGHT",
  geometry?.leftIsNeutral === true && geometry?.confGreen === true,
  JSON.stringify(geometry)
);
check("no page scroll on the question screen", await noPageScroll(page));

/* --------------------- N3: one POST per decision -------------------------- */
const confBtn = await page
  .locator("button", { hasText: /^Confident$/ })
  .elementHandle();
await page.evaluate((el) => {
  el.click();
  el.click();
}, confBtn);
await page.waitForTimeout(400);
let p = await posts(page);
check(
  "a same-tick double-click still sends exactly ONE answer POST",
  p.filter((x) => x.url.includes("/answers") && x.body?.round_id === "snip-key")
    .length === 1
);
check(
  "the POST body is canonical with a strict boolean",
  JSON.stringify(p[0]?.body) ===
    JSON.stringify({ round_id: "snip-key", answer: true }),
  JSON.stringify(p[0]?.body)
);

/* ------------------ reveal below, same screen, button tint ----------------- */
check(
  "the picked Confident button tints success on a correct call",
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.textContent === "Confident"
    );
    return b?.className.includes("bg-success ") ?? false;
  })
);
check(
  "the explanation lands below: correct + neutral truth + tinted keywords",
  (await page.locator("text=Correct").count()) === 1 &&
    (await page.locator("text=This was one of your key moments.").count()) === 1 &&
    (await page.locator("span.text-primary", { hasText: "tripled" }).count()) === 1
);
check(
  "no raw ** markers leak",
  !(await page.locator("body").innerText()).includes("**")
);
check("the reveal fits the same screen — no page scroll", await noPageScroll(page));

/* ---------------------------- round 2: decoy ------------------------------- */
await page.locator("button", { hasText: "Next" }).click();
await page.waitForTimeout(300);
await page.locator("button", { hasText: /^Confident$/ }).click();
await page.waitForTimeout(400);
p = await posts(page);
check(
  "second decision sends the second POST",
  p.filter((x) => x.url.includes("/answers")).length === 2
);
check(
  "a wrong call tints amber, never red, and the truth line reads neutral (N5)",
  (await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.textContent === "Confident"
    );
    return (b?.className.includes("amber") && !b?.className.includes("red")) ?? false;
  })) &&
    (await page.locator("text=This one was solid — not a key moment.").count()) === 1
);

/* ------------------- toggle: Best voices, state kept ----------------------- */
await page.locator("button", { hasText: "Best voices" }).click();
await page.waitForSelector("text=Your best · 1/2");
check(
  "the quote card renders with the playback hero",
  (await page.locator("text=tripled revenue").count()) === 1 &&
    (await page.locator('button[aria-label="Play"]:visible').count()) === 1
);
check(
  "ONE comment: the coach's note overrides the system's",
  (await page.locator("text=the room leaned in").count()) === 1 &&
    !(await page.locator("body").innerText()).includes(
      "SYSTEM COMMENT THAT MUST NOT RENDER"
    )
);
await page.locator("button", { hasText: "Next" }).click();
await page.waitForTimeout(250);
check(
  "moment 2: the system comment is the fallback, and the coach video renders",
  (await page.locator("text=Steady pace under a hard sentence.").count()) === 1 &&
    (await page.locator("video").count()) === 1
);
check(
  "Back / Next steppers are the neutral black pair",
  await page.evaluate(() => {
    const back = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Back")
    );
    return back?.className.includes("bg-foreground") ?? false;
  })
);
check("no page scroll in Best voices", await noPageScroll(page));

const answersBefore = (await posts(page)).filter((x) => x.url.includes("/answers")).length;
await page.locator("button", { hasText: /^Game$/ }).click();
await page.waitForTimeout(300);
check(
  "toggling back keeps the game where it was (no refetch, verdicts intact)",
  (await page.locator("text=This one was solid — not a key moment.").count()) === 1 &&
    (await posts(page)).filter((x) => x.url.includes("/answers")).length ===
      answersBefore
);

/* ---------------------- finish: library, save, no tally -------------------- */
await page.locator("button", { hasText: "Finish" }).click();
await page.waitForSelector("text=These moments are yours to come back to.");
check(
  "no score, streak, or accuracy anywhere (N2)",
  !/\b\d+\s*\/\s*\d+\b|\b\d+%|\bstreak\b|\bscore\b/i.test(
    await page.locator("body").innerText()
  )
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
