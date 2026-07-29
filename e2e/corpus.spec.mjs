/* -------------------------------------------------------------------------- */
/*  Training corpus — import + confidence labelling, in a real browser.        */
/*                                                                            */
/*    CORPUS_URL=http://localhost:<port>/dev/corpus node e2e/corpus.spec.mjs   */
/*                                                                            */
/*  The harness serves each queue piece WITH a band and a confidence_score the */
/*  surface must ignore, so an N1 leak is visible here rather than theoretical.*/
/*  It also delays the first import so the batch's sequencing is provable, and */
/*  fails the second file so per-file failure can be seen not to abort a run.  */
/* -------------------------------------------------------------------------- */

import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;

const BASE = process.env.CORPUS_URL ?? "http://localhost:3111/dev/corpus";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};
const calls = (page) => page.evaluate(() => window.__corpusCalls ?? []);
const labels = async (page) =>
  (await calls(page)).filter((c) => c.url.includes("/confidence-label"));

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("text=Training corpus");

/* ------------------------------ FE-1: import ------------------------------- */
check(
  "the confidence stage is shown CHECKED and DISABLED, not hidden",
  await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((l) =>
      l.textContent?.includes("Confidence")
    );
    const box = label?.querySelector("input[type=checkbox]");
    return box?.checked === true && box?.disabled === true;
  })
);
check(
  "the optional stages are off by default and name their cost",
  (await page.locator("text=~16 model calls per file").count()) === 1 &&
    (await page.evaluate(
      () =>
        [...document.querySelectorAll("input[type=checkbox]")].filter(
          (b) => !b.disabled && b.checked
        ).length === 0
    ))
);
check(
  "the speaker-label nudge is on screen (the only grouping key the corpus gets)",
  (await page.locator("text=the only way the corpus can tell whose voice").count()) === 1
);

check(
  "Import is BLOCKED until a language is chosen — the picker defaulting to auto-detect is what let a Polish talk come back translated into English, silently",
  await page.evaluate(() => {
    const sel = document.querySelector("select");
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Import"
    );
    return sel?.value === "__unset" && btn?.disabled === true;
  })
);
check(
  "the picker says what going without it costs, in the words of the failure it prevents",
  (await page.locator("text=auto-detect is a choice, not a default").count()) === 1 &&
    (await page.locator("text=translated").first().count()) === 1
);
check(
  "Polish leads the real codes — it is what this corpus is made of",
  await page.evaluate(() => {
    const opts = [...document.querySelector("select").options];
    return opts[0].value === "__unset" && opts[1].value === "" && opts[2].value === "pl";
  })
);
check(
  "the speaker-sex picker is present, optional, and says it is about the analysis rather than the person",
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll("select")].find((x) =>
      [...x.options].some((o) => o.value === "prefer_not_to_say")
    );
    return sel?.value === "" && [...sel.options][0].textContent.trim() === "Not stated";
  }) && (await page.locator("text=about the analysis rather than about the person").count()) === 1
);

