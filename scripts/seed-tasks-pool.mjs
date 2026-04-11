#!/usr/bin/env node
// One-off: seed task templates into public.tasks_pool via the admin backend API.
// Run: BACKEND_URL=https://api.example.com ADMIN_TOKEN=eyJ... node scripts/seed-tasks-pool.mjs
// Idempotent: skips any row whose <strong> title already exists in the pool.
//
// Contract references:
//   - Payload: TasksPoolItemUpsertPayload in src/lib/api/admin-client.ts:618
//   - Profile values: TASK_TARGET_PROFILES in src/lib/tasks/taskTemplateLabels.ts:7
//   - HTML whitelist: sanitizeRichHtml() in src/lib/sanitizeRichHtml.ts:14
//   - Renderer: src/components/recording/AudioRecorder.tsx:674-684
//   - BFF route forwarded from: src/app/api/admin/tasks-pool/route.ts

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

if (!BACKEND_URL) {
  console.error("BACKEND_URL env var is required (e.g. https://api.staging.example.com)");
  process.exit(1);
}
if (!ADMIN_TOKEN) {
  console.error("ADMIN_TOKEN env var is required (admin JWT, not a session cookie)");
  process.exit(1);
}

const AUTH = {
  Authorization: `Bearer ${ADMIN_TOKEN}`,
  "Content-Type": "application/json",
};

/**
 * @typedef {{
 *   profile: "The Stressor" | "The Drifter" | "The Overwhelmed" | "The Master",
 *   step: number,
 *   title: string,
 *   description: string,
 * }} SeedRow
 */

/** @type {SeedRow[]} */
const TASKS = [
  // ── The Stressor ─────────────────────────────────────────────────────────
  { profile: "The Stressor", step: 1,  title: "Genuine Interest",              description: "Shift attention from yourself to something external to reduce anxiety and cognitive load." },
  { profile: "The Stressor", step: 2,  title: "The 3-Second Bridge",           description: "Pause for ~3 seconds between phrases to slow breathing and lower physiological arousal." },
  { profile: "The Stressor", step: 3,  title: "The Slow-Motion Replay",        description: "Speak in a steady, rhythmic pace to prevent rushing and stabilize speech motor control." },
  { profile: "The Stressor", step: 4,  title: "The Whisper Pitch",             description: "Speak softly to reduce vocal tension and force a relaxed voice." },
  { profile: "The Stressor", step: 5,  title: "The Nostalgia Anchor",          description: "Recall a familiar memory while speaking to ease pressure on working memory." },
  { profile: "The Stressor", step: 6,  title: "The Heavy Period",              description: "Pause briefly after each sentence to enforce structured, chunked communication." },
  { profile: "The Stressor", step: 7,  title: "The Empathy Read",              description: "Speak as if calming someone else to naturally adopt a slower, softer tone." },
  { profile: "The Stressor", step: 8,  title: "The Blindfold Drill",           description: "Remove visual distractions and focus entirely on voice control." },
  { profile: "The Stressor", step: 9,  title: "The Word-Count Cap (15 Words)", description: "Limit sentences to force precision and eliminate filler words." },
  { profile: "The Stressor", step: 10, title: "The Yawn Stretch",              description: "Use exaggerated vowel sounds or a yawn-like motion to relax the voice." },

  // ── The Drifter ──────────────────────────────────────────────────────────
  { profile: "The Drifter", step: 1,  title: "The Grandmother Test",        description: "Explain ideas in the simplest possible way, avoiding complexity and jargon." },
  { profile: "The Drifter", step: 2,  title: "Panama \u2192 Digging Deeper", description: "Stay strictly within one sub-topic and avoid drifting to related ideas." },
  { profile: "The Drifter", step: 3,  title: "Tech Term to Social Context", description: "Explain technical ideas using simple, real-world analogies." },
  { profile: "The Drifter", step: 4,  title: "The 3-Bullet Box",            description: "Structure responses into exactly three clear points." },
  { profile: "The Drifter", step: 5,  title: "The Taboo Game",              description: "Avoid overused buzzwords and find alternative phrasing." },
  { profile: "The Drifter", step: 6,  title: "The Headline First",          description: "State the main point first, then explain it." },
  { profile: "The Drifter", step: 7,  title: "The Interrogation",           description: "Deliver your point within a strict time limit." },
  { profile: "The Drifter", step: 8,  title: "The Keyword Anchor",          description: "Stay anchored to specific key words and build around them." },
  { profile: "The Drifter", step: 9,  title: "The Cut-off Switch",          description: "Practice ending thoughts quickly and cleanly when interrupted." },
  { profile: "The Drifter", step: 10, title: "The \u201CYes, And\u201D Constraint", description: "Build on ideas without contradicting the given premise." },

  // ── The Overwhelmed ──────────────────────────────────────────────────────
  { profile: "The Overwhelmed", step: 1,  title: "Cure to Zoning Out (Silly Questions)",  description: "Speak continuously without worrying about correctness to reduce pressure." },
  { profile: "The Overwhelmed", step: 2,  title: "The \u201CI Like\u201D List",            description: "List simple preferences to build speaking momentum." },
  { profile: "The Overwhelmed", step: 3,  title: "The Mirror Read",                        description: "Read aloud to focus only on delivery, not content creation." },
  { profile: "The Overwhelmed", step: 4,  title: "The Hedging Buzzer",                     description: "Avoid uncertain language and speak in clear, direct statements." },
  { profile: "The Overwhelmed", step: 5,  title: "The Volume Swell",                       description: "Gradually increase speaking volume to build confidence." },
  { profile: "The Overwhelmed", step: 6,  title: "The Memory Lane",                        description: "Talk about simple past experiences to reduce stress." },
  { profile: "The Overwhelmed", step: 7,  title: "The Opinion Stance (Dogs vs. Cats)",     description: "Take a clear stance on low-stakes topics and defend it." },
  { profile: "The Overwhelmed", step: 8,  title: "The Repetition Drill",                   description: "Repeat the same phrase with different tones and emotions." },
  { profile: "The Overwhelmed", step: 9,  title: "The No-Context Pitch ($1M Desk Object)", description: "Speak energetically about random objects without preparation." },
  { profile: "The Overwhelmed", step: 10, title: "The Absolute Statement",                 description: "Make strong, definitive statements without softening language." },

  // ── The Master ───────────────────────────────────────────────────────────
  { profile: "The Master", step: 1,  title: "Breakup to Full Picture",             description: "Rapidly shift emotional tone and intensity while speaking." },
  { profile: "The Master", step: 2,  title: "Friends vs. Presentation",            description: "Switch speaking style instantly depending on context." },
  { profile: "The Master", step: 3,  title: "Social Cues (Real-Time Adjustments)", description: "Adapt speech in response to unexpected inputs or reactions." },
  { profile: "The Master", step: 4,  title: "The Devil\u2019s Advocate",           description: "Argue a position opposite to your own convincingly." },
  { profile: "The Master", step: 5,  title: "The Heckler",                         description: "Maintain composure and clarity under simulated pressure or disruption." },
  { profile: "The Master", step: 6,  title: "The Pitch Shift",                     description: "Consciously control and vary vocal pitch." },
  { profile: "The Master", step: 7,  title: "The Socratic Trap",                   description: "Use questions to guide the listener\u2019s thinking." },
  { profile: "The Master", step: 8,  title: "The Extreme Code-Switch",             description: "Switch language style or tone dramatically mid-speech." },
  { profile: "The Master", step: 9,  title: "The Charisma Swell",                  description: "Gradually build energy and intensity throughout speech." },
  { profile: "The Master", step: 10, title: "The Silence Weapon",                  description: "Use deliberate silence to create impact and control attention." },
];

