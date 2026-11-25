// @vitest-environment jsdom
/*
STORY    As the founder, I want Training to be the one page where I label
         moments, so that what I teach goes to the two pickers and nothing
         else is in the way (backend N702).
OUTCOME
  O1  The founder's Training is the labeling page: the coach's queues on
      top, then Your Takes, Training Corpus and Pattern Library; no kept-
      replies count and no "Your own" switch.
  O2  Anyone else's Training keeps their models and what they teach, and
      has no kept-replies count or "Your own" switch either.
PROVES   O1 -> "the founder's Training is the labeling page"
         O2 -> "everyone else keeps their models, without the 200 switch"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const who = vi.hoisted(() => ({ email: "someone@example.com" }));
vi.mock("../../useUserEmail", () => ({ useUserEmail: () => who.email }));
vi.mock("@/lib/founder", () => ({ isFounderEmail: (email: string) => email === "founder@example.com" }));
vi.mock("../BuildModels", () => ({
  default: ({ queuesOnly }: { queuesOnly?: boolean }) => <div data-models={queuesOnly ? "queues" : "all"} />,
}));
vi.mock("./SpeakingCalibration", () => ({
  default: ({ top }: { top?: React.ReactNode }) => <div data-labeling="">{top}Your Takes</div>,
}));

import AiDoor from "./AiDoor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

function openTraining() {
  act(() => root.render(<AiDoor onBindBack={() => {}} />));
  act(() => host.querySelector<HTMLButtonElement>("[data-ai-choice='training']")!.click());
}

it("the founder's Training is the labeling page", () => {
  who.email = "founder@example.com";
  openTraining();
  expect(host.querySelector("[data-labeling]")).not.toBeNull();
  expect(host.querySelector("[data-models='queues']")).not.toBeNull();
  expect(host.textContent).not.toContain("unlocks at");
  expect(host.textContent).not.toContain("You’ve kept");
});

it("everyone else keeps their models, without the 200 switch", () => {
  who.email = "someone@example.com";
  openTraining();
  expect(host.querySelector("[data-labeling]")).toBeNull();
  expect(host.querySelector("[data-models='all']")).not.toBeNull();
  expect(host.textContent).not.toContain("unlocks at");
  expect(host.textContent).not.toContain("You’ve kept");
});
