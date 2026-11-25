// @vitest-environment jsdom
/*
STORY    As a speaker, I want my own chats in one flat list, each the same
         kind of chat, so that I decide what a chat is by how I use it
         (backend N700).
OUTCOME
  O1  The list is flat: the speaking chat, a project's chat and a plain chat
      are rows side by side, with no project list nested under the coach.
  O2  Opening a plain chat opens the coach's pane on that chat; opening a
      project's chat opens its project.
  O3  "New chat" makes a chat and opens it.
  O4  In an open chat, the thread shows that chat's messages, and a message
      typed there names it.
  O5  A tap on the open chat's name (its header) renames it in its row.
PROVES   O1, O2 -> "draws one flat list and opens each chat as what it is"
         O3 -> "makes a new chat and opens it"
         O4 -> "an open chat shows its own messages and names what is typed in it"
         O5 -> "a tap on the open chat's name renames it"
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TrainingArc } from "@/services/api/trainings";

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), rename: vi.fn(), trainings: vi.fn() }));
vi.mock("@/services/api/ownChats", () => ({
  listOwnChats: api.list, createOwnChat: api.create, renameOwnChat: api.rename, giveOwnChatProject: vi.fn(),
}));
vi.mock("@/services/api/bootPrefetch", () => ({ takeTrainings: api.trainings }));
vi.mock("../pdfSlides", () => ({ PdfPage: () => null }));

import ProductHome from "./ProductHome";
import { askRenameOpenOwnChat, openOwnChatNow, setOpenOwnChat, shownIn, typedHint } from "./loungePlace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pitch = { arcId: "arc-1", topic: "Pitch", takes: [], archived: false, deletion: null } as unknown as TrainingArc;
const chats = [
  { id: "c-coach", title: "Speaking coach", arcId: null, section: "speaking", lastUsedAt: null },
  { id: "c-pitch", title: "Pitch", arcId: "arc-1", section: null, lastUsedAt: null },
  { id: "c-ideas", title: "Ideas", arcId: null, section: null, lastUsedAt: null },
];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  api.list.mockReset().mockResolvedValue(chats);
  api.trainings.mockReset().mockResolvedValue([pitch]);
  api.create.mockReset();
  setOpenOwnChat(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const draw = async (props: Partial<Parameters<typeof ProductHome>[0]> = {}) => {
  await act(async () => {
    root.render(<ProductHome onOpenSpeaking={vi.fn()} onOpenProject={vi.fn()} onStartNewProject={vi.fn()} {...props} />);
  });
};
const row = (name: string) => [...host.querySelectorAll<HTMLElement>("[data-own-chats] button")]
  .find((button) => button.textContent?.trim().endsWith(name))!;

it("draws one flat list and opens each chat as what it is", async () => {
  const onOpenSpeaking = vi.fn();
  const onOpenProject = vi.fn();
  await draw({ onOpenSpeaking, onOpenProject });
  expect(host.querySelector("[data-product-projects]")).toBeNull();
  for (const name of ["Speaking coach", "Pitch", "Ideas"]) expect(row(name), name).toBeTruthy();
  await act(async () => row("Ideas").click());
  expect(openOwnChatNow()).toBe("c-ideas");
  expect(onOpenSpeaking).toHaveBeenCalled();
  await act(async () => row("Pitch").click());
  expect(openOwnChatNow()).toBe("c-pitch");
  expect(onOpenProject).toHaveBeenCalledWith(pitch);
});

it("makes a new chat and opens it", async () => {
  api.create.mockResolvedValue({ id: "c-new", title: "New chat", arcId: null, section: null, lastUsedAt: null });
  const onOpenSpeaking = vi.fn();
  await draw({ onOpenSpeaking });
  await act(async () => (host.querySelector("[data-new-chat]") as HTMLButtonElement).click());
  expect(api.create).toHaveBeenCalled();
  expect(openOwnChatNow()).toBe("c-new");
  expect(onOpenSpeaking).toHaveBeenCalled();
});

it("an open chat shows its own messages and names what is typed in it", () => {
  setOpenOwnChat("c-ideas");
  const mine = { metadata: {}, own_chat_id: "c-ideas" };
  const other = { metadata: {}, own_chat_id: "c-coach" };
  const typedHere = { metadata: { chat_id: "c-ideas" } };
  expect(shownIn(mine, "speaking")).toBe(true);
  expect(shownIn(other, "speaking")).toBe(false);
  expect(shownIn(typedHere, "speaking")).toBe(true);
  expect(typedHint("speaking", null)).toMatchObject({ chat_id: "c-ideas" });
  expect(typedHint(null, null)).toEqual({ chat_id: "c-ideas" });
});

it("a tap on the open chat's name renames it", async () => {
  await draw();
  await act(async () => row("Ideas").click());
  await act(async () => askRenameOpenOwnChat());
  const field = host.querySelector<HTMLInputElement>("[data-own-chats] input");
  expect(field?.value).toBe("Ideas");
});