if (TASKS.length !== 40) {
  console.error(`Expected 40 tasks, got ${TASKS.length}`);
  process.exit(1);
}

/** Escape & < > " ' so raw text is safe inside HTML. */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render title+description into the rich-text format the recorder accepts. */
function buildTextHtml(row) {
  return `<p><strong>${escapeHtml(row.title)}</strong></p><p>${escapeHtml(row.description)}</p>`;
}

/** Plain text inside the first <strong>…</strong> of a stored row, used to detect duplicates. */
function extractFirstStrongText(html) {
  if (typeof html !== "string") return "";
  const m = html.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
  if (!m) return "";
  return m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchExistingPool() {
  const res = await fetch(`${BACKEND_URL}/v2/admin/tasks-pool`, { headers: AUTH });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET tasks-pool failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const list = Array.isArray(data.tasks_pool)
    ? data.tasks_pool
    : Array.isArray(data.task_warm_up_pool)
      ? data.task_warm_up_pool
      : [];
  return list;
}

async function postOne(row) {
  const body = {
    text: buildTextHtml(row),
    target_profile: row.profile,
    level: 1,
    step_in_level: row.step,
    is_active: true,
  };
  const res = await fetch(`${BACKEND_URL}/v2/admin/tasks-pool`, {
    method: "POST",
    headers: AUTH,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST failed (${res.status}) for "${row.title}": ${text}`);
  }
  return text;
}

async function main() {
  console.log(`Backend: ${BACKEND_URL}`);
  console.log("Fetching existing pool…");
  const existing = await fetchExistingPool();
  const existingActive = existing.filter((r) => r && r.is_active !== false);
  const existingTitles = new Set(
    existingActive
      .map((r) => extractFirstStrongText(r.text || ""))
      .filter(Boolean)
      .map((t) => t.toLowerCase())
  );
  console.log(`Existing active rows: ${existingActive.length}`);

  const toCreate = TASKS.filter((row) => !existingTitles.has(row.title.toLowerCase()));
  const skipped = TASKS.length - toCreate.length;
  console.log(`Will create: ${toCreate.length} · Skipping (already present by title): ${skipped}`);

  let created = 0;
  const errors = [];
  for (const row of toCreate) {
    try {
      await postOne(row);
      created += 1;
      console.log(`  ✓ ${row.profile} · L1·S${row.step} · ${row.title}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ row, message });
      console.error(`  ✗ ${row.profile} · L1·S${row.step} · ${row.title}: ${message}`);
    }
  }

  // Verification
  console.log("\nVerifying…");
  const after = await fetchExistingPool();
  const active = after.filter((r) => r && r.is_active !== false);
  /** @type {Record<string, number>} */
  const byProfile = { "The Stressor": 0, "The Drifter": 0, "The Overwhelmed": 0, "The Master": 0 };
  for (const r of active) {
    if (r.target_profile && byProfile[r.target_profile] != null) {
      byProfile[r.target_profile] += 1;
    }
  }
  const afterTitles = new Set(
    active.map((r) => extractFirstStrongText(r.text || "").toLowerCase()).filter(Boolean)
  );
  const missing = TASKS.filter((row) => !afterTitles.has(row.title.toLowerCase()));

  console.log("Active rows per profile:", byProfile);
  console.log(`Created this run: ${created} · Skipped: ${skipped} · Errors: ${errors.length}`);
  if (missing.length > 0) {
    console.error(`\nMissing ${missing.length} seeded titles in final GET:`);
    for (const row of missing) console.error(`  - ${row.profile} L1·S${row.step} "${row.title}"`);
  }

  if (errors.length > 0 || missing.length > 0) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
