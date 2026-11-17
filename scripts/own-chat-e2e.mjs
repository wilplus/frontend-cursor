/* The host's own chat, on a phone. The starter row, the sheet, the pin,
   the share control and Back.
   node scripts/own-chat-e2e.mjs */
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const PORT = 3319;
const base = `http://127.0.0.1:${PORT}`;
const checks = [];
const check = (name, ok) => {
  checks.push(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) console.error(checks.at(-1));
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
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("dev server did not start");
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
async function run(width, height) {
  const tag = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, permissions: ["clipboard-read", "clipboard-write"] });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(`${base}/dev/own-chat`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-own-chat-screen]");
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  });
  await page.locator("[data-home-row='start-own-chat'] button").click();
  await page.locator("[data-own-chat-yes]").click();
  await page.locator("[data-talk-open]").click();
  await page.locator("[data-express]").click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.locator("[data-talk-list]").click();
  await page.waitForSelector("[data-answer-list]");
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check(`${tag} the answer list fits`, wide && (await page.locator("[data-answer-list]").innerText()).includes("Your own code"));
  check(`${tag} each row shows a question and an answer`, (await page.locator("[data-answer-row]").count()) > 3);
  await page.locator("[data-build-part='hello']").click();
  await page.waitForSelector("[data-part-chat='hello']");
  check(`${tag} a row opens its question`, true);
  await page.locator("[data-part-chat='hello'] button[aria-label='Back']").click();
  await page.locator("[data-build-part='code']").click();
  check(`${tag} your own code is one tap`, (await page.locator("[data-part-chat='code']").innerText()).includes("Add a small piece of code"));
  await page.locator("[data-part-chat='code'] button[aria-label='Back']").click();
  await page.locator("[data-try-visitor]").click();
  await page.waitForSelector("[data-visitor-try]");
  await page.locator("[data-visitor-rec]").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-visitor-line='them']").length > 1);
  check(`${tag} a visitor send gets the chat's reply`, true);
  await page.locator("[data-visitor-try] button[aria-label='Back']").click();
  check(`${tag} back returns to the builder`, await page.locator("[data-answer-list]").count() === 1);
  const share = page.locator("[data-build-bar] [data-share-chat]");
  const box = await share.boundingBox();
  check(`${tag} share is on screen`, !!box && box.x >= 0 && box.x + box.width <= width + 1);
  await share.click();
  await page.waitForSelector("[data-link-copied]");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check(`${tag} share copies /c/`, copied.includes("/c/"));
  await context.close();
}

try {
  await waitForServer();
  await run(390, 844);
  await run(1024, 768);
} catch (error) {
  check("the phone run finished", false);
  console.error(error);
} finally {
  const passed = checks.filter((line) => line.startsWith("PASS")).length;
  console.log(checks.join("\n"));
  console.log(`OWN CHAT ${passed}/${checks.length}`);
  await browser.close().catch(() => undefined);
  server.kill("SIGKILL");
  process.exit(passed === checks.length ? 0 : 1);
}
