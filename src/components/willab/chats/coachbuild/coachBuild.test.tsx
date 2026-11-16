// @vitest-environment jsdom
/*
STORY    As the founder, I want to build the speaking coach from today's
         coach, one question at a time, and a paste must not run.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import CoachBuild from "./CoachBuild";
import { speakingCoachSeed } from "@/lib/willab/chatBuilder/seed";

let root: Root;
const host = document.createElement("div");
document.body.appendChild(host);

afterEach(() => {
  act(() => root?.unmount());
});

function render(node: React.ReactElement) {
  act(() => {
    root = createRoot(host);
    root.render(node);
  });
}

const labels = () => [...host.querySelectorAll("button")].map((b) => b.textContent);

describe("the speaking-coach builder", () => {
  it("starts from today's coach and keeps a locked line", async () => {
    let doc = speakingCoachSeed();
    render(createElement(CoachBuild, { doc, onChange: (next) => { doc = next; }, onClose: () => undefined }));
    expect(host.textContent).toContain("Tap a part.");
    const line = [...host.querySelectorAll("button")].find((b) => b.textContent === "A line");
    await act(async () => { line?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    const lesson = [...host.querySelectorAll("button")].find((b) => b.textContent === "Lesson done.");
    await act(async () => { lesson?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(host.textContent).toContain("That word is locked.");
    expect(labels()).toContain("Keep");
  });

  it("keeps a paste that calls eval as not live", async () => {
    render(createElement(CoachBuild, { doc: speakingCoachSeed(), onChange: () => undefined, onClose: () => undefined }));
    const paste = [...host.querySelectorAll("button")].find((b) => b.textContent === "Paste an intervention");
    await act(async () => { paste?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    const box = host.querySelector("textarea");
    await act(async () => {
      if (box) {
        const tracker = (box as HTMLTextAreaElement & { _valueTracker?: { setValue: (value: string) => void } })._valueTracker;
        tracker?.setValue("");
        box.value = "eval(source)\nid: x\nrole: detector\ninterventionType: NOTICE\nhears: hedging\nstep: walk.message\n";
        box.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const check = [...host.querySelectorAll("button")].find((b) => b.textContent === "Check it");
    await act(async () => {
      check?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(host.textContent).toContain("cannot run");
    expect(host.textContent).not.toContain("Use it is on");
  });
});
