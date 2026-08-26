/* -------------------------------------------------------------------------- */
/*  MarkedEditor — the contentEditable behaviours, in a REAL browser           */
/*                                                                            */
/*  The serialization has unit tests (markedEditorSerialize.test.ts). This     */
/*  covers what those cannot: caret position after an intercepted keystroke,   */
/*  IME composition, select-all-then-type, paste, and what the engine leaves   */
/*  in the DOM afterwards. jsdom does not implement `beforeinput`, so none of   */
/*  it is reachable without a real engine.                                    */
/*                                                                            */
/*  It earned its place. On the first run 4 of these 13 failed, including the  */
/*  boundary guard not firing AT ALL — React's onBeforeInput is a synthetic    */
/*  polyfill with no `inputType`, so the guard returned early on every         */
/*  keystroke and typing at the end of an accent produced "{{orange:wordX}}",  */
/*  the exact swallow the spec forbids. Unit tests could not see it.           */
/*                                                                            */
/*  RUN IT:                                                                   */
/*    1. npx next dev -p 3123                                                 */
/*    2. node e2e/marked-editor.spec.mjs                                      */
/*  Needs playwright available (project or global) and a Chromium at           */
/*  PLAYWRIGHT_BROWSERS_PATH. Exits non-zero on any failure.                   */
/* -------------------------------------------------------------------------- */

import { launchChromium } from "./_launch.mjs";

const BASE = process.env.MARKED_URL ?? "http://localhost:3123/dev/marked-editor";
const results = [];
let browser;

