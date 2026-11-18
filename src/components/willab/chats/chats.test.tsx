// @vitest-environment jsdom
/*
STORY    As a speaker, I want the home to lead with my Speaking coach and
         projects, so the older people-chat list does not define my practice IA.
OUTCOME  The door waits for auth, preserves the people-chat read, and then
         paints Speaking coach, active projects and Start a new project.
PROVES   No general Will destination or floating add button is part of home.
*/
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { TrainingArc } from "@/services/api/trainings";

const session = vi.hoisted(() => ({ signedIn: true as boolean | null }));
const state = vi.hoisted(() => ({
  thread: { loading: false, messages: [] as LoungeMessage[] },
  fetchTrainings: vi.fn(),
  legacyRead: vi.fn(),
}));
vi.mock("../useSignedIn", () => ({ useSignedIn: () => session.signedIn }));
vi.mock("../LoungeThreadContext", () => ({ useLoungeThreadMaybe: () => state.thread }));
vi.mock("./useChats", () => ({
  useChatsDecided: () => session.signedIn,
  useChatList: (on: boolean) => {
    if (on) state.legacyRead();
    return { chats: [], reload: vi.fn() };
  },
  useForgetChatsSignedOut: vi.fn(),
}));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: state.fetchTrainings }));
vi.mock("@/components/willab/chats/ChatList", () => ({
  ChatListRow: ({ id, title, circle, onOpen }: { id: string; title: string; circle: ReactNode; onOpen: () => void }) =>
    createElement("button", { type: "button", "data-chat-row": id, onClick: onOpen }, circle, title),
  WillMark: () => createElement("span", { "data-will-mark": "" }),
}));
vi.mock("../useBackDismiss", () => ({ useBackStop: vi.fn(), useBackDismiss: vi.fn() }));

import { useChatsDoor } from "./useChatsDoor";

const arc = (arcId: string, topic: string, archived = false): TrainingArc => ({
  arcId,
  topic,
  createdAt: null,
  takeCount: 0,
  takes: [],
  batchVerified: false,
  idealReady: false,
  bestPresentationArcId: arcId,
  coverRef: null,
  deletion: null,
  archived,
  practiceProgress: 0,
  practiceChunks: [],
});

let root: Root;
let host: HTMLDivElement;

function Surface({ onOpenProject, onStartNewProject }: { onOpenProject: (project: TrainingArc) => void; onStartNewProject: () => void }) {
  const door = useChatsDoor(false, undefined, { onOpenProject, onStartNewProject });
  return createElement("div", null, door.back, door.front);
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  session.signedIn = true;
  state.thread.loading = false;
  state.fetchTrainings.mockReset().mockResolvedValue([arc("a", "Board pitch"), arc("b", "Team update"), arc("old", "Old", true)]);
  state.legacyRead.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("the speaking-coach door", () => {
  it("waits for auth without painting a stale destination", () => {
    session.signedIn = null;
    act(() => root.render(createElement(Surface, { onOpenProject: vi.fn(), onStartNewProject: vi.fn() })));
    expect(host.querySelector("[data-chats-waiting]")).not.toBeNull();
    expect(host.textContent).not.toContain("Will");
  });

  it("keeps the people-chat read but uses the product home as the IA", async () => {
    const openProject = vi.fn();
    const startNew = vi.fn();
    act(() => root.render(createElement(Surface, { onOpenProject: openProject, onStartNewProject: startNew })));
    await flush();
    expect(state.legacyRead).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Speaking coach");
    expect(host.textContent).toContain("Board pitch");
    expect(host.textContent).toContain("Team update");
    expect(host.textContent).not.toContain("Old");
    expect(host.textContent).toContain("Start a new project");
    expect(host.textContent).not.toContain("Will");
    expect(host.querySelector("[data-add-someone]")).toBeNull();

    await act(async () => (host.querySelector('[data-home-row="b"] button') as HTMLButtonElement).click());
    expect(openProject).toHaveBeenCalledWith(expect.objectContaining({ arcId: "b" }));
    await act(async () => (host.querySelector("[data-start-new-project]") as HTMLButtonElement).click());
    expect(startNew).toHaveBeenCalledTimes(1);
  });

  it("keeps the project index mounted while Speaking coach is open", async () => {
    act(() => root.render(createElement(Surface, {
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    await flush();
    expect(state.fetchTrainings).toHaveBeenCalledTimes(1);

    await act(async () => {
      (host.querySelector('[data-home-row="speaking-coach"] button') as HTMLButtonElement).click();
    });
    expect(host.querySelector("[data-chats-front]")?.classList.contains("hidden")).toBe(true);
    const back = host.querySelector('button[aria-label="Back"]') as HTMLButtonElement;
    await act(async () => back.click());
    await flush();

    expect(host.querySelector("[data-chats-front]")?.classList.contains("hidden")).toBe(false);
    expect(state.fetchTrainings).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Board pitch");
  });
});
