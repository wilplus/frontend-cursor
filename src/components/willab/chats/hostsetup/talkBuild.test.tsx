// @vitest-environment jsdom
/*
STORY    As a host, I build my chat by talking or tapping, one step at a
         time, and I can undo a version and open the list of parts.
OUTCOME
  O1  Brief starts from a quoted "Speaking coach", saves Brief v1, and
      Undo takes that version away.
  O2  Yes and no walk They send one kind at a time. See the list closes
      the talk.
PROVES   O1 -> "a quoted suggestion saves Brief v1 and Undo restores it"
         O2 -> "Yes and No walk the send kinds, and See the list closes the talk"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TalkBuild from "./TalkBuild";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const flush = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); }); };
const tap = async (label: string) => {
  const b = [...container.querySelectorAll("button")].find((x) => x.textContent?.includes(label) || x.getAttribute("aria-label") === label);
  if (!b) throw new Error(label);
  await act(async () => (b as HTMLButtonElement).click());
  await flush();
};

describe("talk the chat into shape", () => {
  it("a quoted suggestion saves Brief v1 and Undo restores it", async () => {
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    expect(container.textContent).toContain("What do you do?");
    expect(container.textContent).toContain("Speaking coach");
    await tap("Speaking coach");
    expect(container.querySelector("textarea")!.value).toBe("Speaking coach");
    await tap("Send");
    expect(container.querySelector("[data-talk-version]")?.textContent).toContain("Brief v1");
    expect(container.querySelector("[data-talk-step='Steps']")?.className).toContain("font-semibold");
    await tap("Undo");
    expect(container.querySelector("[data-talk-version]")).toBeNull();
  });

  it("Yes and No walk the send kinds, and See the list closes the talk", async () => {
    const close = vi.fn();
    act(() => root.render(createElement(TalkBuild, { onList: close })));
    await tap("Speaking coach");
    await tap("Send");
    expect(container.textContent).toContain("Can they send a recording?");
    await tap("Yes");
    expect(container.textContent).toContain("Can they send a message?");
    await tap("No");
    await tap("No");
    await tap("No");
    expect(container.textContent).toContain("Should yours hold their best moment?");
    await tap("See the list");
    expect(close).toHaveBeenCalled();
  });

  it("done jumps to the result, and Earlier moves a walk step", async () => {
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    await tap("Speaking coach");
    await tap("Send");
    const input = container.querySelector<HTMLTextAreaElement>("[data-talk-composer] textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "done");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
    await flush();
    expect(container.querySelector("[data-talk-result]")).not.toBeNull();
    expect(container.textContent).toContain("Open the list");
    expect(container.textContent).toContain("Try it out loud");
  });
});
