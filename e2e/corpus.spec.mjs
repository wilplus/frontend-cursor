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

await page.locator("input").first().fill("Board pitch");
await page.locator("input").nth(1).fill("Jane Doe");
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
  "a real import still reports its pieces, now with the length alongside",
  (await page.locator("text=42 pieces · 15 queued to label · 10 min").count()) === 1
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
check(
  "the picker offers auto-detect first and Polish among the codes",
  await page.evaluate(() => {
    const sel = document.querySelector("select");
    if (!sel) return false;
    const opts = [...sel.options];
    return (
      sel.value === "" &&
      opts[0]?.value === "" &&
      opts[0]?.textContent?.trim() === "Auto-detect" &&
      opts.some((o) => o.value === "pl")
    );
  })
);
check(
  "it says what going without it costs, in terms of the failure it prevents",
  (await page.locator("text=Transcribed as the wrong").count()) === 1
);

// The exact recovery from §7: an import came back with nothing, so the coach
// sets the language and imports THE SAME FILE again.
const emptyKeyBefore = imports[2]?.body?.idempotency_key;
await page.selectOption("select", "pl");
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

/* ------------------------------ FE-2: index -------------------------------- */
await page.locator("button", { hasText: "Board pitch" }).click();
await page.waitForSelector("text=Confident?");

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

await page.locator("button", { hasText: /^Yes$/ }).click();
await page.waitForTimeout(300);
let put = await labels(page);
check(
  "Yes alone is a complete label — a real boolean, no intensity",
  put.length === 1 &&
    JSON.stringify(put[0].body) === JSON.stringify({ confident: true }),
  JSON.stringify(put[0]?.body)
);
check("the 1–5 row appears only now", (await page.locator("text=How strongly?").count()) === 1);
check(
  "the scale carries its meaning as a tooltip, not as words on the buttons",
  (await page.evaluate(() => {
    const p = [...document.querySelectorAll("p")].find((x) =>
      x.textContent?.includes("How strongly")
    );
    return p?.getAttribute("title") ?? "";
  })) === "1 = barely, 5 = unmistakably" &&
    (await page.locator("button", { hasText: /^[1-5]$/ }).count()) === 5
);

await page.locator("button", { hasText: /^4$/ }).click();
await page.waitForTimeout(300);
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
    (await page.locator('button[aria-pressed="true"]', { hasText: /^5$/ }).count()) === 1
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