await page.locator("input").first().fill("Board pitch");
await page.locator("input").nth(1).fill("Jane Doe");
// Auto-detect, but CHOSEN — the whole point of the gate.
await page.selectOption("select >> nth=0", "");
await page.setInputFiles('input[type="file"]', [
  { name: "first-talk.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("a") },
  { name: "bad-clip.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("b") },
  { name: "empty-talk.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("c") },
]);
await page.locator("button", { hasText: "Import" }).click();
await page.waitForTimeout(1800);

const imports = (await calls(page)).filter((c) => c.method === "POST" && c.url.includes("training-imports"));
check("all three files were sent — one per request", imports.length === 3, `${imports.length}`);
check(
  "the batch ran SEQUENTIALLY (the second call waited out the first)",
  imports.length === 3 && imports[1].t - imports[0].t >= 300,
  imports.length === 3 ? `${Math.round(imports[1].t - imports[0].t)}ms apart` : ""
);
check(
  "every request carries the confidence stage, and only it",
  imports.every((c) => c.body.stages === "confidence"),
  JSON.stringify(imports[0]?.body?.stages)
);
check(
  "topic and speaker_label ride the form",
  imports[0]?.body?.topic === "Board pitch" &&
    imports[0]?.body?.speaker_label === "Jane Doe"
);
check(
  "auto-detect sends NO language field at all — the default request is byte-identical to the one that shipped before the picker existed",
  imports.every((c) => !("language" in c.body)),
  JSON.stringify(Object.keys(imports[0]?.body ?? {}))
);
check(
  "a per-file rejection shows the BE's reason verbatim and does not abort the run",
  (await page.locator("text=That clip is too short to analyse.").count()) === 1 &&
    (await page.locator("text=42 pieces · 15 queued to label").count()) === 1
);
check(
  "the raw machine reason NEVER reaches the screen — NO_SPEECH_DETECTED is a switch value, not something to put in front of a person",
  !/NO_SPEECH_DETECTED|NO_CANDIDATES/.test(await page.locator("body").innerText())
);
check(
  "the BE's sentence is shown instead, wrapped rather than truncated, because it names the fix",
  (await page.locator("text=re-import it with a").count()) === 1
);

/* ------------- a zero-piece import must not read as a success -------------- */
// The real case from 2026-07-29: the BE answered ok with a genuine duration
// and snippet_count 0. Rendered as "0 pieces · 0 queued to label" in the same
// neutral grey as a good import, it read as success and the coach waited on a
// queue that was never coming.
check(
  "an ok-but-empty import says so plainly, and shows the duration that diagnoses it",
  (await page.locator("text=Read 41 min — but 0 pieces, nothing to label").count()) === 1
);
check(
  "…and is NOT styled as a success",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("empty-talk.mp3")
    );
    const s = row?.querySelector("span:last-child");
    const c = s ? getComputedStyle(s).color : "";
    // Neither the neutral grey of a good import nor the red of a rejection.
    const good = [...document.querySelectorAll("li")]
      .find((l) => l.textContent?.includes("first-talk.mp3"))
      ?.querySelector("span:last-child");
    return !!c && c !== (good ? getComputedStyle(good).color : "");
  })
);
check(
  "a real import reports what it RAN AS, not what the picker said — the first question about a transcript that reads oddly",
  (await page.locator("text=Auto-detected · 42 pieces · 15 queued to label · 10 min").count()) === 1
);

/* --------------------- idempotency: the retry must collapse ---------------- */
check(
  "every import carries an idempotency_key, and it is an opaque token — not the filename",
  imports.length === 3 &&
    imports.every(
      (c) =>
        /^[0-9a-f]{16,}$/.test(String(c.body.idempotency_key ?? "")) &&
        !String(c.body.idempotency_key).includes("talk")
    ),
  String(imports[0]?.body?.idempotency_key)
);
check(
  "two different files in one batch get DIFFERENT keys — the BE must not collapse them",
  imports[0]?.body?.idempotency_key !== imports[1]?.body?.idempotency_key
);

// The real retry: the second file failed, so pressing Import again re-sends
// exactly that file (the loop skips the one already done). Its key must be
// the SAME token as the first attempt — otherwise a timeout that the BE
// actually completed would import the same talk twice.
await page.locator("button", { hasText: "Import" }).click();
await page.waitForTimeout(900);
const retries = (await calls(page)).filter(
  (c) => c.method === "POST" && c.url.includes("training-imports")
);
check(
  "pressing Import again re-sends ONLY the file that failed",
  retries.length === 4 && retries[3].body.audio_file === imports[1].body.audio_file,
  `${retries.length} calls, last=${retries[3]?.body?.audio_file}`
);
check(
  "the retry reuses the SAME idempotency_key — the whole reason the key exists",
  retries[3]?.body?.idempotency_key === imports[1]?.body?.idempotency_key,
  `${imports[1]?.body?.idempotency_key} → ${retries[3]?.body?.idempotency_key}`
);

