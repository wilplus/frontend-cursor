// @vitest-environment jsdom
/*
STORY    As a speaker, I want to edit my whole Ideal Text from its menu, so
         that a valid revision is kept without an empty edit replacing my words.
OUTCOME  O1  Saving changed text sends the complete revision and closes after
             the save succeeds.
         O2  An empty revision cannot be submitted.
         O3  Every exit saves a dirty draft and stays open on failure.
         O4  The editor escapes the project canvas into the app's footer-safe slot.
PROVES   O1 -> "submits a valid whole-document change and closes after confirmation"
         O2 -> "does not submit an empty document"
         O3 -> "keeps unsaved words safe when leaving through %s"
         O4 -> "opens outside the project canvas in the app content slot"
WHY      Founder-approved Ideal Text editing contract, 2026-11-16; N461.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const back = vi.hoisted(() => ({
  onClose: null as (() => void) | null,
  onBack: null as (() => boolean) | null,
}));

vi.mock("./useBackDismiss", () => ({
  useBackDismiss: (onClose: () => void, onBack?: () => boolean) => {
    back.onClose = onClose;
    back.onBack = onBack ?? null;
    return vi.fn();
  },
}));

vi.mock("./MarkedEditor", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    createElement("textarea", {
      "aria-label": "Edit your ideal text",
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    }),
}));

import IdealTextEditor, { IdealTextEditorLayer } from "./IdealTextEditor";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => { root = createRoot(host); });
  back.onClose = null;
  back.onBack = null;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("Edit ideal text", () => {
  it("submits a valid whole-document change and closes after confirmation", async () => {
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

  it.each(["Back", "X", "Cancel", "browser Back"])("keeps unsaved words safe when leaving through %s", async (exit) => {
    const onSave = vi.fn(async () => false);
    const onCancel = vi.fn();
    act(() => root.render(createElement(IdealTextEditor, {
      initial: "Words.",
      onSave,
      onCancel,
    })));

    const editor = host.querySelector("textarea") as HTMLTextAreaElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(editor, "Words I changed.");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      if (exit === "browser Back") {
        expect(back.onBack?.()).toBe(true);
      } else {
        const button = exit === "Cancel"
          ? [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Cancel")!
          : host.querySelector<HTMLButtonElement>(exit === "X" ? 'button[aria-label="Close"]' : 'button[aria-label="Back to ideal text"]')!;
        button.click();
      }
    });

    expect(onSave).toHaveBeenCalledWith("Words I changed.");
    expect(onCancel).not.toHaveBeenCalled();
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Words I changed.");
    expect(host.querySelector('[data-testid="ideal-text-editor-failed"]')).not.toBeNull();
  });

  it("keeps the opening draft baseline and submits only once while a save is pending", async () => {
    let finish!: (ok: boolean) => void;
    const onSave = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const onCancel = vi.fn();
    act(() => root.render(createElement(IdealTextEditor, {
      initial: "Words.",
      onSave,
      onCancel,
    })));

    const editor = host.querySelector("textarea") as HTMLTextAreaElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(editor, "Words changed with Back.");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // A parent refresh must not make our unsaved draft look clean.
    act(() => root.render(createElement(IdealTextEditor, {
      initial: "Words changed with Back.", onSave, onCancel,
    })));
    act(() => {
      back.onBack?.();
      back.onBack?.();
    });
    expect(onSave).toHaveBeenCalledWith("Words changed with Back.");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.disabled).toBe(true);
    await act(async () => { finish(true); });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("opens outside the project canvas in the app content slot", () => {
    const content = document.createElement("div");
    content.dataset.appContent = "";
    document.body.appendChild(content);
    try {
      act(() => root.render(createElement(IdealTextEditorLayer, {
        open: true, initial: "Words.", onSave: vi.fn(), onCancel: vi.fn(),
      })));
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      expect(content.querySelector('[role="dialog"]')).not.toBeNull();
      expect(content.querySelector('button[aria-label="Close"]')).not.toBeNull();
    } finally {
      act(() => root.render(null));
      content.remove();
    }
  });
});
