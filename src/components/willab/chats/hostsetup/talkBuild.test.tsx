// @vitest-environment jsdom
/*
STORY    As a host, I build my chat by talking or tapping, one question at
         a time. A tap on an earlier answer changes it.
OUTCOME
  O1  What do you do? offers four jobs above the box. A tap sends it.
      Tapping that answer opens the four jobs again.
  O2  Yes and no walk They send one kind at a time. There is no See the
      list on this screen.
PROVES   O1 -> "four jobs sit above the box, and an earlier answer opens them again"
         O2 -> "Yes and No walk the send kinds, and this screen has no list"
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
  it("four jobs sit above the box, and an earlier answer opens them again", async () => {
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    expect(container.textContent).toContain("What do you do?");
    expect([...container.querySelectorAll("[data-talk-replies] button")].map((b) => b.textContent)).toEqual(["Speaking coach", "ML specialist", "Neurobiologist", "Someone else"]);
    expect(container.querySelector("[data-talk-steps]")).toBeNull();
    expect(container.querySelector("[data-talk-mic]")).toBeNull();
    expect(container.querySelector("[data-talk-list]")).toBeNull();
    expect(container.textContent).not.toContain("You decide");
    const box = container.querySelector("textarea")!;
    await tap("Someone else");
    expect(document.activeElement).toBe(box);
    expect(container.querySelector("[data-talk-phase]")?.getAttribute("data-talk-phase")).toBe("brief");
    await tap("Speaking coach");
    expect(container.textContent).toContain("Can they send a recording?");
    await act(async () => (container.querySelector("[data-my-answer]") as HTMLElement).click());
    await flush();
    expect([...container.querySelectorAll("[data-talk-replies] button")].map((b) => b.textContent)).toEqual(["Speaking coach", "ML specialist", "Neurobiologist", "Someone else"]);
    await tap("ML specialist");
    expect(container.querySelector("[data-my-answer]")?.textContent).toBe("ML specialist");
    expect(container.textContent).toContain("Can they send a recording?");
  });

  it("Yes and No walk the send kinds, and this screen has no list", async () => {
    const close = vi.fn();
    act(() => root.render(createElement(TalkBuild, { onList: close })));
    await tap("Speaking coach");
    expect(container.textContent).toContain("Can they send a recording?");
    await tap("Yes");
    expect(container.textContent).toContain("Can they send a message?");
    await tap("No");
    await tap("No");
    await tap("No");
    expect(container.textContent).toContain("After they send a recording, should your chat show them their best moment and why it worked?");
    expect(container.querySelector("[data-talk-list]")).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });

  it("done does not skip the question that is open", async () => {
    act(() => root.render(createElement(TalkBuild, { onList: () => undefined })));
    expect(container.querySelector("[data-express]")).toBeNull();
    await tap("Speaking coach");
    const input = container.querySelector<HTMLTextAreaElement>("[data-talk-composer] textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "done");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
    await flush();
    expect(container.querySelector("[data-talk-result]")).toBeNull();
    expect(container.textContent).toContain("Can they send a recording?");
    expect(container.textContent).toContain("Yes or no.");
  });
});
