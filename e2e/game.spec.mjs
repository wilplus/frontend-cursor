/* -------------------------------------------------------------------------- */
/*  Voice-game — the founder's design pass (2026-07-28), in a real browser.    */
/*                                                                            */
/*    GAME_URL=http://localhost:<port>/dev/game node e2e/game.spec.mjs         */
/*                                                                            */
/*  What only an engine can prove: the answer row is the SHARED ternary        */
/*  instrument (Yes / No / Ambiguous — founder 2026-08-10, one label UI on     */
/*  every lane) under the big playback hero, no transcript on game rounds      */
/*  (ear-first), the explanation lands BELOW inside the same screen with no    */
/*  page scroll, one POST per decision (N3), the toggle keeps game state,      */
/*  and Best voices shows ONE comment (coach overrides system) plus the        */
/*  video when attached.                                                       */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE = process.env.GAME_URL ?? "http://localhost:3111/dev/game";

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

const browser = await launchChromium();
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
// 2026-08-10 — the unified ternary instrument (founder: "the confident
// voice label should has the same UI as the coach based labelling and the
// voice game labelling", + the missing idk). The two big outcome-tinting
// buttons are gone; the game renders the SAME three chips every label lane
// renders, and the outcome shows only in the reveal (N5 holds there).
check(
  "the answer row is the shared instrument — Yes / No / Ambiguous, one of each",
  (await page.locator("button", { hasText: /^Yes$/ }).count()) === 1 &&
    (await page.locator("button", { hasText: /^No$/ }).count()) === 1 &&
    (await page.locator("button", { hasText: /^Ambiguous$/ }).count()) === 1
);
check("no page scroll on the question screen", await noPageScroll(page));

/* --------------------- N3: one POST per decision -------------------------- */
const confBtn = await page
  .locator("button", { hasText: /^Yes$/ })
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
  "the POST body is canonical — the ternary answer on the wire",
  JSON.stringify(p[0]?.body) ===
    JSON.stringify({ round_id: "snip-key", answer: "yes" }),
  JSON.stringify(p[0]?.body)
);

/* ------------- reveal below, same screen; the pick stays visible ----------- */
check(
  "the picked chip reads as pressed, and the row is locked after the verdict",
  await page.evaluate(() => {
    const yes = [...document.querySelectorAll("button")].find(
      (x) => x.textContent?.trim() === "Yes"
    );
    return (
      yes?.getAttribute("aria-pressed") === "true" && yes?.disabled === true
    );
  })
);
const head = await page.evaluate(() => {
  const p = [...document.querySelectorAll("p")].find((x) =>
    x.textContent?.includes("The load-bearing words")
  );
  const strong = p?.querySelector("span.font-semibold");
  return { text: p?.textContent ?? "", bold: strong?.textContent ?? "" };
});
check(
  "the verdict is the BOLD head of the comment itself, with the emoji",
  head.bold === "Correct" &&
    head.text.startsWith("Correct 🥳 The load-bearing words"),
  JSON.stringify(head)
);
check(
  "keywords still tint inside that same paragraph",
  (await page.locator("span.text-primary", { hasText: "tripled" }).count()) === 1
);
check(
  "no separate verdict line above the comment (ONE comment)",
  await page.evaluate(
    () =>
      ![...document.querySelectorAll("p")].some(
        (x) => x.textContent?.trim() === "Correct"
      )
  )
);
check(
  "no raw ** markers leak",
  !(await page.locator("body").innerText()).includes("**")
);
check("the reveal fits the same screen — no page scroll", await noPageScroll(page));

/* ---------------------------- round 2: decoy ------------------------------- */
await page.locator("button", { hasText: "Next" }).click();
await page.waitForTimeout(300);
await page.locator("button", { hasText: /^Yes$/ }).click();
await page.waitForTimeout(400);
p = await posts(page);
check(
  "second decision sends the second POST",
  p.filter((x) => x.url.includes("/answers")).length === 2
);
check(
  "a wrong call renders nothing red anywhere (N5 — the reveal carries it)",
  await page.evaluate(() => {
    const cls = [...document.querySelectorAll("button")]
      .map((b) => b.className)
      .join(" ");
    return !cls.includes("red");
  })
);
const wrongHead = await page.evaluate(() => {
  const p = [...document.querySelectorAll("p")].find((x) =>
    x.textContent?.includes("Comfortable pace")
  );
  return {
    text: p?.textContent ?? "",
    bold: p?.querySelector("span.font-semibold")?.textContent ?? "",
  };
});
check(
  "an incorrect call uses the SAME format with NO emoji (N5 — nothing to celebrate at them)",
  wrongHead.bold === "Not quite" &&
    wrongHead.text.startsWith("Not quite Comfortable pace") &&
    !/🥳/.test(await page.locator("body").innerText()),
  JSON.stringify(wrongHead)
);

/* ------------------- toggle: Best voices, state kept ----------------------- */
await page.locator("button", { hasText: "Best voices" }).click();
await page.waitForSelector("text=the room leaned in");
check(
  "no quote card and no 'Your best · N/M' label — the sound and the comment are the screen",
  !(await page.locator("body").innerText()).includes("tripled revenue") &&
    !/Your best/i.test(await page.locator("body").innerText()) &&
    (await page.locator('button[aria-label="Play"]:visible').count()) === 1 &&
    // enabled, i.e. the moment is actually playable here
    (await page.locator('button[aria-label="Play"]:visible').isDisabled()) === false
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
  (await page.locator("text=Not quite Comfortable pace").count()) === 1 &&
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