/* ------------- language: the picker, and the §7 recovery path -------------- */
// The exact recovery from §7: an import came back with nothing, so the coach
// sets the language and imports THE SAME FILE again.
const emptyKeyBefore = imports[2]?.body?.idempotency_key;
await page.selectOption("select >> nth=0", "pl");
await page.setInputFiles('input[type="file"]', [
  { name: "empty-talk.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("c") },
]);
await page.locator("button", { hasText: "Import" }).click();
await page.waitForTimeout(900);
const afterLang = (await calls(page)).filter(
  (c) => c.method === "POST" && c.url.includes("training-imports")
);
const pl = afterLang[afterLang.length - 1];
check("picking a language sends it as an ISO code", pl?.body?.language === "pl", String(pl?.body?.language));
check(
  "…and the SAME file under a new language gets a DIFFERENT key — otherwise a BE that dedupes would hand back the empty original and the fix would look like it did nothing",
  !!emptyKeyBefore && pl?.body?.idempotency_key !== emptyKeyBefore,
  `${emptyKeyBefore} → ${pl?.body?.idempotency_key}`
);
check(
  "the file that gave nothing now reports pieces — the recovery path works end to end",
  // Scoped to the file's own row: the picker's hint text mentions "nothing to
  // label" too, so a page-wide match would never be a statement about the row.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("empty-talk.mp3")
    );
    const t = row?.innerText ?? "";
    return t.includes("42 pieces") && !t.includes("nothing to label");
  })
);

/* --------- async (202 + poll) and the duplicate, both from rev 3 ----------- */
await page.selectOption("select >> nth=0", "");
await page.setInputFiles('input[type="file"]', [
  { name: "async-talk.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("d") },
  { name: "dupe-talk.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("e") },
]);
await page.locator("button", { hasText: "Import" }).click();
// The harness answers the first poll "processing" and the second "complete",
// so a FE that read the 202 as a result would show a queue here that does not
// exist yet.
await page.waitForTimeout(600);
check(
  "a 202 is NOT read as a result — the row says the server is still working",
  (await page.locator("text=Analysing on the server…").count()) === 1
);
await page.waitForTimeout(4500);
check(
  "polling carries it to the real result",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("async-talk.mp3")
    );
    return (row?.innerText ?? "").includes("42 pieces");
  })
);
check(
  "a duplicate reads as one — 'it succeeded' and 'it was already done' must not look identical",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("dupe-talk.mp3")
    );
    const t = row?.innerText ?? "";
    return t.includes("Already imported") && !t.includes("42 pieces");
  })
);

/* ------- the way in: the import row itself opens the queue (bubbles) ------- */
// The corpus index is coming back empty from the BE, so without this a coach
// can import 45 pieces and have no route to any of them.
check(
  "a successful import offers a direct way into its pieces",
  (await page.locator("text=Label the 15 pieces from").count()) >= 1
);

/* ------------------------------ FE-2: index -------------------------------- */
check(
  "a failed import STAYS in the list — the row is the evidence for why a file produced nothing",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("thank you talk at the conference")
    );
    const t = row?.innerText ?? "";
    return t.includes("Nothing to label") && t.includes("the transcript was empty");
  })
);
check(
  "…and is NOT openable, because there is no queue behind it",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("thank you talk at the conference")
    );
    return !row?.querySelector("button");
  })
);
check(
  "a finished import shows how much is waiting — a running one and a done one used to look identical",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("Board pitch")
    );
    return (row?.innerText ?? "").includes("15 to label");
  })
);

await page.locator("button", { hasText: "Board pitch" }).click();
await page.waitForSelector("text=Was this voice confident?");

/* ------------------- FE-3: the labelling screen, blind --------------------- */
const body = () => page.locator("body").innerText();
check(
  "N1 — no band, score or machine read anywhere, though the payload carried both",
  !/\bhigh\b|\blow\b|\bmid\b|0\.93|0\.11|band|score/i.test(await body()),
  ""
);
check(
  "progress reads as work done, never as a score (AC-9)",
  (await page.locator("text=1 / 3 labelled").count()) === 1
);
check(
  "it opens on the first UNLABELLED piece, without re-ordering (N2)",
  (await page.locator("text=and we shipped it in a week").count()) === 1
);
check(
  "the piece is playable and its words are shown",
  (await page.locator("audio").count()) === 1 &&
    (await page.locator('button[aria-label="Play snippet"]').count()) === 1
);

