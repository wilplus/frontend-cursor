/* The talk, on a phone, the way the deck's e2e drives a page.
   node scripts/talk-e2e.mjs
   It starts the dev server, blocks every request that is not that server,
   and scores the run. Nothing is published off this machine. */
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const PORT = 3317;
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
let ready = false;
server.stdout.on("data", (chunk) => {
  const text = String(chunk);
  if (text.includes("Ready") || text.includes("started")) ready = true;
});
server.stderr.on("data", (chunk) => {
  const text = String(chunk);
  if (text.includes("Ready") || text.includes("started")) ready = true;
});

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/dev/talk`);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("dev server did not start");
}

function grade(text) {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length) return 0;
  const words = sentences.flatMap((s) => s.split(/\s+/).filter(Boolean));
  const syl = words.reduce((n, word) => {
    const bare = word.toLowerCase().replace(/[^a-z]/g, "").replace(/e$/, "");
    const groups = bare.match(/[aeiouy]+/g);
    return n + Math.max(1, groups ? groups.length : 1);
  }, 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
try {
  await waitForServer();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    window.__said = "Yes";
    class Rec {
      start() {
        const transcript = window.__said;
        setTimeout(() => this.onresult?.({ results: [[{ transcript }]] }), 20);
      }
    }
    window.SpeechRecognition = Rec;
  });
  const outside = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("data:")) return route.continue();
    outside.push(url);
    return route.abort();
  });

  const click = async (text) => {
    await page.getByRole("button", { name: text }).first().click();
  };
  const send = async (text) => {
    await page.locator("[data-talk-composer] textarea").fill(text);
    await page.locator("[data-talk-composer] button[type='submit']").click();
  };
  const say = async (text) => {
    await page.evaluate((value) => { window.__said = value; }, text);
    await page.locator("[data-talk-mic]").click();
    await page.waitForTimeout(40);
  };
  const snap = () => page.locator("[data-talk-snap]").getAttribute("data-talk-snap").then((raw) => JSON.parse(raw));

  async function open() {
    await page.goto(`${base}/dev/talk`, { waitUntil: "networkidle" });
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await click("Talk it through");
    await page.waitForSelector("[data-talk-build]");
  }

  async function coach(mode) {
    await open();
    const give = async (text) => {
      if (mode === "tap") {
        const quote = page.locator(`[data-say="${text}"]`);
        if (await quote.count()) {
          await quote.first().click();
          await page.locator("[data-talk-composer] button[type='submit']").click();
          return;
        }
        await click(text);
        return;
      }
      if (mode === "type") return send(text);
      return say(text);
    };
    await give("Speaking coach");
    await page.waitForSelector("text=Can they send a recording?");
    await click("Undo");
    check(`${mode} undo returns to the brief`, (await page.locator("text=What do you do?").count()) > 0);
    await give("Speaking coach");
    for (const answer of ["Yes", "Yes", "No", "No", "Yes", "Yes", "Yes", "Yes", "No", "Yes", "No", "No"]) await give(answer);
    check(`${mode} plan before build`, (await page.locator("text=Say go?").count()) > 0);
    check(`${mode} not saved as the live coach yet`, (await page.locator("[data-talk-greeting]").count()) === 0);
    await give("Yes");
    const saved = await snap();
    check(`${mode} speaking coach snap`, saved.spec === "Speaking coach" && saved.send.join(",") === "rec,text" && saved.who === "shadow");
    check(`${mode} greeting`, (await page.locator("[data-talk-greeting]").innerText()).includes("Record a short talk"));
    check(`${mode} keep and next`, (await page.locator("[data-preview-keep]").count()) === 1 && (await page.locator("[data-preview-next]").count()) === 1);
  }

  async function shop(mode) {
    await open();
    if (mode === "tap") await say("A shop");
    else if (mode === "type") await send("A shop");
    else await say("A shop");
    const give = async (text) => {
      if (mode === "type") return send(text);
      if (mode === "voice") return say(text);
      const quote = page.locator(`[data-say="${text}"]`);
      if (await quote.count()) {
        await quote.first().click();
        if (text !== "Write this for me") await page.locator("[data-talk-composer] button[type='submit']").click();
        return;
      }
      if (text === "A second one") return say(text);
      if (text === "Write this for me") return click("Write this for me");
      if (text === "Keep") return click("Keep");
      await click(text);
    };
    for (const answer of ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "No", "No", "Yes", "No", "Yes", "Yes", "Yes"]) await give(answer);
    await give("Did they hedge?");
    await give("Yes");
    await give("A second one");
    await give("Yes");
    await give("Write this for me");
    await give("Keep");
    await give("Yes");
    const saved = await snap();
    check(`${mode} shop fields`, saved.spec === "A shop" && saved.price === 1 && saved.model === "hedge" && saved.paste.includes("id: hedge") && saved.otherModels[0] === "A second one" && saved.who === "assistant");
  }

  for (const mode of ["tap", "type", "voice"]) {
    await coach(mode);
    await shop(mode);
  }

  await open();
  check("you decide is on the brief", (await page.locator("[data-say='You decide']").count()) === 1);
  await click("Just build it");
  check("express reaches the plan", (await page.locator("text=Say go?").count()) > 0);
  await click("Yes");
  const boxes = await page.$$eval("[data-talk-screen] button", (els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { text: (el.textContent || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
  }));
  const small = boxes.filter((b) => b.w < 44 || b.h < 44);
  check("every tap target is at least 44px", small.length === 0, small.map((b) => `${b.text} ${b.w}x${b.h}`).join("; "));
  const bars = await page.evaluate(() => [...document.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    const y = (s.overflowY === "auto" || s.overflowY === "scroll") && s.scrollbarWidth !== "none" && el.scrollHeight > el.clientHeight + 2;
    const x = (s.overflowX === "auto" || s.overflowX === "scroll") && s.scrollbarWidth !== "none" && el.scrollWidth > el.clientWidth + 2;
    return y || x;
  }).map((el) => el.className.toString().slice(0, 80)));
  check("no scrollbars", bars.length === 0, bars.join("; "));
  const words = await page.locator("[data-talk-screen]").innerText();
  check("reading level at most grade 6", grade(words) <= 6, String(Math.round(grade(words) * 10) / 10));
  check("see the list is there", (await page.locator("[data-talk-list]").count()) === 1);
  await page.locator("[data-talk-back]").click();
  check("back from the talk opens the list", (await page.locator("[data-talk-open]").count()) === 1);
  await page.locator("[data-talk-back]").click();
  check("back from the list opens home", (await page.locator("[data-talk-home]").count()) === 1);
  check("no request left this machine", outside.length === 0, outside.slice(0, 3).join(" "));

  const passed = checks.filter((line) => line.startsWith("PASS")).length;
  const score = Math.round((1000 * passed) / checks.length) / 10;
  console.log([...checks, `USABILITY ${passed}/${checks.length} = ${score}%`].join("\n"));
  if (passed / checks.length < 0.95) process.exitCode = 1;
} finally {
  server.kill("SIGKILL");
  setTimeout(() => process.exit(process.exitCode ?? 0), 200);
  await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 2000))]);
}