function check(name, actual, expected) {
  const pass = actual === expected;
  results.push({ name, pass, actual, expected });
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${name}\n      got: ${JSON.stringify(actual)}` +
      (pass ? "" : `\n      want: ${JSON.stringify(expected)}`)
  );
}

async function open(doc) {
  const page = await browser.newPage();
  await page.goto(`${BASE}?doc=${encodeURIComponent(doc)}`);
  await page.waitForSelector('[role="textbox"]');
  return page;
}

const serialized = (page) => page.locator('[data-testid="serialized"]').innerText();

/** Put the caret at `offset` inside the text node holding `needle`. */
async function caretIn(page, needle, offset) {
  await page.evaluate(
    ([needle, offset]) => {
      const root = document.querySelector('[role="textbox"]');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent === needle) {
          const r = document.createRange();
          r.setStart(node, offset < 0 ? node.textContent.length : offset);
          r.collapse(true);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          return true;
        }
      }
      throw new Error(`text node ${JSON.stringify(needle)} not found`);
    },
    [needle, offset]
  );
  await page.locator('[role="textbox"]').focus();
  // Re-apply: focus() can collapse the selection to the start in some engines.
  await page.evaluate(
    ([needle, offset]) => {
      const root = document.querySelector('[role="textbox"]');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent === needle) {
          const r = document.createRange();
          r.setStart(node, offset < 0 ? node.textContent.length : offset);
          r.collapse(true);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          return;
        }
      }
    },
    [needle, offset]
  );
}

(async () => {
  browser = await launchChromium();

  // 1 — the document renders styled, with no marker syntax on screen.
  {
    const page = await open("say it **louder** and {{orange:clearer}}");
    const visible = await page.locator('[role="textbox"]').innerText();
    check("1 no marker syntax visible while editing", visible, "say it louder and clearer");
    await page.close();
  }

  // 2 — untouched round-trip (focus + blur, no keystrokes).
  {
    const doc = "say it **louder** and {{orange:clearer}}";
    const page = await open(doc);
    await page.locator('[role="textbox"]').focus();
    await page.locator('[role="textbox"]').blur();
    check("2 untouched document round-trips byte-for-byte", await serialized(page), doc);
    await page.close();
  }

  // 3 — THE BOUNDARY GUARD, end of a styled span.
  {
    const page = await open("say **bold**");
    await caretIn(page, "bold", -1);
    await page.keyboard.type("X");
    check("3 typing at a span END extends the unstyled side", await serialized(page), "say **bold**X");
    await page.close();
  }

  // 4 — caret must land AFTER the inserted character, so the next keystroke
  //     appends rather than reversing the word.
  {
    const page = await open("say **bold**");
    await caretIn(page, "bold", -1);
    await page.keyboard.type("XY");
    check("4 caret survives the guard (XY, not YX)", await serialized(page), "say **bold**XY");
    await page.close();
  }

  // 5 — the boundary guard, start of a styled span.
  {
    const page = await open("**bold** tail");
    await caretIn(page, "bold", 0);
    await page.keyboard.type("X");
    check("5 typing at a span START extends the unstyled side", await serialized(page), "X**bold** tail");
    await page.close();
  }

  // 6 — INTERIOR typing legitimately grows the span.
  {
    const page = await open("say **bold**");
    await caretIn(page, "bold", 2);
    await page.keyboard.type("X");
    check("6 typing INSIDE a span grows it", await serialized(page), "say **boXld**");
    await page.close();
  }

  // 7 — select all, then type. The whole document is replaced.
  {
    const page = await open("say it **louder**");
    await page.locator('[role="textbox"]').focus();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.type("fresh");
    check("7 select-all then type replaces the document", await serialized(page), "fresh");
    await page.close();
  }

  // 8 — deleting a styled span takes its markers with it.
  {
    const page = await open("keep **drop** keep");
    await caretIn(page, "drop", -1);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
    check("8 deleting a span deletes its markers", await serialized(page), "keep  keep");
    await page.close();
  }

  // 9 — a moment keeps its ids on the text that survives an edit.
  {
    const page = await open("a [[moment:s1|k1]]the phrase[[/moment]] z");
    await caretIn(page, "the phrase", 3);
    await page.keyboard.type("X");
    check(
      "9 a moment keeps its ids through an edit",
      await serialized(page),
      "a [[moment:s1|k1]]theX phrase[[/moment]] z"
    );
    await page.close();
  }

  // 10 — IME composition (the path onBeforeInput deliberately does NOT touch).
  {
    const page = await open("say **bold**");
    await caretIn(page, "bold", -1);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", {
      text: "みん",
      selectionStart: 2,
      selectionEnd: 2,
    });
    await cdp.send("Input.insertText", { text: "みん" });
    const out = await serialized(page);
    check("10 IME composition does not crash or lose the document", out.includes("bold"), true);
    console.log(`      (composition landed as: ${JSON.stringify(out)})`);
    await page.close();
  }

  // 11 — Enter makes a paragraph break, not a lost document.
  {
    const page = await open("one");
    await caretIn(page, "one", -1);
    await page.keyboard.press("Enter");
    await page.keyboard.type("two");
    const out = await serialized(page);
    check("11 Enter keeps both halves of the document", /one[\s\S]*two/.test(out), true);
    console.log(`      (Enter produced: ${JSON.stringify(out)})`);
    await page.close();
  }

  // 12 — pasting plain text never injects markup.
  {
    const page = await open("start ");
    await caretIn(page, "start ", -1);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData("text/plain", "<b>pasted</b> & raw");
      document
        .querySelector('[role="textbox"]')
        .dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    const out = await serialized(page);
    check("12 paste lands as text, never markup", out, "start <b>pasted</b> & raw");
    await page.close();
  }

  // 13 — the toolbar wraps a selection in the accent.
  {
    const page = await open("make it strong");
    await page.evaluate(() => {
      const root = document.querySelector('[role="textbox"]');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const node = walker.nextNode();
      const r = document.createRange();
      r.setStart(node, 8);
      r.setEnd(node, 14);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    });
    await page.locator('button[aria-label="Orange accent"]').click();
    check("13 the toolbar wraps the selection", await serialized(page), "make it {{orange:strong}}");
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILURES:\n" + failed.map((f) => `  - ${f.name}`).join("\n"));
    process.exit(1);
  }
})().catch(async (e) => {
  console.error("HARNESS ERROR:", e.message);
  if (browser) await browser.close();
  process.exit(2);
});
