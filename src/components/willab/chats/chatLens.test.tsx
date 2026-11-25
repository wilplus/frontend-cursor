// @vitest-environment jsdom
/*
STORY    As a speaker, I want a strength, a life goal, my why or the Sunday
         note to go on in my chat, not in a screen of its own (backend N691
         item 5).
OUTCOME  O1  In the chat, the lens's lines and answers are bubbles at the
             thread's end and its taps take the composer's slot; closed, the
             conversation stays and the taps go.
         O2  Where there is no chat (the Life Panel's pages), the lens draws
             its own frame.
PROVES   O1 -> "runs in the chat and stays after it closes"
         O2 -> "keeps its own frame where there is no chat"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ChatLens, { CHAT_LENS_DOCK, CHAT_LENS_THREAD } from "./ChatLens";

vi.mock("../walk/WalkStage", () => ({
  default: ({ screen, render }: { screen: { overlay: boolean }; render: (s: unknown, ghost: boolean) => React.ReactNode }) =>
    screen.overlay ? <div data-own-frame="">{render(screen, false)}</div> : null,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const items = [
  { id: 1, who: "will" as const, node: "Will suggests a strength:" },
  { id: 2, who: "me" as const, node: "Add strength" },
];
const lens = (open: boolean) => (
  <ChatLens open={open} stageKey="strengths" label="Strengths" items={items} typing={false}
    dock={<button type="button">Not now</button>} onClose={() => undefined}
    frame={() => <p>own frame</p>} />
);

it("runs in the chat and stays after it closes", () => {
  const thread = document.createElement("div");
  thread.setAttribute(CHAT_LENS_THREAD, "");
  const dock = document.createElement("div");
  dock.setAttribute(CHAT_LENS_DOCK, "");
  document.body.append(thread, dock);
  act(() => root.render(lens(true)));
  expect(thread.textContent).toContain("Will suggests a strength:");
  expect(thread.querySelector('[data-row="me"]')?.textContent).toBe("Add strength");
  expect(dock.textContent).toContain("Not now");
  expect(document.querySelector("[data-own-frame]")).toBeNull();
  act(() => root.render(lens(false)));
  expect(thread.textContent).toContain("Add strength");
  expect(dock.textContent).toBe("");
});

it("keeps its own frame where there is no chat", () => {
  act(() => root.render(lens(true)));
  expect(document.querySelector("[data-own-frame]")?.textContent).toBe("own frame");
});
