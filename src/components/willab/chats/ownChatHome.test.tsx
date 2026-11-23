// @vitest-environment jsdom
/*
STORY    As a host, I want to start my own chat from the list, pick its
         icon, and copy its link, so people I share it with can use it.
OUTCOME
  O1  Start your own chat sits at the bottom of the chat rows, above
      Start a new project. Close leaves the list as it was.
  O2  Yes opens Build, pins the chat at the top under its name, and
      hides the starter row. Back returns to that list.
  O3  The share control copies /c/<id>, or the host's join path when
      one already exists, and says Link copied.
  O4  The circle starts as the initial, can be an emoji, and wears the
      three-dots badge at about 40% of the avatar.
PROVES   O1 -> "the starter row sits above Start a new project, and Close changes nothing"
         O2 -> "Yes pins the chat at the top and Back returns to the list"
         O3 -> "Share copies the public link"
         O4 -> "the icon defaults to the initial and the badge is forty percent"
*/
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingArc } from "@/services/api/trainings";
import { OWN_CHAT_KEY, publicChatHref, readOwnChat, rememberOwnName, startOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { speakingCoachSeed } from "@/lib/willab/chatBuilder/seed";
import { clearTalkDraft, markTalkReady, saveTalkDraft } from "@/lib/willab/chatBuilder/talkDraft";
import { clearTileSteps } from "@/lib/willab/chatBuilder/tileSteps";

vi.mock("@/lib/api/bffFetch", () => ({
  bffFetch: vi.fn(async () => ({ kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } })),
}));
vi.mock("../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Artur" }, loading: false, isCoach: false }) }));

import ProductHome from "./ProductHome";
import WillBuild from "./WillBuild";
import { forgetSetup } from "./hostsetup/hostSetupDoor";
import { forgetHostWork } from "./hostsetup/hostWork";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const project = { arcId: "bro", topic: "just my take bro" } as TrainingArc;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  forgetSetup();
  forgetHostWork();
  clearTalkDraft();
  clearTileSteps();
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); }); };
const ids = () => [...host.querySelectorAll("[data-home-row]")].map((row) => row.getAttribute("data-home-row"));
const click = async (selector: string) => {
  await act(async () => (host.querySelector(selector) as HTMLButtonElement).click());
  await flush();
};

function Door() {
  const [open, setOpen] = useState(false);
  return createElement("div", null,
    createElement(ProductHome, {
      knownProjects: [project],
      onOpenSpeaking: () => undefined,
      onOpenProject: () => undefined,
      onStartNewProject: () => undefined,
      onOpenOwnChat: () => setOpen(true),
    }),
    open ? createElement(WillBuild, { onBack: () => setOpen(false) }) : null,
  );
}

