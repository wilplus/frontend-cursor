// v3 tour + e2e: node test-v3.mjs <outDir>
import { chromium } from "playwright-core";
import fs from "node:fs";
const out = process.argv[2] || "/workspace/willpowerlab/shots/v3";
fs.mkdirSync(out, { recursive: true });
const base = "http://127.0.0.1:8817/chat-continue-prototype-deckgen.html";
const errors = [];
const checks = [];
const check = (name, ok, detail = "") => { checks.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const listen = (p) => { p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); }); p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`)); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const page = await ctx.newPage();
listen(page);
const shot = (n, p = page) => p.screenshot({ path: `${out}/${n}.png` });
const idle = async (p = page) => { await p.waitForFunction(() => !document.querySelector(".wlp-deck-state.is-busy, .wlp-deck-typing, .wlp-deck-state.is-listening"), null, { timeout: 30000 }); await p.waitForTimeout(700); };
const say = async (text, p = page) => { await idle(p); await p.fill("#wlp-deck-input", text); await p.click("#wlp-deck-send"); await idle(p); };
const lastBot = (p = page) => p.locator(".wlp-deck-thread-inner > .wlp-deck-row:not(.me) .wlp-deck-bubble").last().innerText();
const titles = (p = page) => p.$$eval('[data-deck-live-board="structure"] [data-deck-edit="title"]', (els) => els.map((e) => e.textContent));
const tap = async (sel, p = page) => { const b = await p.locator(sel).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); };
const hold = async (sel, ms, p = page, shotName) => { const b = await p.locator(sel).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(ms); if (shotName) await shot(shotName, p); await p.mouse.up(); };
const scrollTo = (sel, p = page) => p.evaluate((s) => { const el = [...document.querySelectorAll(s)].at(-1); const t = document.querySelector(".wlp-deck-thread"); if (el && t) t.scrollTop = el.getBoundingClientRect().top - t.getBoundingClientRect().top + t.scrollTop - 12; }, sel);

// 1. Real route: setup step 6 -> "No deck? Generate one"
await page.goto(base);
await page.click("[data-sunday-dismiss]");
await page.click("#wlp-projects");
await page.click("[data-sheet-new]");
await page.fill("#wlp-project-name", "WillpowerLab seed pitch");
await page.click("[data-create-confirm]");
await page.click("#wlp-continue");
await page.click("[data-feelings-skip]");
await page.click("[data-setup-next]");
await page.click('[data-setup-length="600"]');
await page.click("[data-setup-next]");
await page.click("[data-deckgen-open]");
await idle();
const dock = await page.$$eval(".wlp-deck-composer button, .wlp-deck-composer textarea", (els) => els.map((e) => e.className));
check("dock is mic + text + send only", dock.length === 3, JSON.stringify(dock));
check("placeholder states the next step", /who's it for/i.test(await page.getAttribute("#wlp-deck-input", "placeholder")));
await shot("01-brief");

// 2. Tap mic: live transcript streams, then lands in the field for review
await tap("[data-deck-mic]");
await page.waitForSelector(".wlp-deck-live");
await page.waitForTimeout(700);
const interim = await page.locator(".wlp-deck-live").innerText();
check("live transcript while listening", interim.length > 3 && !/listening…/i.test(interim), interim);
await shot("02-dictating");
await page.waitForSelector("#wlp-deck-input", { timeout: 10000 });
const dictated = await page.inputValue("#wlp-deck-input");
check("tap-to-dictate fills the field, does not send", /Investors/.test(dictated) && (await page.locator(".wlp-deck-row.me").count()) === 0, dictated);
await page.click("#wlp-deck-send");
await idle();

// 3. Hold to talk: release sends
await hold("[data-deck-mic]", 1500, page, "03-hold-to-talk");
await idle();
const voiced = await page.locator(".wlp-deck-row.me .wlp-deck-voice-tag").count();
check("hold-to-talk sends on release (marked as spoken)", voiced === 1, `voice bubbles: ${voiced}`);
await say("Practising out loud with honest feedback makes anyone sound confident");
await page.waitForSelector('[data-deck-live-board="structure"]');
const t1 = await titles();
check("plan generated", t1.length >= 6, t1.join(" | "));
check("placeholder says what's next", /looks good/i.test(await page.getAttribute("#wlp-deck-input", "placeholder")));
await scrollTo('[data-deck-live-board="structure"]');
await shot("04-plan");

// 4. Plan edits by voice/text + undo + tap-to-place
await say("Move traction to slide 3");
const t2 = await titles();
check("voice move by slide name", /1,200|waitlist|traction/i.test(t2[2]), t2[2]);
await shot("05-plan-moved");
await say("undo");
const t3 = await titles();
check("undo restores order", JSON.stringify(t3) === JSON.stringify(t1));
await say("Another version of slide 2");
const t4 = await titles();
check("regenerate one slide", t4[1] !== t1[1], `${t1[1]} -> ${t4[1]}`);
await say("Add a slide about pricing after slide 7");
check("add slide", (await titles()).length === t1.length + 1);
await say("delete slide 8");
check("delete slide", (await titles()).length === t1.length);
await page.click('[data-deck-grip="4"]');
await page.click('[data-deck-slot="1"]');
await page.waitForTimeout(700);
const t5 = await titles();
check("tap-to-place reorder", t5[1] === t4[4], t5[1]);
check("undo chip visible", await page.locator("[data-deck-undo]").isVisible());

// 5. Approve -> live narrated build, interruptible
await idle();
await page.fill("#wlp-deck-input", "Looks good");
await page.click("#wlp-deck-send");
await page.waitForFunction(() => /Slide \d+ of/.test(document.querySelector(".wlp-deck-state")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
const status = await page.locator(".wlp-deck-state").innerText().catch(() => "");
check("narrated build status", /Slide \d+ of \d+/.test(status), status);
check("skeletons for slides not built yet", (await page.locator(".wlp-deck-item.is-pending").count()) > 0);
await shot("06-building");
await page.waitForFunction(() => /Slide 5 of/.test(document.querySelector(".wlp-deck-state")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(120);
const followed = await page.evaluate(() => { const t = document.querySelector(".wlp-deck-thread").getBoundingClientRect(); const el = document.querySelectorAll('[data-deck-live-board="visuals"] .wlp-deck-item')[4]?.getBoundingClientRect(); return Boolean(el) && el.top < t.bottom && el.bottom > t.top; });
check("build view follows the slide being built", followed);
await shot("06b-building-slide5");
await idle();
const items = await page.locator('[data-deck-live-board="visuals"] .wlp-deck-item').count();
check("all slides built", items === t1.length && (await page.locator(".wlp-deck-item.is-pending").count()) === 0, String(items));
await scrollTo('[data-deck-live-board="visuals"]');
await shot("07-slides");

// 6. Tap a slide -> edit just that one
const tracIdx = await page.$$eval('[data-deck-live-board="visuals"] .wlp-deck-item-note', (els) => els.findIndex((e) => /Line chart/.test(e.textContent)));
await page.click(`[data-deck-select="${tracIdx}"]`);
await page.waitForTimeout(300);
check("selected slide scope chip", /Slide \d/.test(await page.locator(".wlp-deck-scope").innerText()));
check("placeholder targets the slide", /slide \d+\?/i.test(await page.getAttribute("#wlp-deck-input", "placeholder")));
await page.evaluate((i) => { const el = document.querySelectorAll('[data-deck-live-board="visuals"] .wlp-deck-item')[i]; el?.scrollIntoView({ block: "center" }); }, tracIdx);
await shot("08-selected");
await say("Make it a bar chart");
const note = await page.locator('[data-deck-live-board="visuals"] .wlp-deck-item-note').nth(tracIdx).innerText();
check("selected slide edited by voice", /Bar chart/.test(note), note);
await say("Our numbers were 150, 420, 760, 1200");
check("real numbers remove sample tag", (await page.locator('[data-deck-live-board="visuals"] .wlp-deck-item').nth(tracIdx).locator(".wlp-sample").count()) === 0);
await shot("09-edited-slide");
await page.click("[data-deck-unselect]");
await say("Different visual for slide 4");
await say("back to the plan");
check("back to an earlier pass", await page.locator('[data-deck-live-board="structure"]').count() === 1);
await say("Looks good");
await say("Looks good");
await page.waitForSelector(".wlp-deck-looks");
await scrollTo(".wlp-deck-looks");
await shot("10-looks");

// 7. Pick a look, barge in with the mic while it restyles
await page.click('.wlp-deck-look >> nth=0');
await page.waitForTimeout(150);
await tap("[data-deck-mic]");
await page.waitForTimeout(150);
check("talking interrupts the bot", /Stopped so you can talk/.test(await page.locator(".wlp-deck-note").last().innerText()));
await page.keyboard.press("Escape");
await idle();
check("style board exists after interrupt", await page.locator('[data-deck-live-board="style"]').count() === 1);
await say("Moody photos, and animate it");
await say("Accent green");
await say("Different layout for slide 2");
const [chooser] = await Promise.all([page.waitForEvent("filechooser"), (async () => { await idle(); await page.fill("#wlp-deck-input", "Use my own photo on slide 1"); await page.click("#wlp-deck-send"); })()]);
await chooser.setFiles("/workspace/willpowerlab/research/img/canva-og.jpg");
await idle();
check("upload lands on the slide", await page.locator('[data-deck-live-board="style"] .wlp-ph.is-upload').count() >= 1);
await scrollTo('[data-deck-live-board="style"]');
await shot("11-style");
await say("Match this https://www.canva.com/design/DAF1234/view");
await scrollTo('[data-deck-live-board="style"]');
await shot("12-canva");
await say("undo");
await say("Done");
await page.waitForSelector(".wlp-deck-viewer", { timeout: 8000 });
await page.waitForTimeout(900);
await shot("13-viewer");
await page.fill("#wlp-deck-input", "next");
await page.click("#wlp-deck-send");
await page.waitForTimeout(700);
check("viewer voice nav", /2 \//.test(await page.locator(".wlp-deck-viewer-top").innerText()));
for (let i = 0; i < 4; i += 1) { await page.click("[data-deck-viewer-next]"); await page.waitForTimeout(250); }
await page.waitForTimeout(1500);
await shot("14-viewer-slide6");
await page.click("[data-deck-viewer-close]");
await page.waitForTimeout(500);
await shot("15-final");
await page.click(".wlp-deck-final-links [data-deck-practice]");
await page.waitForTimeout(800);
check("practice hands off (deck overlay closed)", (await page.locator(".wlp-deck-overlay").count()) === 0);
await shot("16-practice");

// 8. Direct route + "you decide"
const p2 = await ctx.newPage();
listen(p2);
await p2.goto(`${base}?deckgen=1&topic=Q3%20results%20for%20the%20team&minutes=5`);
await idle(p2);
check("?deckgen=1 opens builder", await p2.locator(".wlp-deck-overlay").count() === 1);
await say("you decide", p2);
check("'you decide' goes straight to plan", await p2.locator('[data-deck-live-board="structure"]').count() === 1);
await say("help", p2);
check("help lists tappable phrases", (await p2.locator(".wlp-deck-row:last-child .wlp-say").count()) >= 4);
await p2.locator(".wlp-deck-row:last-child .wlp-say").first().click();
check("tappable phrase fills, never sends", (await p2.inputValue("#wlp-deck-input")).length > 3);
await p2.close();

// 9. Desktop
const dctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const d = await dctx.newPage();
listen(d);
await d.goto(`${base}?deckgen=1`);
await idle(d);
await say("Investors. We're raising a €1.5M seed round, 1,200 people on the waitlist", d);
await say("you decide", d);
await scrollTo('[data-deck-live-board="structure"]', d);
await d.screenshot({ path: `${out}/d1-plan.png` });
await say("looks good", d);
await scrollTo('[data-deck-live-board="visuals"]', d);
await d.screenshot({ path: `${out}/d2-slides.png` });
await say("looks good", d);
await scrollTo(".wlp-deck-looks", d);
await d.screenshot({ path: `${out}/d3-looks.png` });
await say("the second one", d);
check("voice look pick by ordinal", /Boardroom/.test(await d.locator(".wlp-deck-caption").last().innerText()));
await say("natural photos", d);
check("photos added", (await d.locator('[data-deck-live-board="style"] .wlp-ph').count()) > 0);
await say("restore v3", d);
check("restore an earlier version", (await d.locator('[data-deck-live-board="style"] .wlp-ph').count()) === 0 && /Restored v3/.test(await lastBot(d)), await lastBot(d));
await say("undo", d);
check("undo a restore", (await d.locator('[data-deck-live-board="style"] .wlp-ph').count()) > 0);
await scrollTo('[data-deck-live-board="style"]', d);
await d.screenshot({ path: `${out}/d4-style.png` });
await say("done", d);
await d.waitForSelector(".wlp-deck-viewer");
await d.waitForTimeout(800);
const n = await d.locator(".wlp-deck-thumbs button").count();
for (let i = 0; i < n; i += 1) {
  await d.locator(".wlp-deck-viewer-slide .wlp-dslide").screenshot({ path: `${out}/slide-${String(i + 1).padStart(2, "0")}.png` });
  if (i < n - 1) { await d.click("[data-deck-viewer-next]"); await d.waitForTimeout(450); }
}
await d.screenshot({ path: `${out}/d5-viewer.png` });
// Theme gallery: same deck, every look
for (const look of ["keynote", "bold", "friendly", "clean", "boardroom"]) {
  await d.click("[data-deck-viewer-close]");
  await say(`${look === "keynote" ? "Steve Jobs keynote" : look === "bold" ? "bold startup" : look === "friendly" ? "friendly like Airbnb" : look === "clean" ? "clean and simple" : "calm boardroom"}`, d);
  await say("show me the deck", d);
  await d.waitForSelector(".wlp-deck-viewer");
  for (const i of [0, 2, 5]) { await d.click(`[data-deck-viewer-go="${i}"]`).catch(() => {}); await d.waitForTimeout(450); await d.locator(".wlp-deck-viewer-slide .wlp-dslide").screenshot({ path: `${out}/theme-${look}-${i + 1}.png` }); }
}
check("no console errors", errors.length === 0, errors.slice(0, 5).join(" || "));
console.log(checks.join("\n"));
console.log(`${checks.filter((c) => c.startsWith("PASS")).length}/${checks.length} passed; errors: ${errors.length}`);
await browser.close();
