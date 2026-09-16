// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  /coach/errors rendered — the coach's door into the speaking error library. */
/*                                                                            */
/*  The source fences in speakingErrors.test.ts prove the write path can only  */
/*  ever say `observed`. This file renders the REAL component and proves the   */
/*  thing a grep cannot: that an author can TELL THE TWO GROUPS APART on       */
/*  sight, and that the one refusal which protects live routing arrives as a   */
/*  sentence they can act on.                                                  */
/*                                                                            */
/*  Why that matters more than it looks: saving over a `detected` entry would  */
/*  demote it to `observed` and silently stop it routing exercises — no        */
/*  exception, no log, nothing to notice. The database and the service both    */
/*  refuse it. This screen's job is to make the author never try.              */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listSpeakingErrors = vi.fn();
const saveSpeakingError = vi.fn();
const isCoach = { value: true };

vi.mock("@/components/willab/useUserProfile", () => ({
  useUserProfile: () => ({ isCoach: isCoach.value, loading: false, profile: null }),
}));
vi.mock("@/components/willab/LoadingState", () => ({ default: () => null }));
vi.mock("@/services/api/speakingErrors", async (load) => {
  const actual =
    await load<typeof import("@/services/api/speakingErrors")>();
  return { ...actual, listSpeakingErrors, saveSpeakingError };
});

const { default: SpeakingErrorLibraryClient } = await import("./page.client");

const RUSHING = {
  errorId: "rushing",
  label: "Rushing",
  definition:
    "The passage leaves too little silence between its words for a listener to keep up.",
  asks: "Did this passage give the listener room to follow it?",
  status: "detected" as const,
  detectorRef: "insufficient_pauses,irregular_rushed_pacing",
  observedBy: null,
  active: true,
};

const MUMBLE = {
  errorId: "trailing_mumble",
  label: "Trailing mumble",
  definition: "The last words lose volume while the pace stays even.",
  asks: "Did the speaker carry the end of the sentence?",
  status: "observed" as const,
  detectorRef: null,
  observedBy: "coach-1",
  active: true,
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  isCoach.value = true;
  listSpeakingErrors.mockReset().mockResolvedValue({
    ok: true,
    data: [RUSHING, MUMBLE],
  });
  saveSpeakingError.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render() {
  await act(async () => {
    root.render(<SpeakingErrorLibraryClient />);
  });
}

function button(label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!found) {
    throw new Error(
      `no button "${label}" — have: ${[...host.querySelectorAll("button")]
        .map((b) => JSON.stringify(b.textContent?.trim()))
        .join(", ")}`,
    );
  }
  return found as HTMLButtonElement;
}

async function click(label: string) {
  await act(async () => {
    button(label).click();
  });
}

