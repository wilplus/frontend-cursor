/* -------------------------------------------------------------------------- */
/*  THE PRESS MUST LAND BEFORE THE NETWORK DOES                                */
/*                                                                            */
/*  Founder 2026-09-15: "each button, like emphasise, lock, discard … works on */
/*  the touch instantly without the loading time."                            */
/*                                                                            */
/*  The diagnosis was not latency. Every decision button in the chunk sheet    */
/*  styles its feedback with `hover:`, and a touch screen has no hover — so a  */
/*  tap changed NOTHING on screen until the request came back and the sheet    */
/*  moved. The gap read as loading, and a button that looks dead gets tapped   */
/*  twice.                                                                    */
/*                                                                            */
/*  These assert the CSS, not a component, because that is the whole point: a  */
/*  pressed state held in React state cannot beat the finger — it waits for a  */
/*  render and for whatever the handler is awaiting. `:active` paints on the   */
/*  same frame as the touch.                                                  */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const CSS = readFileSync("src/app/globals.css", "utf8");
const MODAL = readFileSync(
  "src/components/willab/DeckChunkModal.tsx",
  "utf8",
);

describe("touch feedback", () => {
  it("gives every button a pressed state where there is no hover", () => {
    expect(CSS).toMatch(/@media \(hover: none\)/);
    expect(CSS).toMatch(/button:not\(:disabled\)[^\n]*:active/);
    expect(CSS).toMatch(/opacity: 0\.72/);
  });

  it("never dims a button the user cannot press", () => {
    // A disabled button flashing under a finger claims it did something.
    expect(CSS).toMatch(/button:not\(:disabled\)/);
    expect(CSS).toMatch(/\[role="button"\]:not\(\[aria-disabled="true"\]\)/);
  });

  it("drops the legacy double-tap delay and the grey flash", () => {
    expect(CSS).toMatch(/touch-action: manipulation/);
    expect(CSS).toMatch(/-webkit-tap-highlight-color: transparent/);
  });

  it("asks before moving anything", () => {
    // The scale is what reads as "pressed" rather than merely "dimmed", so it
    // is motion and it sits behind the reduced-motion query. The opacity half
    // is unconditional, so the feedback survives that preference.
    const scaleBlock = CSS.slice(CSS.indexOf("prefers-reduced-motion"));
    expect(scaleBlock).toMatch(/transform: scale\(0\.97\)/);
    const plainBlock = CSS.slice(
      CSS.indexOf("@media (hover: none) {"),
      CSS.indexOf("prefers-reduced-motion"),
    );
    expect(plainBlock).toMatch(/opacity: 0\.72/);
    expect(plainBlock).not.toMatch(/transform:/);
  });

  it("leaves the sheet's drag handle alone", () => {
    // It is a grab handle, not a tap target: scaling it mid-drag would fight
    // the gesture it exists to serve.
    expect(CSS).toMatch(/:not\(\[data-sheet-grabber\]\)/);
    expect(MODAL).toMatch(/data-sheet-grabber/);
  });
});
