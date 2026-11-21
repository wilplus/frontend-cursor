/* Voice-model screens, against a mocked draft of backend PR #2005.
   node scripts/voice-model-shots.mjs
   The fixture lives in this script, not in the UI. */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const PORT = 3327;
const base = `http://127.0.0.1:${PORT}`;
const out = "/opt/cursor/artifacts";
mkdirSync(out, { recursive: true });

const MODEL = {
  id: "wpl_arousal@0.1",
  name: "Voice and words",
  measures: "How much you join in, how your voice moves, how it lands and how clear it was",
  language: "pl",
  source: "built_in",
  research_only: true,
  needs_baseline: true,
  steps: ["engagement", "arousal", "valence", "clarity"],
  version: "0.1",
  baseline_prompt_ids: ["b1", "b2", "b3"],
  schema: "analyze-take/v0.1",
};

const TAKE = {
  schema: "analyze-take/v0.1",
  value_range: [-1, 1],
  thresholds: {},
  takes: [{
    take_id: "t1",
    prompt_tag: "baseline_calm",
    order: ["engagement", "arousal", "valence", "clarity"],
    moments: [{ t_start: 0, t_end: 1, grid: [{ step: "arousal", cue: "loudness", value: null, vs: "baseline" }] }],
    summary: {
      engagement: { score: 0.2, confidence: 0.9, vs: "baseline", unlocked: true },
      arousal: { score: null, confidence: 0.2, vs: "baseline", unlocked: false },
      valence: { score: null, confidence: 0.1, vs: "reference", unlocked: false },
      clarity: { score: null, confidence: 0.1, vs: "reference", unlocked: false },
    },
    gate: { step: "arousal", reason: "confidence too low" },
  }],
  intervention: [{ id: "i1", name: "Join in", text: "Say one more sentence.", step: "engagement", score: 2 }],
};

let polls = 0;
const checks = [];
const check = (name, ok) => {
  checks.push(`${ok ? "PASS" : "FAIL"} ${name}`);
  console.log(checks[checks.length - 1]);
};

const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon",
    NEXT_PUBLIC_API_URL: "http://127.0.0.1:9",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/dev/own-chat`);
      if (res.status < 500) return;
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("dev server did not start");
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route("**/*", async (route) => {
  const url = route.request().url();
  if (!url.startsWith(base)) return route.abort();
  if (url.includes("/api/v2/experiments/models")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ models: [MODEL] }) });
  }
  if (url.includes("/experiment-config")) {
    const body = route.request().postData() || JSON.stringify({ model_id: MODEL.id, needs_baseline: true, baseline_prompts: [] });
    return route.fulfill({ status: 200, contentType: "application/json", body });
  }
  if (url.includes("/api/v2/experiments/sessions") && route.request().method() === "POST" && !url.includes("/takes")) {
    console.log("session", url);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "ses_1" }) });
  }
  if (url.includes("/takes") && route.request().method() === "POST" && !url.includes("analysis")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t1" }) });
  }
  if (url.includes("/analyze-take")) {
    return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ take_id: "t1", status: "queued" }) });
  }
  if (url.includes("/api/")) console.log("API", route.request().method(), url);
  if (url.includes("/analysis")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TAKE) });
  }
  if (url.includes("/api/v2/experiments/me") && route.request().method() === "DELETE") {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true }) });
  }
  return route.continue();
});

const page = await context.newPage();

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`shot ${name}`);
}

try {
  await waitForServer();
  await page.goto(`${base}/dev/own-chat`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-own-chat-screen]");
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  });
  await page.waitForSelector("[data-home-row='start-own-chat'] button");
  await page.locator("[data-home-row='start-own-chat'] button").click();
  await page.waitForSelector("[data-own-chat-yes]");
  await page.locator("[data-own-chat-yes]").click();
  await page.waitForSelector("[data-build-home]");
  await page.locator("[data-build-tile='build']").click();
  await page.locator("[data-talk-replies]").getByRole("button", { name: "Speaking coach", exact: true }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.locator("[data-kind='rec']").click();
  await page.locator("[data-kinds-done]").click();
  await page.waitForSelector("text=Should your chat listen to how people speak?");
  check("the listen question is one yes or no", (await page.locator("[data-tap-row] button").allInnerTexts()).map((t) => t.trim()).join(",") === "No,Yes");
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.waitForSelector("[data-voice-model='wpl_arousal@0.1']");
  check("the catalog is the route, with the research badge", (await page.locator("[data-voice-model='wpl_arousal@0.1']").innerText()).includes("Voice and words") && (await page.locator("[data-research-badge]").innerText()).includes("For research and testing only"));
  await shot("voice-picker");
  await page.locator("[data-voice-model='wpl_arousal@0.1']").click();
  await page.locator("[data-build-bar] button[aria-label='Back']").click();
  await page.waitForSelector("[data-build-home]");
  await page.locator("[data-build-tile='settings']").click();
  await page.waitForSelector("[data-voice-row='calm']");
  check("settings keeps the model and the calm row", (await page.locator("[data-voice-row='model']").innerText()).includes("Voice and words"));
  await page.locator("[data-voice-row='calm']").click();
  await page.waitForSelector("[data-calm-text='b1']");
  await shot("voice-baseline");
  await page.locator("[data-build-bar] button[aria-label='Back']").click();
  await page.locator("[data-build-tile='test']").click();
  await page.waitForSelector("[data-voice-consent]");
  await shot("voice-consent");
  check("consent names the AI and delete", (await page.locator("[data-voice-consent]").innerText()).includes("An AI reads the recording") && await page.locator("[data-voice-delete]").count() === 1);
  await page.getByRole("button", { name: "I agree", exact: true }).click();
  await page.waitForSelector("[data-voice-calm-line]");
  check("calm answers come before the real question", (await page.locator("[data-voice-calm-line]").innerText()).includes("First we hear your normal voice"));
  await page.locator("[data-visitor-rec]").click();
  await page.waitForSelector("[data-voice-energy]");
  check("energy is the only rating row", await page.locator("[data-voice-feeling]").count() === 0);
  await shot("voice-rating");
  await page.locator("[data-voice-energy] button", { hasText: "Low" }).click();
  await page.waitForSelector("[data-voice-feeling]");
  check("feeling comes after energy", await page.locator("[data-voice-energy]").count() === 0);
  await page.locator("[data-voice-feeling] button", { hasText: "Good" }).click();
  await page.waitForSelector("[data-voice-listening]");
  await shot("voice-listening");
  await page.waitForSelector("[data-voice-read]");
  check("a locked step has no score", (await page.locator("[data-voice-step='arousal']").innerText()).includes("Not clear enough yet") && (await page.locator("[data-voice-tip]").innerText()) === "Say one more sentence.");
  await shot("voice-result");
} catch (error) {
  check("the voice run finished", false);
  console.error(error);
  await page.screenshot({ path: `${out}/voice-failed.png` }).catch(() => undefined);
} finally {
  const passed = checks.filter((line) => line.startsWith("PASS")).length;
  console.log(`VOICE MODEL ${passed}/${checks.length}`);
  await browser.close().catch(() => undefined);
  server.kill("SIGKILL");
  process.exit(passed === checks.length && checks.length > 0 ? 0 : 1);
}