async function type(placeholder: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[placeholder="${placeholder}"]`,
  );
  if (!field) throw new Error(`no field with placeholder "${placeholder}"`);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The rendered section whose heading starts with `heading`. Assertions are
 *  scoped to a section on purpose: asserting on the whole document proves only
 *  that both entries appear SOMEWHERE, which stays true if the two groups are
 *  swapped — the one mistake that would have an author save over a detected
 *  entry and silently stop it routing. */
function section(heading: string): HTMLElement {
  const found = [...host.querySelectorAll("section")].find((s) =>
    s.querySelector("h2")?.textContent?.startsWith(heading),
  );
  if (!found) throw new Error(`no section headed "${heading}"`);
  return found as HTMLElement;
}

describe("the two groups are distinguishable on sight", () => {
  it("puts each entry under the heading that matches its status", async () => {
    await render();
    const routes = section("Detected in audio").textContent ?? "";
    const named = section("Named only").textContent ?? "";
    expect(routes).toContain("Rushing");
    expect(routes).not.toContain("Trailing mumble");
    expect(named).toContain("Trailing mumble");
    expect(named).not.toContain("Rushing");
  });

  it("says, for each entry, whether it actually routes anything", async () => {
    await render();
    // The detected one names the thing doing the measuring — the construct
    // fence made visible rather than merely enforced.
    expect(section("Detected in audio").textContent).toContain(
      "insufficient_pauses,irregular_rushed_pacing",
    );
    expect(section("Named only").textContent).toContain(
      "routes nothing until a detector is written",
    );
    // And the reverse: a detected entry must never carry the "routes nothing"
    // line, which is the sentence an author reads to decide it is safe to edit.
    expect(section("Detected in audio").textContent).not.toContain(
      "routes nothing until a detector is written",
    );
  });

  it("locks the detected entries and only those", async () => {
    await render();
    expect(section("Detected in audio").textContent).toContain("Detected");
    expect(section("Named only").textContent).not.toContain("Detected");
  });

  it("shows the written definition AND the one question, for both", async () => {
    // A name with no definition is the defect that retired charisma. If this
    // screen can show a name without showing what it means, it has become the
    // same unwritten vocabulary the library replaced.
    await render();
    const text = host.textContent ?? "";
    for (const entry of [RUSHING, MUMBLE]) {
      expect(text).toContain(entry.definition);
      expect(text).toContain(entry.asks);
    }
  });
});

describe("naming a pattern", () => {
  it("files it and says plainly that it routes nothing yet", async () => {
    saveSpeakingError.mockResolvedValue({ ok: true, data: MUMBLE });
    await render();
    await click("Name a pattern");
    await type("Trailing mumble", "Trailing mumble");
    await type(
      "The last words of a sentence lose volume and articulation while the pace stays even.",
      "The last words lose volume.",
    );
    await type(
      "Did the speaker carry the end of the sentence?",
      "Did the speaker carry the end?",
    );
    await click("File it");

    expect(saveSpeakingError).toHaveBeenCalledOnce();
    // The id was derived from the name, so the author never had to think
    // about a shape that silently routes nothing when it is wrong.
    expect(saveSpeakingError.mock.calls[0][0].errorId).toBe("trailing_mumble");
    expect(host.textContent).toContain("routes nothing until a detector");
  });

  it("refuses an id that would match nothing, before sending it", async () => {
    await render();
    await click("Name a pattern");
    await type("Trailing mumble", "Trailing mumble");
    await type("trailing_mumble", "Trailing Mumble");   // the id field
    await type(
      "The last words of a sentence lose volume and articulation while the pace stays even.",
      "d",
    );
    await type("Did the speaker carry the end of the sentence?", "a");
    await click("File it");

    expect(saveSpeakingError).not.toHaveBeenCalled();
    expect(host.textContent).toContain("match nothing");
  });

  it("surfaces the already-detected refusal as something to read", async () => {
    // THE refusal that protects live routing. It is not a mistake the author
    // can fix by editing the form, so it must not read like a validation slip.
    saveSpeakingError.mockResolvedValue({
      ok: false,
      status: 409,
      code: "ALREADY_DETECTED",
      message:
        "this error is already detected in code; saving it here would demote it to observed and silently stop it routing exercises",
    });
    await render();
    await click("Name a pattern");
    await type("Trailing mumble", "Rushing");
    await type(
      "The last words of a sentence lose volume and articulation while the pace stays even.",
      "d",
    );
    await type("Did the speaker carry the end of the sentence?", "a");
    await click("File it");

    expect(host.textContent).toContain("silently stop it routing exercises");
    // The draft survives the refusal — retyping it is how an author gives up.
    expect(
      host.querySelector('[placeholder="Trailing mumble"]'),
    ).not.toBeNull();
  });
});

describe("N4 — the screen does not exist for a non-coach", () => {
  it("renders nothing and does not even ask for the library", async () => {
    isCoach.value = false;
    await render();
    expect(host.textContent).toContain("Nothing here");
    expect(host.textContent).not.toContain("Rushing");
    expect(listSpeakingErrors).not.toHaveBeenCalled();
  });
});
