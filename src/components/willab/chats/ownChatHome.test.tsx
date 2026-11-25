// @vitest-environment jsdom
/*
STORY    As a host, I want to start my own chat from the list, pick its
         icon, and copy its link, so people I share it with can use it.
OUTCOME
  O1  Start your own chat sits in the setup section below the chats.
      Close leaves the list as it was.
  O2  Yes opens Build, pins the chat at the top under its name, and
      turns the setup action into Edit your chat.
  O3  The share control copies /c/<id>, or the host's join path when
      one already exists, and says Link copied.
  O4  The circle starts as the initial, can be an emoji, and wears the
      three-dots badge at about 40% of the avatar.
  O5  A new specialist chat can reopen its saved structured reply in place.
PROVES   O1 -> "the starter row sits in sidebar setup, and Close changes nothing"
         O2 -> "Yes pins the chat and gives it a direct setup shortcut"
         O3 -> "Share copies the public link"
         O4 -> "the icon defaults to the initial and the badge is forty percent"
         O5 -> "a specialist reply keeps its artifact through a legacy save and reload"
*/
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingArc } from "@/services/api/trainings";
import { bffFetch } from "@/lib/api/bffFetch";
import type { BuiltChatTurn } from "@/services/api/chatStructure";
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
import VisitorTry from "./hostsetup/VisitorTry";
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
  sessionStorage.clear();
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
  await act(async () => (document.querySelector(selector) as HTMLElement).click());
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
  it("a specialist reply keeps its artifact through a legacy save and reload", async () => {
    const content = {
      version: 1, title: "Consultation notes", preview: "Appointment details",
      moment: "You asked about appointment availability.",
      intervention: "Pick a day that suits you.", output: "Tuesday was confirmed.",
    } as const;
    const requests: BuiltChatTurn[] = [];
    let history: BuiltChatTurn[] = [];
    const api = vi.mocked(bffFetch);
    api.mockImplementation(async (path, request) => {
      if (path.endsWith("/reply")) return {
        kind: "response", ok: true, status: 200, body: { shown: true, reply: "Here are the details.", artifact: content },
      };
      if (request?.method === "POST") {
        const receipt = request.json as BuiltChatTurn;
        requests.push(receipt);
        const olderWriter = requests.length === 1;
        history = [olderWriter ? { ...receipt, artifact: null } : receipt];
        return { kind: "response", ok: true, status: 200, body: { saved: true, artifact_saved: !olderWriter } };
      }
      return { kind: "response", ok: true, status: 200, body: { turns: history } };
    });
    const preview = "[data-chat-artifact-preview]";
    const doc = speakingCoachSeed();
    const page = (key: string) => <VisitorTry key={key} name="Ask a trichologist" doc={doc} sends={["text"]}
      onBack={() => undefined} section={{ id: "main", owner: "fixture" }} />;
    try {
      await act(async () => root.render(page("first")));
      const input = host.querySelector<HTMLTextAreaElement>("[data-chat-input]")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, "When can I come in?");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => host.querySelector("[data-chat-box]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      await flush();
      expect(requests[0]?.artifact).toEqual(content);
      await click(preview);
      expect(host.textContent).toContain("Tuesday was confirmed.");

      await act(async () => root.render(page("again")));
      expect(host.querySelectorAll(preview)).toHaveLength(1);
      expect(host.querySelector("[data-chat-artifact-open]")).toBeNull();
      const retry = [...host.querySelectorAll("button")].find((button) => button.textContent === "Try again");
      expect(retry).toBeTruthy();
      await act(async () => retry?.click());
      expect(requests[1]).toEqual(requests[0]);
      await act(async () => root.render(page("stored")));
      await click(preview);
      expect(host.querySelector("[data-artifact-section='moment']")?.textContent).toBe(content.moment);
      expect(host.querySelector("[data-artifact-section='intervention']")?.textContent).toBe(content.intervention);
      expect(host.querySelector("[data-artifact-section='output']")?.textContent).toBe(content.output);
    } finally {
      api.mockImplementation(async () => ({ kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } }));
    }
  });

  it("the starter row sits in sidebar setup, and Close changes nothing", async () => {
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
    expect(row.closest("[data-chat-sidebar-setup]")).not.toBeNull();
    expect(host.querySelector("[data-product-projects] [data-start-new-project]")).not.toBeNull();
    const starter = row.querySelector("button")!;
    starter.focus();
    await click("[data-home-row='start-own-chat'] button");
    const prompt = document.querySelector('[data-own-chat-sheet] [role="dialog"]')!;
    expect(prompt.textContent).toContain("Make your own chat. You choose what it does. People you share it with can use it.");
    expect(document.activeElement).toBe(prompt.querySelector("[data-own-chat-close]"));
    await click("[data-own-chat-close]");
    expect(document.querySelector("[data-own-chat-sheet]")).toBeNull();
    expect(document.activeElement).toBe(starter);
    expect(readOwnChat().started).toBe(false);
    expect(ids()).toEqual(["speaking-coach", "bro", "start-own-chat"]);
    expect(open).not.toHaveBeenCalled();
  });

  it("can start a fresh project after deleting Speaking Coach", async () => {
    const change = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const start = vi.fn();
    act(() => root.render(createElement(ProductHome, {
      knownProjects: [],
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: start,
      structure: { layout: { coach: "deleted", builder: "active" }, change },
    })));
    await click("[data-start-new-project]");
    expect(start).not.toHaveBeenCalled();
    await click("[data-start-new-project]");
    expect(change).toHaveBeenLastCalledWith({ action: "restore", section: "coach" });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("Yes pins the chat and gives it a direct setup shortcut", async () => {
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
    expect(host.querySelector("[data-home-row='start-own-chat']")?.textContent).toContain("Edit your chat");
    await click("[data-home-row='start-own-chat'] button");
    expect(host.querySelector("[data-build-bar]")).not.toBeNull();
    expect(document.querySelector("[data-own-chat-sheet]")).toBeNull();
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
    expect(listed.style.width).toBe(`${Math.round(24 * 0.4)}px`);
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
