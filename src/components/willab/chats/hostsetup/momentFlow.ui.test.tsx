// @vitest-environment jsdom
/*
STORY    As a host I open Moments from Settings, set the recording and the
         checkpoints, and try the flow as a visitor. As that visitor I give
         a baseline, record, see a labelled placeholder, and delete it.
OUTCOME
  O1  Settings keeps the answer list and adds Moments.
  O2  Saving a shorter recording stays on this device, and the setup shows
      no visitor result.
  O3  Try walks baseline, recording, placeholder results, then delete.
PROVES   O1 -> "Moments sits on the settings list"
         O2 -> "the host saves the recording limit and sees no result"
         O3 -> "the visitor baseline, placeholder and delete"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speakingCoachSeed } from "@/lib/willab/chatBuilder/seed";
import { clearTalkDraft, markTalkReady, saveTalkDraft } from "@/lib/willab/chatBuilder/talkDraft";
import { clearTileSteps } from "@/lib/willab/chatBuilder/tileSteps";
import { readMomentConfig, readSpeaker } from "@/lib/willab/chatBuilder/momentFlow";

vi.mock("@/lib/api/bffFetch", () => ({
  bffFetch: vi.fn(async () => ({ kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } })),
}));
vi.mock("../../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Artur" }, loading: false, isCoach: false }) }));

import WillBuild from "../WillBuild";
import { forgetSetup } from "./hostSetupDoor";
import { forgetHostWork } from "./hostWork";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  forgetSetup();
  forgetHostWork();
  clearTalkDraft();
  clearTileSteps();
  localStorage.clear();
  sessionStorage.clear();
  saveTalkDraft({
    definition: speakingCoachSeed(),
    sends: ["rec", "text"],
    models: [],
    otherModels: [],
    pricing: { pay: false, price: 0 },
    api: false,
    machine: true,
    code: "",
    interaction: "shadow",
    published: false,
  });
  markTalkReady(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
const click = async (selector: string) => {
  const node = host.querySelector(selector);
  if (!node) throw new Error(`missing ${selector}`);
  await act(async () => (node as HTMLButtonElement).click());
  await flush();
};
const clickText = async (selector: string, text: string) => {
  const node = [...host.querySelectorAll(selector)].find((el) => el.textContent === text);
  if (!node) throw new Error(`missing ${text}`);
  await act(async () => (node as HTMLButtonElement).click());
  await flush();
};

describe("Moment to Intervention in the builder", () => {
  it("Moments sits on the settings list", async () => {
    act(() => root.render(createElement(WillBuild, { onBack: () => undefined })));
    await flush();
    await click("[data-build-tile='settings']");
    expect(host.querySelector("[data-answer-list]")).not.toBeNull();
    expect(host.querySelector("[data-moment-open]")).not.toBeNull();
  });

  it("the host saves the recording limit and sees no result", async () => {
    act(() => root.render(createElement(WillBuild, { onBack: () => undefined })));
    await flush();
    await click("[data-build-tile='settings']");
    await click("[data-moment-open]");
    expect(host.querySelector("[data-moment-setup]")).not.toBeNull();
    expect(host.querySelector("[data-moment-result], [data-moment-checkpoint-result]")).toBeNull();
    expect(host.textContent).not.toContain("Placeholder. This is not a reading");
    await click("[data-moment-minutes='3']");
    await click("[data-moment-save]");
    expect(readMomentConfig().recordingSeconds).toBe(180);
    expect(host.querySelector("[data-moment-saved]")?.textContent).toContain("Saved on this device.");
  });

  it("the visitor baseline, placeholder and delete", async () => {
    act(() => root.render(createElement(WillBuild, { onBack: () => undefined })));
    await flush();
    await click("[data-build-tile='settings']");
    await click("[data-moment-open]");
    await click("[data-moment-try]");
    expect(host.querySelector("[data-moment-visit]")?.getAttribute("data-moment-step")).toBe("baseline");
    await clickText("[data-moment-answer='engaged']", "Not engaged");
    await clickText("[data-moment-answer='valence']", "Supportive");
    await click("[data-moment-sample]");
    await click("[data-moment-continue]");
    expect(host.querySelector("[data-moment-record]")).not.toBeNull();
    expect(host.textContent).toContain("Up to 5 minutes.");
    await click("[data-moment-record-go]");
    expect(host.querySelector("[data-moment-disclosure]")?.textContent).toBe("This feedback is generated by AI.");
    expect(host.querySelector("[data-moment-private]")?.textContent).toContain("Only you can see this");
    expect(host.querySelector("[data-moment-placeholder]")?.textContent).toContain("not a reading");
    expect(host.querySelector("[data-moment-checkpoint-result='2'] [data-moment-fired='pace']")).not.toBeNull();
    expect(host.querySelector("[data-moment-checkpoint-result='3'] [data-moment-quiet='rewrite']")).not.toBeNull();
    await click("[data-moment-delete]");
    expect(host.querySelector("[data-moment-deleted]")?.textContent).toContain("Deleted");
    expect(readSpeaker()).toBeNull();
    expect(readMomentConfig().recordingSeconds).toBe(300);
  });
});
