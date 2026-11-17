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
try {
  await waitForServer();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    return route.abort();
  });
  await page.goto(`${base}/dev/own-chat`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-own-chat-screen]");
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  });

  const order = () => page.locator("[data-home-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-home-row")));
  const before = await order();
  check("starter is the last chat row", before.at(-1) === "start-own-chat" && before[0] === "speaking-coach");
  const rowBox = await page.locator("[data-home-row='start-own-chat']").boundingBox();
  const actionBox = await page.locator("[data-start-new-project]").boundingBox();
  check("starter sits above Start a new project", !!rowBox && !!actionBox && rowBox.y < actionBox.y);

  await page.locator("[data-home-row='start-own-chat'] button").click();
  await page.waitForSelector("[data-own-chat-sheet]");
  check("the sheet explains the chat", (await page.locator("[data-own-chat-sheet]").innerText()).includes("Make your own chat"));
  await page.locator("[data-own-chat-close]").click();
  check("Close leaves the starter at the bottom", (await order()).at(-1) === "start-own-chat");

  await page.locator("[data-home-row='start-own-chat'] button").click();
  await page.locator("[data-own-chat-yes]").click();
  await page.waitForSelector("[data-build-bar]");
  check("Yes opens Build", await page.locator("[data-build-bar]").count() === 1);
  await page.locator("[data-chat-header] button[aria-label='Back']").click();
  await page.waitForSelector("[data-home-row='own-chat']");
  const after = await order();
  check("the chat is pinned at the top", after[0] === "own-chat" && !after.includes("start-own-chat"));
  check("the pinned circle wears the badge", await page.locator("[data-home-row='own-chat'] [data-will-badge]").count() === 1);

  await page.locator("[data-home-row='own-chat'] button").click();
  await page.waitForSelector("[data-share-chat]");
  await page.locator("[data-share-chat]").click();
  await page.waitForSelector("[data-link-copied]");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check("Share copies the public link", copied.includes("/c/"));
  await page.locator("[data-chat-header] button[aria-label='Back']").click();
  check("Back returns to the list", (await order())[0] === "own-chat");
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