/* --------------------- N3: no intensity without an answer ------------------ */
check(
  "the 1–5 row does NOT exist before an answer is picked",
  (await page.locator("text=How strongly?").count()) === 0 &&
    (await page.locator("button", { hasText: /^3$/ }).count()) === 0
);
check(
  "neither Yes nor No is pre-selected — no default answer (N3)",
  (await page.locator('button[aria-pressed="true"]').count()) === 0
);

// The Yes click's PUT is deliberately delayed 300ms by the harness, so there
// is a window to observe "pending" before it resolves.
const yesClick = page.locator("button", { hasText: /^Yes$/ }).click();
await page.waitForTimeout(80);
check(
  "while the save is in flight, the nav bar says so — literally 'Saving…', not a silent wait",
  (await page.locator("text=Saving…").count()) === 1
);
check(
  "…and the CURRENT piece's dot pulses amber — pending, not yet answered, not unanswered either",
  await page.evaluate(() => {
    const dots = [...document.querySelectorAll('button[aria-label^="Piece "]')];
    const first = dots[0]?.querySelector("span");
    return (
      dots[0]?.getAttribute("aria-label")?.includes("saving") &&
      first?.className.includes("animate-pulse")
    );
  })
);
check(
  "the Yes/No buttons are disabled while their own save is in flight — a second tap must not race the first",
  await page.evaluate(() => {
    const yes = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Yes"
    );
    return yes?.disabled === true;
  })
);
await yesClick;
// The harness delays the PUT 300ms; the state these next checks read
// (`answered`, the 1–5 row) only updates once that resolves.
await page.waitForTimeout(350);
let put = await labels(page);
check(
  "Yes alone is a complete label — a real boolean, no intensity",
  put.length === 1 &&
    JSON.stringify(put[0].body) === JSON.stringify({ confident: true }),
  JSON.stringify(put[0]?.body)
);
check("the 1–5 row appears only now", (await page.locator("text=How strongly?").count()) === 1);
check(
  "only the two ENDPOINTS carry a word — 2, 3 and 4 stay bare numbers, per the founder's table",
  (await page.locator('button[aria-label="2"]').count()) === 1 &&
    (await page.locator('button[aria-label="3"]').count()) === 1 &&
    (await page.locator('button[aria-label="4"]').count()) === 1
);
check(
  "under a YES answer, the endpoints read 'Barely confident' / 'Extremely confident' — the founder's own words",
  (await page.locator('button[aria-label="1 — Barely confident"]').count()) === 1 &&
    (await page.locator('button[aria-label="5 — Extremely confident"]').count()) === 1 &&
    (await page.locator("text=Barely confident").count()) === 1 &&
    (await page.locator("text=Extremely confident").count()) === 1
);

await page.locator('button[aria-label="4"]').click();
await page.waitForTimeout(400);
put = await labels(page);
check(
  "the grade re-sends the answer WITH the intensity — never intensity alone (N3)",
  put.length === 2 &&
    JSON.stringify(put[1].body) ===
      JSON.stringify({ confident: true, intensity: 4 }),
  JSON.stringify(put[1]?.body)
);
check(
  "grading auto-advances past the already-labelled piece to the next unlabelled one",
  (await page.locator("text=I think maybe we could possibly").count()) === 1
);
check("progress moved to 2 / 3", (await page.locator("text=2 / 3 labelled").count()) === 1);

/* ------------- a saved call shows as current state, still re-callable ------- */
await page.locator("button", { hasText: "Back" }).click();
await page.waitForTimeout(200);
check(
  "stepping back reaches the pre-labelled piece in PAYLOAD order (N2)",
  (await page.locator("text=so we moved the launch").count()) === 1
);
check(
  "its saved call renders as the active answer and grade, not a locked one",
  (await page.locator('button[aria-pressed="true"]', { hasText: /^Yes$/ }).count()) === 1 &&
    (await page.locator('button[aria-pressed="true"][aria-label="5 — Extremely confident"]').count()) === 1
);