describe("Start your own chat", () => {
  it("the starter row sits above Start a new project, and Close changes nothing", async () => {
    const open = vi.fn();
    act(() => root.render(createElement(ProductHome, {
      knownProjects: [project],
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
      onOpenOwnChat: open,
    })));
    await flush();
    expect(ids()).toEqual(["speaking-coach", "bro", "start-own-chat"]);
    const row = host.querySelector("[data-home-row='start-own-chat']")!;
    const action = host.querySelector("[data-start-new-project]")!;
    expect(row.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await click("[data-home-row='start-own-chat'] button");
    expect(host.querySelector("[data-own-chat-sheet]")?.textContent).toContain("Make your own chat. You choose what it does. People you share it with can use it.");
    await click("[data-own-chat-close]");
    expect(host.querySelector("[data-own-chat-sheet]")).toBeNull();
    expect(readOwnChat().started).toBe(false);
    expect(ids()).toEqual(["speaking-coach", "bro", "start-own-chat"]);
    expect(open).not.toHaveBeenCalled();
  });

  it("Yes pins the chat at the top and Back returns to the list", async () => {
    act(() => root.render(createElement(Door)));
    await flush();
    await click("[data-home-row='start-own-chat'] button");
    await click("[data-own-chat-yes]");
    expect(host.querySelector("[data-build-bar]")).not.toBeNull();
    expect(host.querySelector("[data-will-badge]")).not.toBeNull();
    expect(host.querySelector("[data-build-tile='build']")?.textContent).toContain("Build");
    expect(host.querySelector("[data-tile-highlight]")).toBe(host.querySelector("[data-build-tile='build']"));
    expect(host.querySelector("[data-tile-tick]")).toBeNull();
    await click("[data-chat-header] button[aria-label='Back']");
    expect(host.querySelector("[data-build-bar]")).toBeNull();
    expect(ids()[0]).toBe("own-chat");
    expect(host.querySelector("[data-home-row='own-chat']")?.textContent).toContain("Your chat");
    expect(host.querySelector("[data-home-row='start-own-chat']")).toBeNull();
    rememberOwnName("Ask Artur");
    await flush();
    expect(host.querySelector("[data-home-row='own-chat']")?.textContent).toContain("Ask Artur");
  });

  it("Share copies the public link", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    startOwnChat();
    const href = publicChatHref("https://willpowerlab.com", readOwnChat().id, null);
    expect(href).toBe(`https://willpowerlab.com/c/${encodeURIComponent(readOwnChat().id)}`);
    expect(publicChatHref("https://willpowerlab.com", "ignored", "/c/k7Q2")).toBe("https://willpowerlab.com/c/k7Q2");
    act(() => root.render(createElement(WillBuild, { onBack: () => undefined })));
    await flush();
    await click("[data-share-chat]");
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/c\//));
    expect(host.querySelector("[data-link-copied]")?.textContent).toBe("Link copied");
    expect(localStorage.getItem(OWN_CHAT_KEY)).toContain("started");
  });

  it("the icon defaults to the initial and the badge is forty percent", async () => {
    act(() => root.render(createElement(Door)));
    await flush();
    await click("[data-home-row='start-own-chat'] button");
    await click("[data-own-chat-yes]");
    const badge = host.querySelector<HTMLElement>("[data-build-bar] [data-will-badge]")!;
    expect(badge.style.width).toBe(`${Math.round(36 * 0.4)}px`);
    const listed = host.querySelector<HTMLElement>("[data-home-row='own-chat'] [data-will-badge]")!;
    expect(listed.style.width).toBe(`${Math.round(48 * 0.4)}px`);
    expect(host.querySelector("[data-chat-letter]")).not.toBeNull();
    await click("[data-icon-open]");
    expect(host.textContent).toContain("Pick a picture");
    const emoji = [...host.querySelectorAll("button")].find((button) => button.textContent === "🎤");
    await act(async () => emoji?.click());
    await flush();
    expect(readOwnChat().face).toEqual({ kind: "emoji", emoji: "🎤" });
    expect(host.querySelector("[data-chat-face='emoji']")?.textContent).toBe("🎤");
    console.log("OWN CHAT 4/4 = 100%");
  });

  it("Your chat lists each answer, opens your own code, and tries the chat as a visitor", async () => {
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
    startOwnChat();
    act(() => root.render(createElement(WillBuild, { onBack: () => undefined })));
    await flush();
    expect(host.querySelectorAll("[data-build-tile]")).toHaveLength(4);
    expect([...host.querySelectorAll("[data-build-tile]")].map((tile) => (tile.textContent ?? "").replace(/\s+/g, ""))).toEqual(["Build", "Settings", "Test", "AI"]);
    expect(host.querySelector("[data-tile-highlight]")).toBe(host.querySelector("[data-build-tile='settings']"));
    expect(host.querySelector("[data-tile-tick='build']")).not.toBeNull();
    expect(host.querySelector("[data-tile-tick='settings']")).toBeNull();
    expect(host.querySelector("[data-build-tab]")).toBeNull();
    expect(host.querySelector("[data-part-search]")).toBeNull();
    await click("[data-build-tile='settings']");
    expect(host.querySelector("[data-answer-list]")).not.toBeNull();
    expect(host.textContent).toContain("Your own code");
    expect(host.textContent).toContain("Add a small piece of code that runs when someone sends something.");
    await click("[data-build-part='hello']");
    expect(host.querySelector("[data-part-chat='hello']")).not.toBeNull();
    await click("[data-part-chat='hello'] button[aria-label='Back']");
    await click("[data-build-part='code']");
    expect(host.textContent).toContain("Add a small piece of code that runs when someone sends something?");
    expect(host.querySelectorAll("[data-chat-header]")).toHaveLength(1);
    const no = [...host.querySelectorAll("[data-part-chat='code'] button")].find((button) => button.textContent === "No");
    await act(async () => (no as HTMLButtonElement).click());
    await flush();
    await click("[data-build-bar] button[aria-label='Back']");
    expect(host.querySelector("[data-tile-tick='settings']")).not.toBeNull();
    expect(host.querySelector("[data-tile-highlight]")).toBe(host.querySelector("[data-build-tile='test']"));
    await click("[data-build-tile='test']");
    expect(host.querySelector("[data-visitor-try]")).not.toBeNull();
    expect(host.textContent).toContain("Hi. Record a short talk");
    const stream = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stream }] })),
    } });
    class Recorder {
      static isTypeSupported() { return true; }
      mimeType = "audio/webm";
      state = "inactive";
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    const objectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    try {
      await click("[data-visitor-rec]");
      expect(host.querySelector<HTMLTextAreaElement>("[data-chat-input]")?.hidden).toBe(true);
      await click("[data-chat-mic][data-recording]");
      expect(stream).toHaveBeenCalledOnce();
      expect(host.querySelector('audio[aria-label="Play recording"]')).not.toBeNull();
      expect(host.querySelectorAll("[data-visitor-line='them']")).toHaveLength(1);
      await click("[data-chat-send]");
      expect(host.querySelectorAll("[data-visitor-line='them']").length).toBeGreaterThan(1);
    } finally {
      objectUrl.mockRestore();
      revoke.mockRestore();
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "mediaDevices");
    }
    await click("[data-visitor-try] button[aria-label='Back']");
    expect(host.querySelector("[data-build-home]")).not.toBeNull();
    expect(host.querySelector("[data-tile-tick='test']")).not.toBeNull();
    expect(host.querySelector("[data-tile-tick='ai']")).toBeNull();
  });
});
