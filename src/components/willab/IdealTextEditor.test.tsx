// @vitest-environment jsdom
/*
STORY    As a speaker, I want to edit my whole Ideal Text from its menu, so
         that a valid revision is kept without an empty edit replacing my words.
OUTCOME  O1  Saving changed text sends the complete revision and closes after
             the save succeeds.
         O2  An empty revision cannot be submitted.
PROVES   O1 -> "persists a valid whole-document change and closes the editor"
         O2 -> "does not submit an empty document"
WHY      Founder-approved Ideal Text editing contract, 2026-11-16; N461.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./MarkedEditor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    createElement("textarea", {
      "aria-label": "Edit your ideal text",
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    }),
}));

import IdealTextEditor from "./IdealTextEditor";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => { root = createRoot(host); });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Edit ideal text", () => {
  it("persists a valid whole-document change and closes the editor", async () => {
    const onSave = vi.fn(async () => true);
    const onCancel = vi.fn();
    act(() => root.render(createElement(IdealTextEditor, {
      initial: "The original words.",
      onSave,
      onCancel,
    })));

    const editor = host.querySelector("textarea") as HTMLTextAreaElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(editor, "The revised words.");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      [...host.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.trim() === "Save")!
        .click();
    });

    expect(onSave).toHaveBeenCalledWith("The revised words.");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not submit an empty document", async () => {
    const onSave = vi.fn(async () => true);
    act(() => root.render(createElement(IdealTextEditor, {
      initial: "Words.",
      onSave,
      onCancel: vi.fn(),
    })));

    const editor = host.querySelector("textarea") as HTMLTextAreaElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(editor, "   ");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      [...host.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent?.trim() === "Save")!.disabled,
    ).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});
