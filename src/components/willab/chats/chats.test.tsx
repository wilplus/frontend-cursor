// @vitest-environment jsdom
/*
STORY    As a speaker, I want Speaking Coach and my chats in one sidebar that
         is available throughout the chat workspace.
OUTCOME  Selecting a chat or project swaps the main pane and keeps the sidebar.
PROVES   The project index is shared and Builder setup is at the bottom.
*/
import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingArc } from "@/services/api/trainings";

const session = vi.hoisted(() => ({ signedIn: true as boolean | null }));
const state = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
  legacyRead: vi.fn(),
}));
vi.mock("../useSignedIn", () => ({ useSignedIn: () => session.signedIn }));
vi.mock("../useUserId", () => ({ useUserId: () => session.signedIn ? "signed-in-owner" : null }));
vi.mock("@/services/api/chatStructure", () => ({
  fetchChatStructure: async () => ({ coach: "active", builder: "active", subchats: [] }),
  changeChatStructure: vi.fn(),
}));
vi.mock("./useChats", () => ({
  useChatsDecided: () => session.signedIn,
  useChatList: (on: boolean) => {
    useEffect(() => { if (on) state.legacyRead(); }, [on]);
    return { chats: [], reload: vi.fn() };
  },
  useForgetChatsSignedOut: vi.fn(),
}));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: state.fetchTrainings }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ DashboardAccountMenu: () => null }));
vi.mock("./WillBuild", () => ({ default: () => createElement("div", { "data-builder-pane": "" }) }));
vi.mock("../useBackDismiss", () => ({ useBackStop: vi.fn(), useBackDismiss: vi.fn() }));

import ChatWorkspace from "./ChatWorkspace";
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
});

let root: Root;
let host: HTMLDivElement;

function Surface({ onOpenProject, onStartNewProject }: { onOpenProject: (project: TrainingArc) => void; onStartNewProject: () => void }) {
  const [project, setProject] = useState<TrainingArc | null>(null);
  const door = useChatsDoor(undefined, {
    activeProject: project,
    onOpenProject: (arc) => { setProject(arc); onOpenProject(arc); },
    onLeaveProject: () => setProject(null),
    onStartNewProject,
  });
  if (door.waiting) return createElement("div", { "data-chats-waiting": "" });
  return (
    <ChatWorkspace sidebar={door.sidebar} viewKey={door.activeChat}>
      {door.heading}
      {door.pane}
      {project ? <div data-project-pane>{project.topic}</div> : null}
      {door.loungeCovered ? null : <div data-coach-pane="" />}
    </ChatWorkspace>
  );
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  session.signedIn = true;
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  state.fetchTrainings.mockReset().mockResolvedValue([arc("a", "Board pitch"), arc("b", "Team update"), arc("old", "Old", true)]);
  state.legacyRead.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const row = (id: string) => host.querySelector<HTMLButtonElement>(`[data-chat-row="${id}"]`)!;
const click = (button: HTMLButtonElement) => act(async () => button.click());

describe("the chat workspace", () => {
  it("waits for auth without painting a stale destination", () => {
    session.signedIn = null;
    act(() => root.render(createElement(Surface, { onOpenProject: vi.fn(), onStartNewProject: vi.fn() })));
    expect(host.querySelector("[data-chats-waiting]")).not.toBeNull();
    expect(host.textContent).not.toContain("Will");
  });

  it("lists projects under Speaking Coach and opens each directly in the main pane", async () => {
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
    const workspace = host.querySelector("[data-chat-workspace]")!;
    const sidebar = workspace.querySelector(":scope > aside");
    const main = workspace.querySelector(":scope > [data-chat-main]");
    const projects = row("speaking-coach").parentElement?.nextElementSibling;
    expect(projects?.hasAttribute("data-product-projects")).toBe(true);
    expect(projects?.contains(row("b"))).toBe(true);
    expect(main?.querySelector("[data-coach-pane]")).not.toBeNull();

    await click(row("b"));
    expect(openProject).toHaveBeenCalledWith(expect.objectContaining({ arcId: "b" }));
    expect(row("b").getAttribute("aria-current")).toBe("page");
    expect(main?.querySelector("[data-project-pane]")?.textContent).toBe("Team update");
    expect(main?.querySelector("nav, select, aside")).toBeNull();

    await click(row("a"));
    expect(main?.querySelector("[data-project-pane]")?.textContent).toBe("Board pitch");
    await click(row("speaking-coach"));
    expect(main?.querySelector("[data-coach-pane]")).not.toBeNull();
    expect(workspace.querySelector(":scope > aside")).toBe(sidebar);
    expect(state.fetchTrainings).toHaveBeenCalledTimes(1);

    await click(host.querySelector<HTMLButtonElement>("[data-start-new-project]")!);
    expect(startNew).toHaveBeenCalledTimes(1);
  });

  it("keeps only Builder setup at the bottom of the shared sidebar", async () => {
    act(() => root.render(createElement(Surface, {
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    await flush();
    const setup = host.querySelector("[data-chat-sidebar-setup]")!;
    expect(setup.previousElementSibling?.hasAttribute("data-chat-list")).toBe(true);
    expect(Array.from(setup.querySelectorAll("[data-chat-row]"), (row) => row.getAttribute("data-chat-row")))
      .toEqual(["start-own-chat"]);
    await click(row("b"));
    await click(row("start-own-chat"));
    await click(document.querySelector<HTMLButtonElement>("[data-own-chat-yes]")!);
    expect(host.querySelector("[data-chat-main] [data-builder-pane]")).not.toBeNull();
    expect(state.fetchTrainings).toHaveBeenCalledTimes(1);
  });

  it("closes the mobile sidebar on selection and reopens it from the workspace icon", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ ...window.matchMedia(""), matches: false });
    act(() => root.render(createElement(Surface, { onOpenProject: vi.fn(), onStartNewProject: vi.fn() })));
    await flush();
    const toggle = host.querySelector<HTMLButtonElement>("[data-chat-workspace] > button[aria-controls]")!;
    const sidebar = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(sidebar?.contains(row("b"))).toBe(true);
    await click(row("b"));
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("[data-chat-main] [data-project-pane]")?.textContent).toBe("Team update");
    await click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(sidebar?.contains(row("a"))).toBe(true);
  });
});
