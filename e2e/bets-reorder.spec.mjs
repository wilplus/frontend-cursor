/* -------------------------------------------------------------------------- */
/*  Press-hold-move reorder, driven in a real browser.                         */
/*                                                                            */
/*  Run against `next dev` on the port in BETS_URL (default 3111):             */
/*    node e2e/bets-reorder.spec.mjs                                          */
/*                                                                            */
/*  Everything here is a question jsdom cannot answer: whether a touch drags   */
/*  the row or pans the page, whether a hold on the textarea steals the caret, */
/*  whether the pointer is still tracked once it leaves the row it started on. */
/* -------------------------------------------------------------------------- */

import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;

const URL = process.env.BETS_URL ?? "http://localhost:3111/dev/life-bets";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};

const order = (page) =>
  page.locator('[data-testid="order"]').innerText();
const rowBox = async (page, i) => {
  const b = await page.locator("ol > li").nth(i).boundingBox();
  return b;
};

/* ------------------------------- mouse: grip ------------------------------- */
{
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("ol > li");

  check("starts in rank order", (await order(page)) === "1:life 2:company 3:dream");

  // Grab row 1 by its grip and drag it below row 2's centre.
  const grip = page.locator("[data-drag-handle]").first();
  const g = await grip.boundingBox();
  const r2 = await rowBox(page, 1);
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, r2.y + r2.height / 2 + 8, { steps: 12 });

  // Mid-drag: the row must have lifted and the one below must have moved up.
  const mid = await page.evaluate(() => {
    const li = [...document.querySelectorAll("ol > li")];
    return li.map((el) => getComputedStyle(el).transform);
  });
  check(
    "dragged row is transformed mid-drag",
    mid[0] !== "none" && mid[0].includes("matrix"),
    mid[0]
  );
  check("displaced row moves out of the way", mid[1] !== "none" && mid[1] !== mid[0]);

  await page.mouse.up();
  await page.waitForTimeout(200);
  check(
    "grip drag commits the new order",
    (await order(page)) === "1:company 2:life 3:dream",
    await order(page)
  );

  // Rank is re-derived from position, and the label follows the row.
  const firstLabel = await page.locator("ol > li p").first().innerText();
  check("row 1 relabels to its new position", firstLabel === "1. Career", firstLabel);

  // Drag back up, this time past the top.
  const grip2 = page.locator("ol > li").nth(1).locator("[data-drag-handle]");
  const g2 = await grip2.boundingBox();
  const r1 = await rowBox(page, 0);
  await page.mouse.move(g2.x + g2.width / 2, g2.y + g2.height / 2);
  await page.mouse.down();
  await page.mouse.move(g2.x + g2.width / 2, r1.y + 4, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check(
    "dragging back up restores the order",
    (await order(page)) === "1:life 2:company 3:dream",
    await order(page)
  );

  // Escape must abandon a drag, not commit it.
  const g3 = await page.locator("[data-drag-handle]").first().boundingBox();
  const r2b = await rowBox(page, 1);
  await page.mouse.move(g3.x + g3.width / 2, g3.y + g3.height / 2);
  await page.mouse.down();
  await page.mouse.move(g3.x + g3.width / 2, r2b.y + r2b.height / 2 + 8, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(200);
  check(
    "Escape abandons the drag",
    (await order(page)) === "1:life 2:company 3:dream",
    await order(page)
  );

  /* --------------------------- mouse: hold the card ---------------------- */
  const card = await rowBox(page, 0);
  const holdX = card.x + 60; // the label area, clear of the textarea and grip
  const holdY = card.y + 14;
  await page.mouse.move(holdX, holdY);
  await page.mouse.down();
  await page.waitForTimeout(320); // past the hold threshold
  const r2c = await rowBox(page, 1);
  await page.mouse.move(holdX, r2c.y + r2c.height / 2 + 8, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check(
    "holding the card body drags it too",
    (await order(page)) === "1:company 2:life 3:dream",
    await order(page)
  );

  /* ------------------- a quick press must NOT reorder --------------------- */
  const before = await order(page);
  const card2 = await rowBox(page, 0);
  await page.mouse.move(card2.x + 60, card2.y + 14);
  await page.mouse.down();
  await page.mouse.move(card2.x + 60, card2.y + 220, { steps: 10 }); // no hold
  await page.mouse.up();
  await page.waitForTimeout(200);
  check("a press-and-drag without the hold changes nothing", (await order(page)) === before);

  /* ------------------------ the textarea still works ---------------------- */
  const ta = page.locator("ol > li textarea").first();
  await ta.click();
  await ta.type("what this one covers");
  await page.waitForTimeout(150);
  check(
    "typing into the row's textarea still works",
    (await ta.inputValue()) === "what this one covers",
    await ta.inputValue()
  );
  check("typing did not reorder anything", (await order(page)) === before);

  // A hold ON the textarea is text selection, not a drag.
  const tb = await ta.boundingBox();
  await page.mouse.move(tb.x + 20, tb.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(320);
  const r2d = await rowBox(page, 1);
  await page.mouse.move(tb.x + 20, r2d.y + r2d.height / 2 + 8, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check("holding the textarea does not drag the row", (await order(page)) === before);

  /* ------------------------------- keyboard ------------------------------- */
  const kbBefore = await order(page);
  await page.locator("[data-drag-handle]").first().focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  check(
    "ArrowDown on the grip moves the row",
    (await order(page)) !== kbBefore,
    await order(page)
  );
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  check("ArrowUp puts it back", (await order(page)) === kbBefore, await order(page));

  /* --------------------------- no scrollbar gutter ------------------------ */
  const gutters = await page.evaluate(() =>
    [...document.querySelectorAll("ol > li textarea")].map((el) => ({
      v: el.offsetWidth - el.clientWidth - 2,
      h: el.offsetHeight - el.clientHeight - 2,
    }))
  );
  check(
    "no scrollbar gutter in any bet textarea",
    gutters.every((g) => g.v === 0 && g.h === 0),
    JSON.stringify(gutters)
  );

  await browser.close();
}

/* -------------------------------- touch ----------------------------------- */
{
  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("ol > li");
  const cdp = await context.newCDPSession(page);

  const touch = async (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd" ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1 }],
    });

  // Grip: contact, then move — no hold needed, because touch-action:none on the
  // grip means the browser never claims that touch for a pan.
  const g = await page.locator("[data-drag-handle]").first().boundingBox();
  const r2 = await rowBox(page, 1);
  const gx = g.x + g.width / 2;
  await touch("touchStart", gx, g.y + g.height / 2);
  for (let s = 1; s <= 10; s++) {
    const y =
      g.y + g.height / 2 + ((r2.y + r2.height / 2 + 8 - (g.y + g.height / 2)) * s) / 10;
    await touch("touchMove", gx, y);
  }
  await touch("touchEnd", gx, 0);
  await page.waitForTimeout(250);
  check(
    "touch: grip drag reorders",
    (await order(page)) === "1:company 2:life 3:dream",
    await order(page)
  );

  // Hold the card body, then move.
  const card = await rowBox(page, 0);
  const hx = card.x + 60;
  const hy = card.y + 14;
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await touch("touchStart", hx, hy);
  await page.waitForTimeout(340);
  const r2b = await rowBox(page, 1);
  for (let s = 1; s <= 10; s++) {
    await touch("touchMove", hx, hy + ((r2b.y + r2b.height / 2 + 8 - hy) * s) / 10);
  }
  await touch("touchEnd", hx, 0);
  await page.waitForTimeout(250);
  check(
    "touch: holding the card body reorders",
    (await order(page)) === "1:life 2:company 3:dream",
    await order(page)
  );
  check(
    "touch: the page did not scroll during the drag",
    (await page.evaluate(() => window.scrollY)) === scrollBefore
  );

  // A touch that moves straight away is a scroll, not a drag.
  const before = await order(page);
  const card2 = await rowBox(page, 0);
  await touch("touchStart", card2.x + 60, card2.y + 14);
  for (let s = 1; s <= 8; s++) {
    await touch("touchMove", card2.x + 60, card2.y + 14 + s * 12);
  }
  await touch("touchEnd", card2.x + 60, 0);
  await page.waitForTimeout(250);
  check("touch: a swipe without the hold changes nothing", (await order(page)) === before);

  await page.screenshot({ path: process.env.BETS_SHOT ?? "/tmp/bets-mobile.png" });
  await browser.close();
}

console.log(failures === 0 ? "\nPASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
