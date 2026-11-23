/* The row chats, on a phone. Yes and No on the last step of every
   yes/no row must show the answer and open the next row.
   node scripts/row-yes-e2e.mjs */
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const PORT = 3318;
const base = `http://127.0.0.1:${PORT}`;
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
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
      const res = await fetch(`${base}/dev/row-yes`);
      if (res.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("dev server did not start");
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
try {
  await waitForServer();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recipe: { suggest: {} }, cost: null }) });
  });

  async function lastStep(part, steps, answer) {
    await page.goto(`${base}/dev/row-yes`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-row-yes]");
      return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
    });
    await page.click(`[data-build-part="${part}"]`);
    try {
      await page.waitForSelector("[data-setup-dock]", { timeout: 8000 });
    } catch (error) {
      check(`${part} opens its question`, false, await page.locator("body").innerText());
      throw error;
    }
    for (let i = 0; i < steps - 1; i += 1) {
      const before = await page.locator("[data-will-line]").last().innerText();
      await page.locator("[data-setup-dock] button", { hasText: "Yes" }).click();
      await page.waitForFunction((was) => {
        const line = [...document.querySelectorAll("[data-will-line]")].filter((el) => !el.closest("[data-setup-history]")).at(-1)?.textContent ?? "";
        return line !== was;
      }, before);
    }
    const bubble = page.locator("[data-my-line]").last();
    await page.locator("[data-setup-dock] button", { hasText: answer }).click();
    await page.waitForFunction((id) => document.querySelector("[data-row-now]")?.textContent !== id, part);
    const now = await page.locator("[data-row-now]").innerText();
    check(`${part} last ${answer} opens the next row`, now !== part, `${part} -> ${now}`);
    check(`${part} last ${answer} was said`, true);
    void bubble;
  }

  for (const answer of ["Yes", "No"]) {
    await lastStep("send", 4, answer);
    await lastStep("walk", 3, answer);
  }
  const passed = checks.filter((line) => line.startsWith("PASS")).length;
  console.log([...checks, `ROWS ${passed}/${checks.length}`].join("\n"));
  if (passed !== checks.length) process.exitCode = 1;
} finally {
  server.kill("SIGKILL");
  setTimeout(() => process.exit(process.exitCode ?? 0), 200);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2000))]);
}
