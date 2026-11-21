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
  await page.waitForSelector("[data-build-home]");
  const bars = () => page.locator("[data-chat-header]").evaluateAll((els) => els.filter((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }).length);
  check(`${tag} the home has one top bar`, await bars() === 1);
  const labels = await page.locator("[data-build-tile]").evaluateAll((els) => els.map((el) => (el.textContent ?? "").replace(/\s+/g, "")));
  check(`${tag} tiles are Build, Settings, Test, AI`, labels.join(",") === "Build,Settings,Test,AI");
  check(`${tag} Build is the only highlight`, await page.locator("[data-tile-highlight]").count() === 1 && await page.locator("[data-build-tile='build'][data-tile-highlight]").count() === 1);
  check(`${tag} a new chat has no ticks`, await page.locator("[data-tile-tick]").count() === 0);
  const deadEnd = async (where) => {
    const search = await page.locator("[data-part-search]").count();
    const lone = await page.locator("[data-needs-you='chat']").count();
    check(`${tag} ${where} has no search and no lone row`, search === 0 && lone === 0);
  };
  check(`${tag} no tabs or search on the home`, await page.locator("[data-build-tab], [data-part-search]").count() === 0);
  await deadEnd("the home");
  const layout = await page.locator("[data-build-tile]").evaluateAll((els) => {
    const home = document.querySelector("[data-build-home]").getBoundingClientRect();
    return {
      homeW: home.width,
      boxes: els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    };
  });
  const near = (a, b) => Math.abs(a - b) <= 2;
  const equal = layout.boxes.every((box) => near(box.w, layout.boxes[0].w) && near(box.h, layout.boxes[0].h));
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1);
  if (width >= 768) {
    const oneRow = layout.boxes.every((box) => near(box.y, layout.boxes[0].y));
    const across = layout.boxes.every((box, i) => i === 0 || box.x > layout.boxes[i - 1].x);
    const span = layout.boxes[3].x + layout.boxes[3].w - layout.boxes[0].x;
    const ratio = span / layout.homeW;
    const square = layout.boxes.every((box) => near(box.w, box.h));
    check(`${tag} four columns at about 70% width`, oneRow && across && equal && square && ratio >= 0.65 && ratio <= 0.75 && noScroll);
  } else {
    const oneCol = layout.boxes.every((box) => near(box.x, layout.boxes[0].x));
    const down = layout.boxes.every((box, i) => i === 0 || box.y > layout.boxes[i - 1].y);
    const full = layout.boxes.every((box) => box.w >= layout.homeW - 40);
    check(`${tag} one column, full width`, oneCol && down && equal && full && noScroll);
  }
  check(`${tag} a chevron sits between the tiles`, await page.locator("[data-tile-chevron]").count() === 3);
  await page.locator("[data-icon-open]").click();
  check(`${tag} the icon opens the picker`, await page.locator("[data-chat-icon]").count() === 1);
  await page.locator("[data-icon-open]").click();
  await page.locator("[data-build-tile='build']").click();
  check(`${tag} Build has one top bar`, await bars() === 1);
  check(`${tag} there is no express button`, await page.locator("[data-express]").count() === 0);
  check(`${tag} no stepper, mic, or list`, await page.locator("[data-talk-steps], [data-talk-mic], [data-talk-list]").count() === 0);
  const jobs = await page.locator("[data-talk-replies] button").allInnerTexts();
  check(`${tag} the four jobs sit above the box`, jobs.map((t) => t.trim()).join(",") === "Speaking coach,ML specialist,Neurobiologist,Someone else");
  const replyBox = await page.locator("[data-talk-replies]").boundingBox();
  const composerBox = await page.locator("[data-talk-composer]").boundingBox();
  check(`${tag} taps sit above the input`, !!replyBox && !!composerBox && replyBox.y + replyBox.height <= composerBox.y + 2);
  const oneRow = async (where) => {
    check(`${tag} ${where} has one tap row`, await page.locator("[data-tap-row]").count() === 1);
  };
  const job = (name) => page.locator("[data-talk-replies]").getByRole("button", { name, exact: true });
  await oneRow("the jobs");
  await job("Speaking coach").click();
  await page.waitForSelector("text=Can people send you more than a typed message?");
  await oneRow("the send question");
  await page.locator("[data-my-answer]").first().click();
  check(`${tag} an earlier answer opens its taps`, (await page.locator("[data-talk-replies] button").allInnerTexts()).map((t) => t.trim()).join(",") === "Speaking coach,ML specialist,Neurobiologist,Someone else");
  await oneRow("an edited answer");
  await job("ML specialist").click();
  check(`${tag} the answer changes and the next question stays`, (await page.locator("[data-my-answer]").first().innerText()).trim() === "ML specialist" && (await page.locator("text=Can people send you more than a typed message?").count()) > 0);
  await page.locator("[data-my-answer]").first().click();
  await job("Speaking coach").click();
  await page.waitForSelector("text=Can people send you more than a typed message?");
  check(`${tag} the next question is one question`, (await page.locator("text=Say go?").count()) === 0);
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.waitForSelector("text=What can they send?");
  await oneRow("what they can send");
  await page.locator("[data-kind='rec']").click();
  await page.locator("[data-kinds-done]").click();
  check(`${tag} a speaking coach with a recording is asked the walk`, (await page.locator("text=best moment").count()) > 0);
  await oneRow("the question after send");
  for (const answer of ["Yes", "Yes", "Yes", "Yes", "No", "Yes", "No", "No"]) {
    await page.getByRole("button", { name: answer, exact: true }).click();
    await oneRow(answer);
  }
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.waitForSelector("[data-answer-list]");
  check(`${tag} Say go opens Settings`, await page.locator("[data-looks-right]").count() === 1 && await bars() === 1);
  await page.locator("[data-looks-right]").click();
  await page.waitForSelector("[data-visitor-try]");
  const tapBox = await page.locator("[data-visitor-taps]").boundingBox();
  const barBox = await page.locator("[data-visitor-try] [data-chat-bar]").boundingBox();
  const starterText = (await page.locator("[data-visitor-taps]").innerText()).replace(/\s+/g, " ");
  check(`${tag} Test taps sit above the box`, !!tapBox && !!barBox && tapBox.y + tapBox.height <= barBox.y + 2 && starterText.includes("Practise a talk") && !starterText.includes("How does memory"));
  await page.getByRole("button", { name: "This works", exact: true }).click();
  await page.waitForSelector("[data-build-models]");
  check(`${tag} This works opens AI`, await bars() === 1);
  await page.locator("[data-chat-header] button[aria-label='Back']").click();
  await page.waitForSelector("[data-build-home]");
  check(`${tag} done tiles have a check and AI is next`, await page.locator("[data-tile-tick='build']").count() === 1 && await page.locator("[data-tile-tick='settings']").count() === 1 && await page.locator("[data-tile-tick='test']").count() === 1 && await page.locator("[data-build-tile='ai'][data-tile-highlight]").count() === 1);
  await page.locator("[data-build-tile='settings']").click();
  await page.waitForSelector("[data-answer-list]");
  await deadEnd("Settings");
  check(`${tag} Settings has one top bar`, await bars() === 1);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  check(`${tag} the answer list fits`, wide && (await page.locator("[data-answer-list]").innerText()).includes("Your own code"));
  check(`${tag} each row shows a question and an answer`, (await page.locator("[data-answer-row]").count()) > 3);
  const rows = await page.locator("[data-answer-row]").evaluateAll((els) => els.map((el) => ({
    id: el.getAttribute("data-build-part"),
    title: el.querySelector("span")?.textContent?.trim() ?? "",
  })));
  for (const row of rows) {
    await page.locator(`[data-build-part='${row.id}']`).click();
    await page.waitForSelector(`[data-part-chat='${row.id}']`);
    const header = await page.locator("[data-chat-header]").innerText();
    check(`${tag} ${row.id} has one top bar`, await bars() === 1 && header.includes(row.title) && /\d+ of \d+/.test(header));
    await page.locator("[data-chat-header] button[aria-label='Back']").click();
    await page.waitForSelector("[data-answer-list]");
  }
  await page.locator("[data-build-part='code']").click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  check(`${tag} code offers describe or paste`, await page.locator("[data-code-way='tell']").count() === 1 && await page.locator("[data-code-way='paste']").count() === 1 && await bars() === 1);
  await page.locator("[data-code-way='tell']").click();
  await page.locator("[data-part-chat='code'] textarea").fill("Notice when they hedge.");
  await page.locator("[data-part-chat='code'] button[type='submit']").click();
  await page.waitForSelector("[data-code-summary]");
  check(`${tag} a description becomes one line`, (await page.locator("[data-code-summary]").innerText()).includes("It notices hedging"));
  await page.locator("[data-code-keep]").click();
  await page.waitForSelector("[data-answer-list]");
  await page.locator("[data-build-bar] button[aria-label='Back']").click();
  await page.waitForSelector("[data-build-home]");
  check(`${tag} Settings has a tick`, await page.locator("[data-tile-tick='settings']").count() === 1);
  await page.locator("[data-build-tile='test']").click();
  await page.waitForSelector("[data-visitor-try]");
  await deadEnd("Test");
  check(`${tag} Test has one top bar`, await bars() === 1);
  await page.locator("[data-visitor-rec]").click();
  await page.waitForFunction(() => document.querySelectorAll("[data-visitor-line='them']").length > 1);
  check(`${tag} a visitor send gets the chat's reply`, (await page.locator("[data-visitor-try]").innerText()).includes("It notices hedging"));
  await page.locator("[data-visitor-try] button[aria-label='Back']").click();
  check(`${tag} back returns to the builder`, await page.locator("[data-build-home]").count() === 1);
  check(`${tag} Test has a tick and AI does not`, await page.locator("[data-tile-tick='test']").count() === 1 && await page.locator("[data-tile-tick='ai']").count() === 0);
  await page.locator("[data-build-tile='ai']").click();
  await page.waitForSelector("[data-build-models]");
  check(`${tag} AI has one top bar`, await bars() === 1);
  await page.locator("[data-chat-header] button[aria-label='Back']").click();
  await page.waitForSelector("[data-build-home]");
  const share = page.locator("[data-build-bar] [data-share-chat]");
  const box = await share.boundingBox();
  check(`${tag} share is on screen`, !!box && box.x >= 0 && box.x + box.width <= width + 1);
  await share.click();
  await page.waitForSelector("[data-link-copied]");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check(`${tag} share copies /c/`, copied.includes("/c/"));
  await page.locator("[data-build-tile='build']").click();
  await page.locator("[data-talk-replies]").getByRole("button", { name: "Neurobiologist", exact: true }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.locator("[data-kind='rec']").click();
  await page.locator("[data-kinds-done]").click();
  const asked = await page.locator("[data-talk-build]").innerText();
  check(`${tag} a neurobiologist with a recording skips the walk`, !asked.includes("best moment") && !asked.includes("helper words") && asked.includes("What do people ask you?"));
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
