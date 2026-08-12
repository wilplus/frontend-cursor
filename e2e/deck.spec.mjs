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
/*  The chunk editor is a marker-AWARE field (a contentEditable that paints the
 *  same styled spans the deck does), never a textarea over the marker source.
 *  So the spec reads what the STUDENT sees — innerText — which is also what
 *  makes "no asterisks in the box" a checkable claim. */
const EDITOR = '[role="dialog"] [role="textbox"][contenteditable]';
const editorText = (page) =>
  page.evaluate(
    (sel) => document.querySelector(sel)?.innerText ?? null,
    '[role="dialog"] [role="textbox"][contenteditable]'
  );
/** Type at the END of the editor, through real keystrokes — the boundary
 *  guard in MarkedEditor only runs on native beforeinput. */
async function typeAtEnd(page, text) {
  await page.locator(EDITOR).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
// The waiting lock BREATHES (an infinite scale animation), which Playwright's
// stability check would wait on forever. The mark is motion-safe, so reduced
// motion stills it — the same accessibility contract real users get.
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=Garage pitch");

/* ---------------- the THREE states, and a page that is not painted --------- */
// Founder 2026-08-11: "accepted" and "locked" merged into one final state, and
// NOTHING marks the text any more. The fixture still serves an approved
// suggestion on one chunk and a server lock on another — both must land on the
// SAME state, which is why the locked count is 2.
const mark = (status) => page.locator(`button[data-status="${status}"]`);
check(
  "three states on the page — accepted and locked are one",
  (await mark("clean").count()) === 1 &&
    (await mark("waiting").count()) === 1 &&
    (await mark("locked").count()) === 2 &&
    (await mark("accepted").count()) === 0
);
check(
  "NOTHING paints the chunk text — no underline, no wash, in any state",
  await page.evaluate(() => {
    // The whole rendered stage, not a sampled span: the rule is that no
    // element under it carries either treatment.
    const painted = [...document.querySelectorAll("section *")].filter((el) => {
      const c = el.className;
      return (
        typeof c === "string" &&
        (c.includes("decoration-pending") ||
          c.includes("bg-pending/[0.08]") ||
          c.includes("bg-pending/[0.14]") ||
          c.includes("underline"))
      );
    });
    return painted.length === 0;
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
  "two slide sections from the pieces zip, with kickers and dots",
  (await page.locator("text=Slide 1").count()) >= 1 &&
    (await page.locator('button[aria-label^="Go to Slide"]').count()) === 2
);
check(
  "NO FOOTER — no review count, no slide position, no word count",
  await page.evaluate(() => {
    const t = document.body.innerText;
    return (
      !/\bto review\b/.test(t) &&
      !/Nothing waiting/.test(t) &&
      !/\b\d+\s+words\b/.test(t) &&
      !/Slide \d+ of \d+/.test(t)
    );
  })
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
    (await page.locator(EDITOR).count()) === 1 &&
    (await page.locator("textarea").count()) === 0
);
check(
  "the accepted words flowed into the editor from the refetch",
  (await editorText(page))?.includes("trusted the figures") === true
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
  "the chunk now wears the closed lock — three locked marks on the page",
  (await mark("locked").count()) === 3
);

/* -------- slice 2: the style lane on a LOCKED chunk, modal-only ------------ */
check(
  "a locked chunk with a PENDING style proposal is still never re-marked on the page",
  await page.evaluate(() => {
    const para = [...document.querySelectorAll("section p")].find((p) =>
      p.textContent?.includes("So we moved the launch")
    );
    const span = para?.querySelector("span");
    return (
      !!span &&
      !span.className.includes("decoration-pending") &&
      !span.className.includes("bg-pending")
    );
  })
);
await page.evaluate(() => {
  const para = [...document.querySelectorAll("section p")].find((p) =>
    p.textContent?.includes("So we moved the launch")
  );
  para?.querySelector('button[data-status="locked"]')?.click();
});
await page.waitForSelector("text=Locked chunk");
check(
  "the locked kicker carries the maturity counter — a process count, never a score",
  (await page.locator("text=Locked in · 2 iterations").count()) === 1
);
check(
  "the style card surfaces ONLY here: Bolden the quote, with the signed-off emphasis rationale",
  (await page.locator("text=Bolden").count()) === 1 &&
    (await page.locator("text=changed everything").count()) >= 1 &&
    (await page.locator("button", { hasText: "Apply emphasis" }).count()) === 1
);
await page.locator("button", { hasText: "Apply emphasis" }).click();
await page.waitForTimeout(600);
const styles = (await calls(page)).filter((c) => c.body?.style_lane === true);
check(
  "Apply emphasis rides the decide POST OUTSIDE the budget — style_lane marked, texts for the ledger",
  styles.length === 1 &&
    styles[0].body.target === "document_bold" &&
    styles[0].body.action === "applied" &&
    styles[0].body.quote === "changed everything",
  JSON.stringify(styles[0]?.body)
);
await page.waitForTimeout(400);
check(
  "…and the applied style stops being offered on the refetch",
  (await page.locator("button", { hasText: "Apply emphasis" }).count()) === 0
);

/* -- THE MARKER FENCE: the applied bold is now FOLDED INTO THE TEXT (the BE
      writes **…** into the document). The editor is open on those very words.
      A plain textarea printed the asterisks at the student — FE-1 says no
      character of the marker grammar ever reaches a reader, and this modal is
      the only way into the text, so the leak sat on the one surface that
      cannot have it. */
check(
  "the folded emphasis reaches the editor as STYLE, not as asterisks",
  await page.evaluate(() => {
    const box = document.querySelector(
      '[role="dialog"] [role="textbox"][contenteditable]'
    );
    const dialog = document.querySelector('[role="dialog"]');
    const styled = box?.querySelector('span[data-open="**"]');
    return (
      !!box &&
      box.innerText.includes("changed everything") &&
      // Not in the box, and not anywhere else in the modal either.
      !dialog?.innerText.includes("**") &&
      !dialog?.innerText.includes("{{") &&
      // …and the words really are bold, not merely stripped.
      styled?.textContent === "changed everything" &&
      styled.className.includes("font-semibold")
    );
  })
);
check(
  // The rationale used to be "underline is reserved for the waiting signal".
  // The underline is retired entirely now, and the rule outlives it: the
  // chunk editor is for the WORDS, and a formatting bar in it is a second
  // way to mark text on a surface that deliberately has none.
  "the editor carries no formatting toolbar",
  (await page.locator('[role="dialog"] button[aria-label="Underline"]').count()) === 0 &&
    (await page.locator('[role="dialog"] button[aria-label="Bold"]').count()) === 0
);
// A LOCKED CHUNK HAS NOTHING LEFT TO DECIDE (founder 2026-08-12: "if smth is
// locked in, then why there is a big button to lock it in? and the discard
// button? and if I click discard nothing happens"). Both were no-ops: "Lock
// in" re-locked what was locked, "Discard" was the close handler.
//
// This is ALSO the byte-exactness check (L1: their take, verbatim), and a
// sharper one than pressing the button was. The row hides precisely while the
// editor's serialization still equals the served text — so if MarkedEditor
// re-spelled the fold, `draft` would differ, "Lock in" would come back on
// screen, and this check would fail before any write could happen.
check(
  "a locked chunk offers NO Lock in / Discard — and the marker text round-trips",
  (await page.locator('[role="dialog"] button', { hasText: /^Lock in$/ }).count()) === 0 &&
    (await page.locator('[role="dialog"] button', { hasText: /^Discard$/ }).count()) === 0
);
check(
  "…and opening a folded chunk wrote NOTHING to the document",
  (await calls(page)).filter((c) => c.url.includes("/user-edit")).length === 0
);
// The row must come BACK the moment the words differ, or an edit on a locked
// chunk would be unsaveable — the text stays editable there by design.
await typeAtEnd(page, " Truly.");
await page.waitForTimeout(200);
check(
  "…but typing into it brings the decision row straight back",
  (await page.locator('[role="dialog"] button', { hasText: /^Lock in$/ }).count()) === 1
);
await page.locator('[role="dialog"] button[aria-label="Close"]').click();
await page.waitForTimeout(400);

/* ------- slice 4: the coach's own feedback, on the LOCKED chunk ------------ */
await page.evaluate(() => {
  const para = [...document.querySelectorAll("section p")].find((p) =>
    p.textContent?.includes("So we moved the launch")
  );
  para?.querySelector('button[data-status="locked"]')?.click();
});
await page.waitForSelector("text=Locked chunk");
check(
  "a locked chunk still shows that the coach left something on these words (the founder's rule)",
  (await page.locator("text=Coach note:").count()) === 1
);
check(
  "…and nothing was fetched to say so — the metered feedback read has NOT fired",
  (await calls(page)).filter((c) => c.url.includes("/feedback")).length === 0
);
await page.locator("button", { hasText: "Coach note:" }).click();
await page.waitForTimeout(500);
check(
  "the tap loads the coach's note and video — one metered read, on a deliberate act",
  (await calls(page)).filter((c) => c.url.includes("/feedback")).length === 1 &&
    (await page.locator("text=This is the turn — say it slower.").count()) === 1 &&
    (await page.evaluate(() => {
      const v = document.querySelector('[role="dialog"] video');
      return v?.getAttribute("src") === "https://signed.example/coach.webm";
    }))
);
await page.locator('[role="dialog"] button[aria-label="Close"]').click();
await page.waitForTimeout(200);
check(
  "a chunk the coach said nothing about shows no coach card",
  await (async () => {
    await mark("clean").click();
    await page.waitForSelector("text=No feedback pending");
    const none = (await page.locator("text=Coach note:").count()) === 0;
    await page.locator('[role="dialog"] button[aria-label="Close"]').click();
    await page.waitForTimeout(150);
    return none;
  })()
);

/* ---------- slice 2: proposal history on the chunk's own words ------------- */
await mark("clean").click();
await page.waitForSelector("text=No feedback pending");
check(
  "the editor lists proposals from earlier iterations — matched to THIS chunk's words, decided but readable",
  (await page.locator("text=Proposals from earlier iterations · 1").count()) === 1 &&
    (await page.locator("text=We began this in a garage with one borrowed mic.").count()) === 1
);
await page.locator("button", { hasText: "Use this wording" }).click();
check(
  "Use this wording loads the old proposal into the draft — committing it is a fresh lock-in, step by step",
  (await editorText(page))?.trim() ===
    "We began this in a garage with one borrowed mic."
);
await page.locator('[role="dialog"] button[aria-label="Close"]').click();
await page.waitForTimeout(200);

/* ------------- EDITOR routing from a clean chunk + lock-with-edit ---------- */
await mark("clean").click();
await page.waitForSelector("text=No feedback pending");
await typeAtEnd(page, " And we never looked back.");
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

/* ---- REGRESSION: the document the BACKEND has no parts for (founder bug) --- */
/*  "It can't be locked in!" — on a real arc, on every chunk. The document had  */
/*  never been manually edited, so the BE served `parts: null`; the deck minted */
/*  ids for its chunks and the host minted its own, and the lock — addressed by */
/*  part id — looked itself up in a list that never contained it and gave up    */
/*  before any request left the browser. This harness always served parts,      */
/*  which is precisely why the e2e was green while the app was broken.          */
const fresh = await browser.newPage({ viewport: { width: 520, height: 900 } });
await fresh.emulateMedia({ reducedMotion: "reduce" });
await fresh.goto(`${BASE}?noparts=1`, { waitUntil: "networkidle" });
await fresh.waitForSelector("text=Garage pitch");
check(
  "with no stored parts NO SERVER LOCK survives — the chunks are the deck's own derivation",
  // p2 carried the only stored part lock and loses it with the parts list.
  // The single remaining closed lock is p3's, which reaches that state
  // through an APPROVED SUGGESTION rather than through a part — the two
  // sources merged into one icon (founder 2026-08-11) but only one of them
  // lives in the parts payload, and that is what this harness removes.
  (await fresh.locator('button[data-status="locked"]').count()) === 1 &&
    (await fresh.locator('button[data-status="clean"]').count()) === 2 &&
    (await fresh.locator('button[data-status="waiting"]').count()) === 1
);
await fresh.locator('button[data-status="clean"]').first().click();
await fresh.waitForSelector("text=No feedback pending");
await fresh.locator("button", { hasText: /^Lock in$/ }).click();
await fresh.waitForTimeout(700);
const freshLocks = (await calls(fresh)).filter((c) => c.url.includes("/lock"));
check(
  "Lock in REACHES THE WIRE with no served identity — position + words carry the claim",
  freshLocks.length === 1 &&
    freshLocks[0].body.locked === true &&
    typeof freshLocks[0].body.text_echo === "string" &&
    Array.isArray(freshLocks[0].body.parts) &&
    freshLocks[0].body.parts.length === 4,
  JSON.stringify(freshLocks[0]?.body?.parts?.length ?? null)
);
check(
  "…and it seeds the identity it just minted — the PUT names a part the server never sent",
  freshLocks.length === 1 && !/part-\d/.test(freshLocks[0].url),
  freshLocks[0]?.url
);
await fresh.close();

/* ------- founder 2026-08-11: "The edits should not be in the top bar" ------ */
check(
  "the host header carries NO edit affordance — the chunk's lock is the only way in",
  await page.evaluate(() => {
    // The header row, found from the control that is SUPPOSED to be there.
    const present = document.querySelector('button[aria-label="Present mode"]');
    const header = present?.closest("div")?.parentElement ?? null;
    if (!header) return false;
    const labels = [...header.querySelectorAll("button[aria-label]")].map(
      (b) => b.getAttribute("aria-label") ?? ""
    );
    const pencils = header.querySelectorAll('svg[class*="pencil"], svg[class*="square-pen"]').length;
    // Present + Copy + Close survive; nothing in the row says "edit", and no
    // pencil is drawn. (The chunk marks DO say "edit this chunk" — that is
    // the point, and they live on the stage, not up here.)
    return labels.length >= 3 && pencils === 0 && !labels.some((l) => /edit/i.test(l));
  })
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
