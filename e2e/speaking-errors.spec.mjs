/* -------------------------------------------------------------------------- */
/*  The speaking error library — the coach's door, in a real browser.          */
/*                                                                            */
/*    LIBRARY_URL=http://localhost:<port>/dev/speaking-errors \                */
/*      node e2e/speaking-errors.spec.mjs                                      */
/*                                                                            */
/*  One distinction carries this surface: `detected` routes exercises,         */
/*  `observed` is the backlog. Saving over a detected entry would demote it    */
/*  and SILENTLY stop it routing — no exception, no log, nothing to notice.    */
/*  The database and the service both refuse it; this spec proves the screen   */
/*  makes an author never try, and that the refusal arrives as a sentence.     */
/*                                                                            */
/*  The harness answers the library endpoint itself, including the service's   */
/*  409, so the refusal path is exercised rather than assumed.                 */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE =
  process.env.LIBRARY_URL ?? "http://localhost:3111/dev/speaking-errors";

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
await page.waitForSelector("text=Speaking errors");

/* --------------------------- the two groups -------------------------------- */

/** The text of the section whose h2 starts with `heading`. Scoped on purpose:
 *  asserting on the whole document stays true if the groups are swapped, which
 *  is the one mistake that matters here. */
const sectionText = (heading) =>
  page.evaluate((h) => {
    const s = [...document.querySelectorAll("section")].find((el) =>
      el.querySelector("h2")?.textContent?.startsWith(h),
    );
    return s?.textContent ?? "";
  }, heading);

const routes = await sectionText("Detected in audio");
const named = await sectionText("Named only");

check(
  "what routes exercises is listed apart from what only has a name",
  routes.includes("Rushing") &&
    !routes.includes("Trailing mumble") &&
    named.includes("Trailing mumble") &&
    !named.includes("Rushing"),
);
check(
  "a detected entry names the thing doing the measuring",
  routes.includes("insufficient_pauses,irregular_rushed_pacing"),
);
check(
  "a named-only entry says plainly that it routes nothing yet",
  named.includes("routes nothing until a detector is written") &&
    !routes.includes("routes nothing until a detector is written"),
);
check(
  "every entry shows its written definition AND its one question",
  routes.includes("pause_ratio < 0.08") &&
    routes.includes("Did this passage give the listener room to follow it?") &&
    named.includes("Did the speaker carry the end of the sentence?"),
);

/* ---------------------------- naming a pattern ----------------------------- */

await page.locator("button", { hasText: /^Name a pattern$/ }).click();
await page
  .locator('[placeholder="Trailing mumble"]')
  .fill("Swallowed consonants");
await page
  .locator('[placeholder^="The last words"]')
  .fill("Stops at the end of words are dropped, so adjacent words run together.");
await page
  .locator('[placeholder^="Did the speaker carry"]')
  .fill("Were the word endings articulated?");
await page.locator("button", { hasText: /^File it$/ }).click();
await page.waitForSelector("text=is filed");

const posted = await page.evaluate(
  () => (window.__libraryCalls ?? []).filter((c) => c.method === "POST"),
);
check(
  "the id is derived from the name, so a wrong shape is not the author's job",
  posted[0]?.body?.error_id === "swallowed_consonants",
  JSON.stringify(posted[0]?.body?.error_id),
);
check(
  "the write never claims a status — a name cannot make a detector exist",
  posted.length === 1 && !("status" in (posted[0]?.body ?? {})),
);
check(
  "the write never sends observed_by — provenance is who the server saw (L3)",
  !("observed_by" in (posted[0]?.body ?? {})),
);
check(
  "the filed pattern lands in the named-only group",
  (await sectionText("Named only")).includes("Swallowed consonants") &&
    !(await sectionText("Detected in audio")).includes("Swallowed consonants"),
);

/* ------------------- the refusal that protects live routing ---------------- */

await page.locator("button", { hasText: /^Name a pattern$/ }).click();
await page.locator('[placeholder="Trailing mumble"]').fill("Rushing");
await page.locator('[placeholder^="The last words"]').fill("x");
await page.locator('[placeholder^="Did the speaker carry"]').fill("y");
await page.locator("button", { hasText: /^File it$/ }).click();
await page.waitForSelector("text=silently stop it routing");

check(
  "saving over a detected entry is refused, and says what it would have cost",
  (await page.locator("text=silently stop it routing exercises").count()) === 1,
);
check(
  "the draft survives the refusal rather than making them retype it",
  (await page.locator('[placeholder="Trailing mumble"]').count()) === 1,
);

/* ---------------------------- a bad id, locally ---------------------------- */

await page.locator('[placeholder="trailing_mumble"]').fill("Word Compression");
await page.locator("button", { hasText: /^File it$/ }).click();
check(
  "an id that would match nothing is refused BEFORE it is sent",
  (await page.locator("text=match nothing").count()) === 1 &&
    (await page.evaluate(
      () => (window.__libraryCalls ?? []).filter((c) => c.method === "POST").length,
    )) === 2, // the 409 attempt, and nothing since
);

check("no uncaught page errors", pageErrors.length === 0, pageErrors.join(" | "));

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall ok");
process.exit(failures ? 1 : 0);
