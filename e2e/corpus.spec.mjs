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

import { launchChromium } from "./_launch.mjs";

/* The blind instrument's one question. Mirrors CONFIDENCE_QUESTION in
 * src/services/api/stateRatings.ts — the corpus screen used to hardcode a
 * second wording ("Was this voice confident?"), so the same instrument asked
 * two different things depending on which surface the coach was on. */
const CONFIDENCE_QUESTION = "Does the speaker sound confident here?";

const BASE = process.env.CORPUS_URL ?? "http://localhost:3111/dev/corpus";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};
const calls = (page) => page.evaluate(() => window.__corpusCalls ?? []);
const labels = async (page) =>
  (await calls(page)).filter((c) => c.url.includes("/confidence-label"));
const isConfidenceLabelBody = (body, value) =>
  body?.state_id === "confidence" &&
  body?.value === value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    body?.idempotency_key ?? ""
  ) &&
  Object.keys(body).sort().join(",") === "idempotency_key,state_id,value";

/** A 3-second silent 8 kHz WAV: the import's PARENT recording that the
 *  harness's signed URLs point at. */
function parentWav() {
  const samples = 8000 * 3;
  const b = Buffer.alloc(44 + samples, 128);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write("data", 36); b.writeUInt32LE(samples, 40);
  return b;
}
const PARENT_WAV = parentWav();

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
// The signed parent-recording URLs (backend PR #920). An expired one answers
// 403, as the storage provider does once the signature runs out. Byte ranges
// are served as object storage serves them: without them Chromium cannot
// seek, and the window's start could not be reached.
await page.route("https://media.example/**", async (route) => {
  if (route.request().url().includes("expired=1")) {
    return route.fulfill({ status: 403, body: "expired" });
  }
  const range = /bytes=(\d+)-(\d*)/.exec((await route.request().headerValue("range")) ?? "");
  if (!range) {
    return route.fulfill({
      status: 200,
      headers: { "Content-Type": "audio/wav", "Accept-Ranges": "bytes" },
      body: PARENT_WAV,
    });
  }
  const start = Number(range[1]);
  const end = range[2] ? Math.min(Number(range[2]), PARENT_WAV.length - 1) : PARENT_WAV.length - 1;
  return route.fulfill({
    status: 206,
    headers: {
      "Content-Type": "audio/wav",
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${PARENT_WAV.length}`,
    },
    body: PARENT_WAV.subarray(start, end + 1),
  });
});
const playbackAsks = async (snippet) =>
  (await calls(page)).filter((c) => c.url.includes(`/api/v2/coach/corpus/clips/${snippet}/playback`));
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
  "…and is NOT openable, because there is no queue behind it — its only button is the hide control",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("thank you talk at the conference")
    );
    if (!row) return false;
    const buttons = [...row.querySelectorAll("button")];
    return (
      buttons.length === 1 &&
      (buttons[0].getAttribute("aria-label") ?? "").startsWith("Hide")
    );
  })
);
// The badge is computed from a fresh read of the row's queue — the labels
// the database actually holds — so give that fetch a beat to land.
await page.waitForTimeout(400);
check(
  "a finished import's badge comes from a FRESH database read, not the index row — the harness queue holds 1 labelled of 3, and that is what shows",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("Board pitch")
    );
    return (row?.innerText ?? "").includes("1 of 3 labelled");
  })
);
check(
  "the list states the real save model — no cron, no later send — and never invents a 'pending' state",
  (await page.locator("text=there is no").count()) >= 1 &&
    (await page.locator("text=read back from the database").count()) === 1 &&
    !/pending/i.test(await page.locator("body").innerText())
);
check(
  "a fully-labelled batch wears the green 'All N labelled' badge, computed from its own queue",
  await page.evaluate(() => {
    const row = [...document.querySelectorAll("li")].find((l) =>
      l.textContent?.includes("Old finished batch")
    );
    const t = row?.innerText ?? "";
    return t.includes("All 2 labelled") && !t.includes("to label");
  })
);

/* -------- hide, honestly named: tidies this device, deletes nothing -------- */
await page.locator('button[aria-label^="Hide Old finished batch"]').click();
await page.waitForTimeout(150);
check(
  "hiding a row removes it from the list without labelling it",
  await page.evaluate(
    () =>
      ![...document.querySelectorAll("li")].some((l) =>
        l.textContent?.includes("Old finished batch")
      )
  )
);
check(
  "…and the list SAYS what hiding really is — device-local, nothing leaves the database. There is no Delete, because the BE has no endpoint that would make one true",
  (await page.locator("text=1 hidden on this device").count()) === 1 &&
    (await page.locator("text=stay in the database").count()) >= 1 &&
    !/\bDelete\b/.test(await page.locator("body").innerText())
);
await page.locator("text=1 hidden on this device").click();
await page.waitForTimeout(150);
await page.locator('button[aria-label^="Restore Old finished batch"]').click();
await page.waitForTimeout(150);
check(
  "hiding is reversible — restore brings the row back and the hidden line goes away",
  await page.evaluate(
    () =>
      [...document.querySelectorAll("li")].some((l) =>
        l.textContent?.includes("Old finished batch")
      )
  ) && (await page.locator("text=hidden on this device").count()) === 0
);

await page.locator("button", { hasText: "Board pitch" }).click();
await page.waitForSelector(`text=${CONFIDENCE_QUESTION}`);

/* ------------- FE-3: the labelling is the Judge screen, blind -------------- */
// Founder 2026-09-30, B9 (build plan P2-16): the workbench keeps its import,
// and its labelling screen is the walk's Judge screen, opened over it. The
// workbench's own chrome around the labelling (its nav bar, the piece dots
// and the "N / M labelled" count, the note field, Back and Skip) is gone.
/** The open sheet only: the workbench stays mounted underneath it. */
const dialog = '[role="dialog"]';
const sheetText = () => page.evaluate((d) => document.querySelector(d)?.innerText ?? "", dialog);
const barText = () =>
  page.evaluate(() => document.querySelector('[data-testid="feedback-pager"]')?.textContent ?? "");
const body = () => page.locator("body").innerText();
check(
  "the labelling is the Judge screen: its title, its bar and the one instrument (B9, P2-16)",
  (await page.locator(`${dialog}[aria-label="Judge this moment"] [data-testid="coach-judge-instrument"]`).count()) === 1
);
check(
  "N1 — no band, score or machine read on the labelling screen, though the payload carried both",
  !/\bhigh\b|\blow\b|\bmid\b|0\.93|0\.11|band|score/i.test(await sheetText()),
  ""
);
check(
  "it opens on the first UNLABELLED piece, without re-ordering (N2)",
  (await barText()).includes("Board pitch · moment 1 of 3")
);
await page.waitForSelector(`${dialog} audio`, { state: "attached" });
check(
  "the row's clip is asked for by snippet from the coach playback route — the queue row carries no playback reference",
  (await playbackAsks("piece-c")).length === 1
);
await page.waitForFunction(
  (d) => (document.querySelector(`${d} audio`)?.readyState ?? 0) >= 1,
  dialog,
  { timeout: 5000 }
).catch(() => {});
const window1 = await page.evaluate((d) => {
  const a = document.querySelector(`${d} audio`);
  return { src: a?.getAttribute("src") ?? "", at: a?.currentTime ?? -1 };
}, dialog);
check(
  "it plays the fetched window: the parent recording's signed URL, from the window's start",
  window1.src.includes("snippet=piece-c&sig=1") && Math.abs(window1.at - 1.0) < 0.05,
  JSON.stringify(window1)
);
check(
  "no snippet id, URL or window number reaches the coach (AC-9, N1)",
  !/piece-c|media\.example|sig=|\b1000\b|\b1500\b/.test(await sheetText())
);
check(
  "the piece is playable while its exact words stay hidden before the answer",
  (await page.locator(`${dialog} audio`).count()) === 1 &&
    (await page.locator(`${dialog} button[aria-label="Play snippet"]`).count()) === 1 &&
    (await page.locator("text=and we shipped it in a week").count()) === 0
);
check(
  "the workbench's labelling chrome is gone: no piece dots, no labelled count, no note field, no Back or Skip (B9)",
  await page.evaluate((d) => {
    const sheet = document.querySelector(d);
    if (!sheet) return false;
    return (
      sheet.querySelectorAll('button[aria-label^="Piece "]').length === 0 &&
      !/labelled/.test(sheet.textContent ?? "") &&
      sheet.querySelectorAll("input, textarea").length === 0 &&
      ![...sheet.querySelectorAll("button")].some((b) => /^(Back|Skip)$/.test(b.textContent?.trim() ?? ""))
    );
  }, dialog)
);

/* ----------- N3: no default answer — and the 1–5 grade row is GONE --------- */
check(
  "the retired 1–5 grade row does not exist — cut 2026-08-11 (founder: pure ternary for the MVP)",
  (await page.locator("text=How strongly?").count()) === 0 &&
    (await page.locator(`${dialog} button`, { hasText: /^3$/ }).count()) === 0
);
check(
  "neither Yes nor No is pre-selected — no default answer (N3)",
  (await page.locator(`${dialog} button[aria-pressed="true"]`).count()) === 0
);

// The Yes click's PUT is deliberately delayed 300ms by the harness, so there
// is a window to observe "pending" before it resolves.
const yesClick = page.locator(`${dialog} button`, { hasText: /^Yes — Confident$/ }).click();
await page.waitForTimeout(80);
check(
  "while the save is in flight, the instrument says so — literally 'Saving…', not a silent wait",
  (await sheetText()).includes("Saving…")
);
check(
  "the answers are disabled while their own save is in flight — a second tap must not race the first",
  await page.evaluate((d) => {
    const yes = [...(document.querySelector(d)?.querySelectorAll("button") ?? [])].find(
      (b) => b.textContent?.trim() === "Yes — Confident"
    );
    return yes?.disabled === true;
  }, dialog)
);
await yesClick;
// The harness delays the PUT 300ms; the state these next checks read only
// updates once that resolves.
await page.waitForTimeout(350);
let put = await labels(page);
check(
  // 2026-08-10, the unified ternary instrument; 2026-08-11, the intensity
  // cut; 2026-09-30 (B9), the note field went with the chrome. One semantic
  // write shape is left in the product: the ternary body. The UUID is
  // transport provenance for idempotent immutable storage, never another
  // label or a value visible to the coach (N3).
  "Yes alone is THE complete label — plus an opaque idempotency key, nothing semantic",
  put.length === 1 && isConfidenceLabelBody(put[0].body, "yes"),
  JSON.stringify(put[0]?.body)
);
check(
  "the answer is the whole act — it moves on past the already-labelled piece to the next unlabelled one",
  (await barText()).includes("moment 3 of 3")
);
// piece-b's first signed URL has already expired: the audio fails to load,
// and the page asks for a fresh URL once.
await page.waitForFunction(
  (d) => (document.querySelector(`${d} audio`)?.getAttribute("src") ?? "").includes("sig=2"),
  dialog,
  { timeout: 5000 }
).catch(() => {});
await page.waitForTimeout(300);
const refreshed = await page.evaluate((d) => {
  const a = document.querySelector(`${d} audio`);
  return { src: a?.getAttribute("src") ?? "", ready: a?.readyState ?? 0, at: a?.currentTime ?? -1 };
}, dialog);
check(
  "an expired URL is asked for again once, and the fresh one plays the window",
  (await playbackAsks("piece-b")).length === 2 &&
    refreshed.src.includes("snippet=piece-b&sig=2") &&
    !refreshed.src.includes("expired") &&
    refreshed.ready >= 1 &&
    Math.abs(refreshed.at - 1.0) < 0.05,
  `${(await playbackAsks("piece-b")).length} asks · ${JSON.stringify(refreshed)}`
);
check(
  "no grade row appeared after answering either — the cut is total, not gated differently",
  (await page.locator("text=How strongly?").count()) === 0
);

/* ------------- a saved call shows as current state, still re-callable ------- */
await page.locator('[data-testid="feedback-pager"] button[aria-label="Back"]').click();
await page.waitForTimeout(200);
check(
  "the bar steps back to the pre-labelled piece in PAYLOAD order (N2)",
  (await barText()).includes("moment 2 of 3") &&
    (await page.locator("text=so we moved the launch").count()) === 1
);
check(
  "its saved call renders as the active answer, not a locked one",
  (await page.locator(`${dialog} button[aria-pressed="true"]`, { hasText: /^Yes — Confident$/ }).count()) === 1
);
check(
  "a piece that still CARRIES a historical 1–5 grade renders no grade UI — the number stays in the database, read-only, never back on screen",
  // The harness serves this piece with intensity: 5; under the old UI that
  // rendered a pressed "5 — Extremely confident". Now nothing may.
  (await page.locator("text=How strongly?").count()) === 0 &&
    !/Barely confident|Extremely confident|Slightly unconfident|Extremely unconfident/.test(
      await body()
    )
);
check(
  "the bar says where the coach is and nothing else — never a band, score or machine read (N1)",
  !/high|low|mid|0\.9|0\.1|band|score/i.test(
    await page.evaluate(() => document.querySelector('[data-testid="feedback-pager"]')?.outerHTML ?? "")
  )
);
await page.locator('[data-testid="feedback-pager"] button[aria-label="Next"]').click();
await page.waitForTimeout(150);
check("› moves on to the next piece in payload order", (await barText()).includes("moment 3 of 3"));
check(
  "…and moving does NOT pre-select an answer on an unlabelled piece (N3)",
  (await page.locator(`${dialog} button[aria-pressed="true"]`).count()) === 0
);

/* -------- after the last unlabelled piece, back to the workbench ---------- */
await page.locator(`${dialog} button`, { hasText: /^Yes — Confident$/ }).click();
await page.waitForTimeout(400);
check(
  "answering the last unlabelled piece closes the Judge screen onto the workbench, as the walk moves on by itself (A7)",
  (await page.locator(dialog).count()) === 0 && (await page.locator("text=Training corpus").count()) >= 1
);

/* ----------- the OTHER branch: "No" is the same one-tap act ---------------- */
// The harness's mock queue is stateless per fetch — reopening any import
// hands back the SAME starting data, so this is a fresh, unlabelled piece-c
// again, not the one just laboured over above.
await page.locator("button", { hasText: "Board pitch" }).click();
await page.waitForSelector(`text=${CONFIDENCE_QUESTION}`);
await page.locator(`${dialog} button`, { hasText: /^No — Not confident$/ }).click();
await page.waitForTimeout(400);
put = await labels(page);
check(
  "No rides the same ternary body and is complete on its own — no grade step follows it",
  put.length === 3 && isConfidenceLabelBody(put[2].body, "no"),
  JSON.stringify(put[2]?.body)
);
check(
  "…and no grade row under No either — the retired endpoint captions ('Slightly unconfident' and the rest) are gone with it",
  (await page.locator("text=How strongly?").count()) === 0 &&
    !/Slightly unconfident|Extremely unconfident/.test(await body())
);

await browser.close();
console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
