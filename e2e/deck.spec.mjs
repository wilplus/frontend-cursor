/* -------------------------------------------------------------------------- */
/*  Transcript review deck — chunk states, lock routing, decide + lock wiring, */
/*  in a real browser through the REAL host (founder 2026-08-11 spec).         */
/*                                                                            */
/*    DECK_URL=http://localhost:<port>/dev/deck node e2e/deck.spec.mjs         */
/*                                                                            */
/*  The harness serves all four chunk states at once and records every write   */
/*  on window.__deckCalls, so the spec pins the WIRE, not the paint alone.     */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE = process.env.DECK_URL ?? "http://localhost:3111/dev/deck";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};
const calls = (page) => page.evaluate(() => window.__deckCalls ?? []);

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
// The waiting lock BREATHES (an infinite scale animation), which Playwright's
// stability check would wait on forever. The mark is motion-safe, so reduced
// motion stills it — the same accessibility contract real users get.
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=Garage pitch");

/* ------------------------- the four states, painted ------------------------ */
const mark = (status) => page.locator(`button[data-status="${status}"]`);
check(
  "every chunk wears exactly one lock mark — clean, waiting, accepted and locked all present",
  (await mark("clean").count()) === 1 &&
    (await mark("waiting").count()) === 1 &&
    (await mark("accepted").count()) === 1 &&
    (await mark("locked").count()) === 1
);
check(
  "underline belongs EXCLUSIVELY to the waiting chunk (the founder's one-signal rule)",
  await page.evaluate(() => {
    const spans = [...document.querySelectorAll("section span")];
    const underlined = spans.filter((s) =>
      s.className.includes?.("decoration-pending")
    );
    return (
      underlined.length === 1 &&
      underlined[0].textContent?.includes("believed the numbers")
    );
  })
);
check(
  "the waiting lock breathes; no other mark animates",
  await page.evaluate(() => {
    const marks = [...document.querySelectorAll("button[data-status]")];
    const breathing = marks.filter((m) =>
      m.className.includes("animate-lock-breathe")
    );
    return breathing.length === 1 && breathing[0].dataset.status === "waiting";
  })
);
check(
  "the locked mark carries the closed lock + success tick; locked text is plain",
  await page.evaluate(() => {
    const locked = document.querySelector('button[data-status="locked"]');
    const tick = locked?.querySelector(".bg-success");
    const para = locked?.closest("p");
    const chunkSpan = para?.querySelector("span");
    return (
      !!tick &&
      !!chunkSpan &&
      !chunkSpan.className.includes("decoration-pending") &&
      !chunkSpan.className.includes("bg-pending")
    );
  })
);
check(
  "NO stars anywhere on this surface — the rip is total",
  await page.evaluate(() => {
    const svgStars = document.querySelectorAll("svg.lucide-star").length;
    return svgStars === 0 && !document.body.innerText.includes("★");
  })
);
check(
  "two slide sections from the pieces zip, with kickers, dots and the work-count footer",
  (await page.locator("text=Slide 1").count()) >= 1 &&
    (await page.locator('button[aria-label^="Go to Slide"]').count()) === 2 &&
    (await page.locator("text=1 to review").count()) === 1
);

/* ---------------- REVIEW: the waiting chunk's lock opens it ---------------- */
await mark("waiting").click();
await page.waitForSelector("text=Suggested change");
check(
  "the REVIEW modal shows what you said, the suggestion, and a signed-off rationale line",
  (await page.locator("text=What you said").count()) === 1 &&
    (await page.locator("text=trusted the figures").count()) === 1 &&
    // One of the five CLARITY_WHY sentences — never BE free text.
    (await page.evaluate(() =>
      /clearer|smoother|flow better|easier to understand|cleaner finish/.test(
        document.body.innerText
      )
    ))
);
check(
  "the kicker is a display kind, not an engine type",
  (await page.locator("text=Clarity").count()) === 1 &&
    (await page.evaluate(() => !/REWRITE|EMPHASISE|NOTICE/.test(document.body.innerText)))
);

/* ------------------- Accept: decide POST + morph to EDITOR ----------------- */
await page.locator("button", { hasText: /^Accept$/ }).click();
await page.waitForTimeout(600);
let posts = (await calls(page)).filter((c) => c.url.includes("suggestion-feedback"));
check(
  "Accept lands on the suggestion-feedback POST as applied",
  posts.length === 1 &&
    posts[0].body.action === "applied" &&
    posts[0].body.target === "document_replace",
  JSON.stringify(posts[0]?.body)
);
check(
  "…and the modal MORPHS into the editor — never dropped back to the page mid-decision",
  (await page.locator("text=Edit this chunk").count()) === 1 &&
    (await page.locator("textarea").count()) === 1
);
check(
  "the accepted words flowed into the editor from the refetch",
  await page.evaluate(() => {
    const ta = document.querySelector("textarea");
    return ta?.value.includes("trusted the figures") === true;
  })
);

/* --------------------- Lock in: the parts lock PUT ------------------------- */
await page.locator("button", { hasText: /^Lock in$/ }).click();
await page.waitForTimeout(600);
const locks = (await calls(page)).filter((c) => c.url.includes("/lock"));
check(
  "Lock in (draft untouched) rides the parts lock PUT with the document echo and the identity seed",
  locks.length === 1 &&
    locks[0].url.includes("part-1") &&
    locks[0].body.locked === true &&
    typeof locks[0].body.text_echo === "string" &&
    Array.isArray(locks[0].body.parts),
  JSON.stringify(locks[0]?.body?.parts?.length)
);
await page.waitForTimeout(400);
check(
  "the chunk now wears the closed lock — two locked marks on the page",
  (await mark("locked").count()) === 2
);

/* ------------- EDITOR routing from a clean chunk + lock-with-edit ---------- */
await mark("clean").click();
await page.waitForSelector("text=No feedback pending");
await page.evaluate(() => {
  const ta = document.querySelector("textarea");
  if (ta) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(ta, ta.value + " And we never looked back.");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.locator("button", { hasText: /^Lock in$/ }).click();
await page.waitForTimeout(700);
const edits = (await calls(page)).filter((c) => c.url.includes("/user-edit"));
check(
  "Lock in WITH an edit rides the user-edit PUT, parts included, the touched part locked (typed = committed)",
  edits.length === 1 &&
    Array.isArray(edits[0].body.parts) &&
    edits[0].body.parts.some(
      (p) => p.text.includes("never looked back") && p.locked === true
    ),
  JSON.stringify(edits[0]?.body?.parts?.map((p) => p.locked))
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