/* ---------------- the bubbles: every piece, reachable ---------------- */
check(
  "the bubbles show EVERY piece, in payload order, numbered from 1 (N2 — sorting them would undo the server-side band shuffle)",
  await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll('button[aria-label^="Piece "]')];
    // Dots, NOT numbers: the 1-5 grade row is on the same screen, and two
    // rows of digits meaning different things is a real confusion (it also
    // made the grade-button selectors ambiguous, which is how it was caught).
    return (
      bubbles.length === 3 &&
      bubbles.every((b) => b.textContent?.trim() === "") &&
      bubbles.map((b) => b.getAttribute("aria-label")).join("|").startsWith("Piece 1")
    );
  })
);
check(
  "the dots now live in the NAV BAR — above the fold, not scrolled away at the bottom where they used to sit",
  await page.evaluate(() => {
    const dot = document.querySelector('button[aria-label^="Piece "]');
    // The native <audio> element MediaPlayer renders is visually hidden (its
    // own custom UI is what's shown), so it has no box to compare against.
    // The question is a real, visible layout anchor further down the screen.
    const confident = [...document.querySelectorAll("p")].find(
      (x) => x.textContent?.trim() === "Was this voice confident?"
    );
    if (!dot || !confident) return false;
    return dot.getBoundingClientRect().top < confident.getBoundingClientRect().top;
  })
);
check(
  "a bubble encodes ONLY whether the coach has answered — never a band, score or machine read (N1)",
  await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll('button[aria-label^="Piece "]')];
    const answered = bubbles.filter((b) => b.getAttribute("aria-label").includes("answered"));
    // The harness serves band high/low/mid and scores .93/.11/.5 on these three
    // pieces. If any of that reached the bubbles, more than the coach's own
    // answers would vary — and none of it may appear in the markup at all.
    const markup = bubbles.map((b) => b.outerHTML).join(" ");
    return (
      answered.length >= 1 &&
      !/high|low|mid|0\.9|0\.1|band|score/i.test(markup)
    );
  })
);
check(
  "tapping a bubble jumps straight to that piece",
  await (async () => {
    await page.locator('button[aria-label^="Piece 3"]').click();
    await page.waitForTimeout(150);
    return (await page.locator("text=I think maybe we could possibly try it that way").count()) === 1;
  })()
);
check(
  "…and jumping does NOT pre-select an answer on an unlabelled piece (N3)",
  await page.evaluate(
    () =>
      [...document.querySelectorAll("button")].filter(
        (b) => b.getAttribute("aria-pressed") === "true"
      ).length === 0
  )
);

/* --------------- once every piece is labelled, the nav bar says so plainly -------------- */
await page.locator("button", { hasText: /^Yes$/ }).click();
await page.waitForTimeout(400);
check(
  "the nav bar marks completion instead of just counting, once every piece is labelled",
  (await page.locator("text=All labelled").count()) === 1 &&
    (await page.locator("text=3 / 3 labelled").count()) === 0
);

/* -------- the OTHER branch: "No" gets its OWN words, not Yes mirrored -------- */
// The harness's mock queue is stateless per fetch — reopening any import
// hands back the SAME starting data, so this is a fresh, unlabelled piece-c
// again, not the one just laboured over above.
await page.locator('button[aria-label="Back to the corpus"]').click();
await page.waitForTimeout(200);
await page.locator("button", { hasText: "Board pitch" }).click();
await page.waitForSelector("text=Was this voice confident?");
await page.locator("button", { hasText: /^No$/ }).click();
await page.waitForTimeout(400);
check(
  "under a NO answer the endpoints read DIFFERENT words than under Yes — 'Slightly unconfident' / 'Extremely unconfident', the founder's own asymmetric wording, not a mirror",
  (await page.locator('button[aria-label="1 — Slightly unconfident"]').count()) === 1 &&
    (await page.locator('button[aria-label="5 — Extremely unconfident"]').count()) === 1 &&
    (await page.locator("text=Slightly unconfident").count()) === 1 &&
    (await page.locator("text=Extremely unconfident").count()) === 1 &&
    // Never "Barely unconfident" — that word only ever appears on the Yes
    // branch's low end ("Barely confident"); the No branch's low end is a
    // different word entirely, not a search-and-replaced mirror of it.
    (await page.locator("text=Barely unconfident").count()) === 0
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
