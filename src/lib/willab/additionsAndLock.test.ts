import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { mapAdditions, mapParts } from "@/services/api/idealText";
import { IDEAL_EDIT_COPY } from "@/components/willab/idealEditCopy";
import {
  partsForDocument,
  reconcileParts,
  updatePart,
  type Part,
} from "./documentParts";

/* -------------------------------------------------------------------------- */
/*  MATERIAL RECOVERY + LOCKING — the two wire shapes and the copy fence.       */
/*                                                                            */
/*  An addition is words the speaker SAID, on a slide their script has no       */
/*  block for. It carries NO SPAN, which is the whole point: it used to be      */
/*  forced into the tracked-change shape as a zero-width `insert` and was       */
/*  dropped by every layer that touched it.                                    */
/*                                                                            */
/*  A lock changes WHICH KIND of suggestion may fire on a section. The FE       */
/*  never sets it optimistically — a lock drawn that the server did not grant   */
/*  is the one state worth never rendering.                                    */
/* -------------------------------------------------------------------------- */

const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const raw = (over: Record<string, unknown> = {}) => ({
  id: "block:30",
  block_key: 30,
  take_session_id: "sess-2",
  take_index: 2,
  slide_index: 1,
  label: "Slide 2",
  text: "the words I said on the new slide",
  ...over,
});

describe("mapAdditions", () => {
  it("maps a whole offer", () => {
    expect(mapAdditions([raw()])).toEqual([
      {
        id: "block:30",
        blockKey: 30,
        takeSessionId: "sess-2",
        takeIndex: 2,
        slideIndex: 1,
        label: "Slide 2",
        text: "the words I said on the new slide",
      },
    ]);
  });

  it("absent or unusable is an empty list, not null", () => {
    // There is no "no new material" state worth rendering — the section
    // simply does not draw.
    for (const bad of [undefined, null, "nope", 7, {}]) {
      expect(mapAdditions(bad)).toEqual([]);
    }
  });

  it("drops an offer whose decision could never be reported", () => {
    // The decision routes on block_key + take_session_id. Without both, "Add
    // to script" is a button that can never succeed — the same dead-control
    // rule the tracked-change mapper follows.
    expect(mapAdditions([raw({ block_key: undefined })])).toEqual([]);
    expect(mapAdditions([raw({ take_session_id: "" })])).toEqual([]);
    expect(mapAdditions([raw({ text: "   " })])).toEqual([]);
  });

  it("carries an id even when the BE omits one", () => {
    expect(mapAdditions([raw({ id: undefined })])[0].id).toBe("block:30");
  });

  it("a missing slide or take degrades the badge, not the offer", () => {
    const [a] = mapAdditions([
      raw({ take_index: null, slide_index: undefined, label: "" }),
    ]);
    expect(a.takeIndex).toBeNull();
    expect(a.slideIndex).toBeNull();
    expect(a.label).toBeNull();
    expect(a.text).toBeTruthy();
  });

  it("carries NO span, quote or kind", () => {
    // The shape that broke it before. An addition is not a span-anchored edit.
    const [a] = mapAdditions([raw()]);
    for (const absent of ["span", "start", "end", "quote", "kind"]) {
      expect(a).not.toHaveProperty(absent);
    }
  });
});

describe("the lock rides the parts wire", () => {
  it("reads the BE's boolean", () => {
    const out = mapParts([
      { id: "a", ord: 0, text: "open one", locked: false },
      { id: "b", ord: 1, text: "shut one", locked: true },
    ]);
    expect(out?.map((p) => p.locked)).toEqual([false, true]);
  });

  it("anything but true is unlocked", () => {
    // A lock is server-owned. A truthy-ish value is not a grant.
    for (const v of [undefined, null, "true", 1, {}]) {
      expect(mapParts([{ id: "a", ord: 0, text: "x", locked: v }])?.[0].locked)
        .toBe(false);
    }
  });
});

describe("the lock belongs to the PART, not to the words", () => {
  const locked = (id: string, text: string): Part => ({
    id,
    text,
    locked: true,
  });

  it("survives a reword", () => {
    // The reason identity is stored rather than derived: locked text is
    // exactly the text that keeps being restyled.
    const out = updatePart([locked("a", "Original.")], 0, "Reworded.");
    expect(out[0]).toEqual({ id: "a", text: "Reworded.", locked: true });
  });

  it("survives a rewrite of a NEIGHBOURING paragraph", () => {
    const prev = [locked("a", "Kept."), { id: "b", text: "Gone." }];
    const next = reconcileParts("Kept.\n\nSomething new.", prev);
    expect(next[0]).toMatchObject({ id: "a", locked: true });
    expect(next[1].locked).toBeUndefined();
  });

  it("survives a reorder", () => {
    const prev = [locked("a", "A."), { id: "b", text: "B." }];
    const next = reconcileParts("B.\n\nA.", prev);
    expect(next[1]).toMatchObject({ id: "a", locked: true });
  });

  it("comes through the served list intact", () => {
    const served = [locked("a", "One."), { id: "b", text: "Two." }];
    expect(partsForDocument("One.\n\nTwo.", served)[0].locked).toBe(true);
  });

  it("a NEW part is never born locked", () => {
    // Nothing may draw a lock the server did not grant.
    expect(reconcileParts("Brand new words.")[0].locked).toBeUndefined();
  });
});

describe("the founder copy is exactly what was signed off", () => {
  it("carries the six approved strings, verbatim", () => {
    // LIVE LOOP: user-facing copy needs founder sign-off (2026-08-07).
    // Changing one has to be a deliberate act with this test in the diff.
    expect(IDEAL_EDIT_COPY.additionsHeading).toBe("New material detected");
    expect(IDEAL_EDIT_COPY.additionAccept).toBe("Add to script");
    expect(IDEAL_EDIT_COPY.additionDecline).toBe("Not now");
    expect(IDEAL_EDIT_COPY.lockPart).toBe("Lock section");
    expect(IDEAL_EDIT_COPY.unlockPart).toBe("Unlock section");
    expect(IDEAL_EDIT_COPY.lockBlocked).toBe(
      "Please approve or disregard pending suggestions before locking."
    );
  });

  it("has NO string for a stale document", () => {
    // The existing lane answers that by silently refetching — the text
    // visibly refreshing IS the message. A seventh line would be
    // un-signed-off copy saying what the screen already says.
    expect(IDEAL_EDIT_COPY).not.toHaveProperty("lockStale");
  });

  it("no new user-facing string is inlined in the components", () => {
    // The whole point of the one-file rule: a string cannot quietly ship from
    // a JSX edit. Both new surfaces must render from IDEAL_EDIT_COPY.
    for (const rel of [
      join("components", "willab", "AdditionsPanel.tsx"),
      join("components", "willab", "DocumentArranger.tsx"),
    ]) {
      const src = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(src, rel).toMatch(/idealEditCopy/);
      // The approved strings must appear as KEY references, never as literals.
      for (const literal of [
        "New material detected",
        "Add to script",
        "Lock section",
      ]) {
        expect(src, `${rel} inlines "${literal}"`).not.toContain(literal);
      }
    }
  });
});
