/* Screenshots of the experiment area at 1280x800.
   node scripts/experiments-shots.mjs */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const PORT = 3323;
const base = `http://127.0.0.1:${PORT}`;
const out = "/opt/cursor/artifacts";
mkdirSync(out, { recursive: true });

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
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("dev server did not start");
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(base)) return route.continue();
  return route.abort();
});
const page = await context.newPage();
const problems = [];

async function shot(name) {
  const fit = await page.evaluate(() => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
    };
    const bars = [...document.querySelectorAll("[data-chat-header], [data-one-top-bar]")].filter(visible);
    const scrollers = [...document.querySelectorAll("*")].filter((el) => {
      if (!visible(el)) return false;
      const style = getComputedStyle(el);
      const oy = style.overflowY;
      if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
      return el.scrollHeight > el.clientHeight + 2;
    }).map((el) => el.getAttribute("data-exp-screen") || el.getAttribute("data-build-models") || el.tagName);
    const doc = document.documentElement;
    return {
      bars: bars.length,
      extraBars: bars.filter((el) => el.hasAttribute("data-one-top-bar")).length,
      pageFits: doc.scrollHeight <= doc.clientHeight + 1 && doc.scrollWidth <= doc.clientWidth + 1,
      scrollers,
    };
  });
  await page.screenshot({ path: `${out}/${name}.png` });
  const bad = fit.bars !== 1 || fit.extraBars !== 0 || !fit.pageFits || fit.scrollers.length > 0;
  if (bad) problems.push(`${name} ${JSON.stringify(fit)}`);
  console.log(`${bad ? "BAD " : "ok  "}${name} ${JSON.stringify(fit)}`);
}

try {
  await waitForServer();
  await page.goto(`${base}/dev/own-chat`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-own-chat-screen]");
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  });
  await page.waitForSelector("[data-home-row='start-own-chat'] button");
  await page.locator("[data-home-row='start-own-chat'] button").click();
  await page.waitForSelector("[data-own-chat-yes]");
  await page.locator("[data-own-chat-yes]").click();
  await page.waitForSelector("[data-build-home]");
  await page.locator("[data-build-tile='ai']").click();
  await page.waitForSelector("[data-ai-split]");
  await shot("exp-split");
  await page.locator("[data-ai-choice='training']").click();
  await page.waitForSelector("[data-build-models]");
  await shot("exp-training");
  await page.locator("[data-build-bar] button[aria-label='Back']").click();
  await page.waitForSelector("[data-ai-split]");
  await page.locator("[data-ai-choice='experiments']").click();
  await page.waitForSelector("[data-exp-go='session']");
  await page.locator("[data-exp-go='session']").click();
  await page.waitForSelector("[data-exp-screen='consent']");
  await shot("exp-consent");
  await page.locator("[data-pair='consent'] [data-choice='yes']").click();
  await page.waitForSelector("[data-exp-screen='upload']");
  await page.locator("[data-pair='page'] [data-choice='no']").click();
  await page.waitForSelector("[data-exp-screen='baseline']");
  await shot("exp-baseline");
  for (let i = 0; i < 20; i += 1) {
    const id = await page.locator("[data-prompt-id]").getAttribute("data-prompt-id");
    if (id === "c5") break;
    await page.locator("[data-pair='said'] [data-choice='no']").click();
  }
  await page.waitForSelector("[data-prompt-id='c5']");
  await page.locator("[data-pair='said'] [data-choice='yes']").click();
  await page.locator("[data-pair='energy'] [data-choice='low']").click();
  await page.locator("[data-pair='feeling'] [data-choice='tense']").click();
  await shot("exp-take-rating");
  await page.locator("[data-pair='save'] [data-choice='yes']").click();
  await page.waitForSelector("[data-exp-screen='analysis']");
  await shot("exp-analysis");
  await page.locator("[data-pair='next'] [data-choice='yes']").click();
  await page.waitForSelector("[data-exp-screen='pick']");
  await shot("exp-pick");
  await page.locator("[data-pair='mode'] [data-choice='rules']").click();
  await page.waitForSelector("[data-exp-screen='rules']");
  await shot("exp-rules");
  const back = () => page.locator("[data-build-bar] button[aria-label='Back']").click();
  for (let i = 0; i < 8; i += 1) {
    if (await page.locator("[data-exp-screen='menu']").count()) break;
    await back();
    await page.waitForTimeout(100);
  }
  await page.locator("[data-exp-go='library']").click();
  await page.waitForSelector("[data-exp-screen='library']");
  await shot("exp-library");
  await back();
  await page.waitForSelector("[data-exp-screen='menu']");
  await page.locator("[data-pair='pages'] [data-choice='yes']").click();
  await page.locator("[data-pair='pages'] [data-choice='yes']").click();
  await page.locator("[data-exp-go='export']").click();
  await page.waitForSelector("[data-exp-screen='export']");
  await page.locator("[data-pair='audience'] [data-choice='researcher']").click();
  await shot("exp-export");
  await back();
  await page.locator("[data-exp-go='delete']").click();
  await page.waitForSelector("[data-exp-screen='delete']");
  await shot("exp-delete");
} catch (error) {
  console.error(error);
  await page.screenshot({ path: `${out}/exp-fail.png` }).catch(() => undefined);
  const text = await page.locator("body").innerText().catch(() => "");
  console.log(text.slice(0, 800));
  problems.push(String(error));
} finally {
  console.log(problems.length ? `SHOTS ${problems.length} problems` : "SHOTS ok");
  await browser.close().catch(() => undefined);
  server.kill("SIGKILL");
  process.exit(problems.length ? 1 : 0);
}
