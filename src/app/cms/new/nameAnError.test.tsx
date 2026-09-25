// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  NAMING AN ERROR THAT IS NOT THERE (founder 2026-09-25, decision 03).       */
/*                                                                            */
/*  Two holes, one box. The error library page existed and nothing in the app  */
/*  linked to it, so most coaches had never seen the list they tag from. And   */
/*  a coach who heard something new had nowhere to put it, so it was lost at   */
/*  the one moment somebody knew it.                                           */
/*                                                                            */
/*  The load-bearing behaviour is the CONFIRMATION. A newly named pattern      */
/*  saves as `observed` — code cannot hear it, so no exercise may carry it and */
/*  nothing reaches a speaker until a detector exists. A coach who walks away  */
/*  believing they just switched something on is worse off than one who never  */
/*  had the box.                                                              */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SaveResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string; code?: string };
const { saveSpeakingError } = vi.hoisted(() => ({
  saveSpeakingError: vi.fn(
    async (): Promise<
      | { ok: true; data: unknown }
      | { ok: false; status: number; message: string; code?: string }
    > => ({ ok: true, data: {} }),
  ),
}));
vi.mock("@/services/api/speakingErrors", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/api/speakingErrors")
  >("@/services/api/speakingErrors");
  return { ...actual, saveSpeakingError };
});

import { NameAnErrorBox } from "./LaneSteps";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  saveSpeakingError.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render() {
  act(() => root.render(<NameAnErrorBox />));
}
function click(text: string) {
  const el = [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!el) throw new Error(`no button "${text}" in: ${host.textContent}`);
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
function type(label: string, value: string) {
  // LaneField wraps the control INSIDE its own <label>, so the input to write
  // to is the one within that element — not the first one on the page.
  const field = [...host.querySelectorAll("label")].find(
    (l) => l.querySelector("span")?.textContent?.trim() === label,
  );
  const input = field?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
  if (!input) throw new Error(`no field "${label}"`);
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("the link that never existed", () => {
  it("points a coach at the list they are tagging from", () => {
    render();
    const link = host.querySelector<HTMLAnchorElement>('a[href="/coach/errors"]');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain("See all known errors");
  });
});

describe("filing a pattern the library does not have", () => {
  it("tells the coach the truth: it routes nothing yet", async () => {
    render();
    click("Name what you heard");
    type("A short name", "Trailing fade");
    type("What you heard", "The last two words drop in volume.");
    type("The one question it answers", "Did the line lose power at its end?");
    await act(async () => {
      click("File it");
    });
    expect(saveSpeakingError).toHaveBeenCalledOnce();
    // The sentence is the point of the whole feature.
    expect(host.textContent).toContain(
      "can’t be attached to an exercise until the app can hear it",
    );
  });

  it("derives the id, so a coach types a name and not a shape", async () => {
    render();
    click("Name what you heard");
    type("A short name", "Trailing Fade");
    type("What you heard", "The last two words drop in volume.");
    type("The one question it answers", "Did the line lose power at its end?");
    await act(async () => {
      click("File it");
    });
    expect(saveSpeakingError).toHaveBeenCalledWith(
      expect.objectContaining({ errorId: "trailing_fade" }),
    );
  });

  it("refuses a name with no definition rather than sending it", async () => {
    render();
    click("Name what you heard");
    type("A short name", "Trailing fade");
    await act(async () => {
      click("File it");
    });
    expect(saveSpeakingError).not.toHaveBeenCalled();
    // The construct fence, surfaced as a sentence the author can act on.
    expect(host.textContent).toContain("what is measured");
  });

  it("surfaces a refusal from the server instead of claiming success", async () => {
    const refusal: SaveResult = {
      ok: false,
      status: 409,
      message: "this error is already detected in code",
      code: "ALREADY_DETECTED",
    };
    saveSpeakingError.mockResolvedValueOnce(refusal);
    render();
    click("Name what you heard");
    type("A short name", "Ending compression");
    type("What you heard", "The last words compress.");
    type("The one question it answers", "Did the ending lose power?");
    await act(async () => {
      click("File it");
    });
    expect(host.textContent).toContain("already detected in code");
    expect(host.textContent).not.toContain("Filed.");
  });
});
