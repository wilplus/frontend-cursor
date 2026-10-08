/* -------------------------------------------------------------------------- */
/*  THE SHARED SCREENSHOT HARNESS (build plan X7). One script, every area.     */
/*                                                                            */
/*  Draws each screen of e2e/screenshots/manifest.mjs in a real Chromium at    */
/*  390x844 (phone) and 1280x800 (desktop), writes the PNGs under OUT_DIR,     */
/*  and for every speaker or coach screen scans the rendered text for a        */
/*  number that is not a count or a position (AC-9; visibleNumbers.mjs).       */
/*  Where an entry names a reference image of the locked prototype's frame,   */
/*  a side-by-side image (app | prototype) is written next to the shot. An     */
/*  index.html in OUT_DIR lists everything for a look.                         */
/*                                                                            */
/*    BASE_URL=http://localhost:3111 OUT_DIR=e2e/artifacts/screenshots \       */
/*      node e2e/screenshots/capture.mjs [--area walk,consent] [--only praise] */
/*                                                                            */
/*  The server behind BASE_URL is `next dev` with the e2e placeholders and the */
/*  fixture backend (scripts/screenshots.sh starts both; the CI e2e job does  */
/*  the same). Exits non-zero on a page error, a missing key element, or a     */
/*  forbidden number. Replaces the per-area screenshot loops that lived in     */
/*  e2e/feedback-walk.spec.mjs and e2e/coach-panel.spec.mjs.                   */
/* -------------------------------------------------------------------------- */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launchChromium } from "../_launch.mjs";
import { AREAS, SCREENS, VIEWPORTS } from "./manifest.mjs";
import { forbiddenNumbers } from "./visibleNumbers.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:3111").replace(/\/$/, "");
const OUT = resolve(process.env.OUT_DIR ?? "e2e/artifacts/screenshots");
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const onlyAreas = (opt("--area") ?? process.env.SCREENS_AREAS ?? "").split(",").filter(Boolean);
const onlyName = opt("--only");

for (const area of onlyAreas) {
  if (!AREAS.includes(area)) { console.error(`unknown area "${area}"; areas: ${AREAS.join(", ")}`); process.exit(2); }
}
const screens = SCREENS.filter((s) =>
  (onlyAreas.length === 0 || onlyAreas.includes(s.area)) && (!onlyName || s.name === onlyName));
if (screens.length === 0) { console.error("no screens selected"); process.exit(2); }

mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

const referenceFor = (entry, viewport) => {
  const ref = entry.reference;
  if (!ref) return undefined;
  return typeof ref === "string" ? ref : ref[viewport];
};

/** app | prototype, as one PNG, drawn by the browser itself (no image library). */
async function sideBySide(browser, shotPath, refPath, outPath, { width, height }) {
  const img = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f3f3f3;font:13px system-ui">
    <div style="display:flex;gap:24px;padding:16px">
      <figure style="margin:0"><figcaption style="margin-bottom:6px">app</figcaption>
        <img src="${img(shotPath)}" width="${width}" height="${height}" style="display:block;border:1px solid #ccc"></figure>
      <figure style="margin:0"><figcaption style="margin-bottom:6px">locked prototype</figcaption>
        <img src="${img(refPath)}" height="${height}" style="display:block;border:1px solid #ccc"></figure>
    </div></body>`;
  const page = await browser.newPage({ viewport: { width: width * 2 + 80, height: height + 60 } });
  await page.setContent(html);
  await page.screenshot({ path: outPath, fullPage: true });
  await page.close();
}

const browser = await launchChromium();
const gallery = [];

for (const entry of screens) {
  for (const [viewportName, defaultViewport] of Object.entries(VIEWPORTS)) {
    const viewport = entry.viewports?.[viewportName] ?? defaultViewport;
    const label = `${entry.area}/${entry.name} @${viewportName}`;
    const dir = join(OUT, entry.area);
    mkdirSync(dir, { recursive: true });
    const shot = join(dir, `${entry.name}.${viewportName}.png`);
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    try {
      if (entry.prepare) await entry.prepare(context, page);
      await page.goto(`${BASE}${entry.path}`, { waitUntil: "load", timeout: 120_000 });
      if (entry.act) await entry.act(page);
      // The first match may be a hidden twin (a caption chosen by media query), so wait on a VISIBLE one.
      const found = await page.locator(entry.waitFor).filter({ visible: true }).first()
        .waitFor({ state: "visible", timeout: 60_000 }).then(() => true, () => false);
      check(`${label}: draws its key element`, found, entry.waitFor);
      await page.waitForTimeout(entry.settleMs ?? 300);
      await page.screenshot({ path: shot });
      const row = { label, shot, side: null, numbers: [] };
      if (entry.audience === "speaker" || entry.audience === "coach") {
        const text = await page.evaluate(() => document.body.innerText);
        const bad = forbiddenNumbers(text, entry.allow ?? []);
        row.numbers = bad;
        check(`${label}: no number other than a count or a position (AC-9)`, bad.length === 0,
          bad.map((b) => `"${b.match}" in "${b.context}"`).join(" | "));
      }
      const ref = referenceFor(entry, viewportName);
      if (ref) {
        const refPath = resolve(ref);
        if (existsSync(refPath)) {
          row.side = join(dir, `${entry.name}.${viewportName}.vs-prototype.png`);
          await sideBySide(browser, shot, refPath, row.side, viewport);
          console.log(`  side  ${label}: ${row.side}`);
        } else {
          console.log(`  note  ${label}: reference image not found at ${ref} (no side-by-side written)`);
        }
      }
      check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
      gallery.push(row);
    } catch (e) {
      check(`${label}: captured`, false, String(e));
    } finally {
      await context.close();
    }
  }
}
await browser.close();

/* -------------------------------- index.html -------------------------------- */
const rel = (p) => p.slice(OUT.length + 1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
writeFileSync(join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>screens</title>
<body style="font:14px system-ui;margin:24px;background:#fafafa">
<p>${esc(BASE)} · ${new Date().toISOString()} · ${failures ? `${failures} check(s) FAILED` : "all checks passed"}</p>
${gallery.map((g) => `<section style="margin:0 0 32px">
  <h3 style="margin:0 0 8px">${esc(g.label)}${g.numbers.length ? ' <span style="color:#b00">AC-9</span>' : ""}</h3>
  <img src="${esc(rel(g.side ?? g.shot))}" style="max-width:100%;border:1px solid #ddd">
  ${g.numbers.map((n) => `<p style="color:#b00">"${esc(n.match)}" in "${esc(n.context)}"</p>`).join("")}
</section>`).join("\n")}
</body>`);

console.log(`\n${screens.length} screen(s) × ${Object.keys(VIEWPORTS).length} viewports → ${OUT}/index.html`);
if (failures) { console.log(`${failures} check(s) failed`); process.exit(1); }
console.log("screens ok");
