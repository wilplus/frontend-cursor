// @vitest-environment jsdom
/*
STORY    As a speaker before my next Take, with sending on, I want the
         people in my chats listed with everyone ticked, the one I sent to
         last on top, so that one Continue sends my Take to them, and I want
         the line under it to let me add people later but never unsend.
         With sending off, I want nothing ticked for me and
         Continue to wait until I choose, with "Only me" counting as a
         choice, so that any sharing is my own decision; and I want the line
         under my latest Take's recording to open the same screen with my
         choice ticked, so that I can change who hears that Take and the
         ones after it.
OUTCOME
  O3  With sending on: the three bubbles, Select all and one row per
      person, all ticked, "Last sent" under the one sent to last; Select
      all unticked unticks everyone and Continue waits; with one person
      ticked, Continue writes the line naming them and keeps them for the
      next upload, which is sent to them once, after it is up (N470, N479).
  O4  With sending on, the line of a Take sent to people opens the screen
      with them ticked and fixed; adding someone sends the Take to everyone
      ticked and the line names them all; nothing is unsent (N479 item 3).
  O1  With sending off (the backend's switch, or its read fails), today's
      screen: nothing starts ticked, Continue is off, and choosing "Only me" turns
      it on.
  O2  The line under my latest Take opens the screen with my choice ticked
      (and not my recording's feedback); Continue shares that Take as I
      now chose, stamped with the words I saw, and its line says the new
      choice; "Only me" takes it back from every community.
PROVES   O3 -> "with sending on, everyone is ticked, Select all unticks all, and the one ticked gets the next Take once"
         O4 -> "with sending on, a sent Take's line opens the screen to add people, never to unsend"
         O1 -> "starts with nothing ticked; Continue waits for a choice, Only me counts"
         O2 -> "the latest Take's line opens the screen ticked as it stands, and a change re-stamps that Take"
WHY      O3, O4: founder 2026-11-04, backend N470 (#1702) and N479
         (#1704), the prototype "Specialist Side" tab 1. O1, O2 (sending
         off): founder 2026-10-15 (Privacy 3.6 section 4d). O2: founder
         2026-10-31, backend N309 item 5; G4 (each Take stamped and
         revocable).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const INVITA = "11111111-1111-4111-8111-111111111111";
const ATLAS = "22222222-2222-4222-8222-222222222222";
const api = vi.hoisted(() => ({
  fetchCommunities: vi.fn(async () => ({ ok: true, data: [] as unknown[] })),
  shareTake: vi.fn(async () => ({ ok: true as const, data: {} })),
}));
vi.mock("@/services/api/communities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCommunities: api.fetchCommunities,
  shareTake: api.shareTake,
}));
// The backend's switch for sending (N470): off unless a test turns it on.
const send = vi.hoisted(() => ({
  fetchSendPeople: vi.fn(async (): Promise<unknown> => ({ enabled: false, people: [] })),
  fetchLastSend: vi.fn(async (): Promise<unknown> => ({ enabled: false, choice: null })),
  sendTake: vi.fn(async (): Promise<unknown> => [{ userId: "u", chatId: "c", messageId: "m" }]),
}));
vi.mock("@/services/api/takeSends", () => send);
const appended = vi.hoisted(() => [] as Array<{ body: string; metadata?: Record<string, unknown> | null }>);
vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadMaybe: () => ({ append: async (draft: (typeof appended)[number]) => appended.push(draft) }),
}));

import NextTakeShareScreen from "./NextTakeShareScreen";
import ReportCard from "./ReportCard";
import { applyNextTakeShare, NEXT_SHARE_WORDS_VERSION } from "@/lib/willab/nextTakeShare";
import { latestShareLine } from "@/lib/willab/walkThread";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.shareTake.mockClear();
  send.sendTake.mockClear();
  send.fetchSendPeople.mockResolvedValue({ enabled: false, people: [] });
  send.fetchLastSend.mockResolvedValue({ enabled: false, choice: null });
  localStorage.clear();
  appended.length = 0;
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const button = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const option = (text: string) =>
  [...document.querySelectorAll('[role="checkbox"]')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const ticked = (text: string) => option(text)?.getAttribute("aria-checked");

it("starts with nothing ticked; Continue waits for a choice, Only me counts", async () => {
  await act(async () => {
    root.render(createElement(NextTakeShareScreen, { takeCount: 1, onDone: () => {}, onClose: () => {} }));
  });
  const cont = host.querySelector('[data-testid="share-continue"]') as HTMLButtonElement;
  expect(cont.disabled).toBe(true);
  expect(host.querySelectorAll('[aria-checked="true"]').length).toBe(0);
  const onlyMe = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Only me"));
  await act(async () => onlyMe?.click());
  expect((host.querySelector('[data-testid="share-continue"]') as HTMLButtonElement).disabled).toBe(false);
});

it("the latest Take's line opens the screen ticked as it stands, and a change re-stamps that Take", async () => {
  api.fetchCommunities.mockResolvedValue({
    ok: true,
    data: [
      { id: INVITA, kind: "private", name: "Invita", role: "member" },
      { id: ATLAS, kind: "private", name: "Atlas", role: "member" },
    ],
  });
  const onOpenFeedback = vi.fn();
  const recording = {
    client_id: "rec3", role: "user" as const, kind: "recording_summary" as const, body: "",
    metadata: { session_id: "take-3", arc_id: "arc-1", take_index: 3 },
    client_created_at: "2026-11-02T10:00:00Z",
  };
  await act(async () => {
    root.render(
      createElement(ReportCard, {
        message: recording,
        onOpenFeedback,
        shareLine: "Only my community (Invita)",
        shareChange: {
          recording: "rec3", takeSessionId: "take-3", arcId: "arc-1", takeIndex: 3,
          ticks: ["mine"], communityIds: [INVITA],
        },
      }),
    );
  });
  await act(async () => button("Only my community (Invita)").click());
  expect(onOpenFeedback).not.toHaveBeenCalled();
  // Ticked as it stands: my community, Invita only.
  expect(ticked("Only my community")).toBe("true");
  expect(ticked("Invita")).toBe("true");
  expect(ticked("Atlas")).toBe("false");
  expect(ticked("General community")).toBe("false");

  await act(async () => option("General community").click());
  await act(async () => (document.querySelector('[data-testid="share-continue"]') as HTMLButtonElement).click());
  expect(api.shareTake).toHaveBeenCalledWith("take-3", {
    general: true,
    communityIds: [INVITA],
    none: false,
    shareWordsVersion: NEXT_SHARE_WORDS_VERSION,
  });
  expect(appended.map((d) => d.body)).toEqual(["Only my community (Invita), General community"]);
  expect(appended[0].metadata).toMatchObject({ step: "share", take_session_id: "take-3", share: { general: true } });
  expect(document.querySelector('[data-testid="share-continue"]')).toBeNull();

  // "Only me" from the line takes the Take back from every community (G4).
  await act(async () => button("Only my community (Invita)").click());
  await act(async () => option("Only me").click());
  await act(async () => (document.querySelector('[data-testid="share-continue"]') as HTMLButtonElement).click());
  expect(api.shareTake).toHaveBeenLastCalledWith("take-3", { general: false, communityIds: [], none: true });
  expect(appended.at(-1)?.body).toBe("Only me");
});

const ARTUR = { userId: "u-artur", name: "Artur", title: "Speaking coach", avatarUrl: null, chatId: "c-artur", lastSent: true };
const MAYA = { userId: "u-maya", name: "Maya Lindqvist", title: "Head of Sales", avatarUrl: null, chatId: "c-maya", lastSent: false };
const DANIEL = { userId: "u-daniel", name: "Daniel Okafor", title: "Speaking coach", avatarUrl: null, chatId: "c-daniel", lastSent: false };
const continueOn = () => !(document.querySelector('[data-testid="share-continue"]') as HTMLButtonElement).disabled;

it("with sending on, everyone is ticked, Select all unticks all, and the one ticked gets the next Take once", async () => {
  const onDone = vi.fn();
  await act(async () => {
    root.render(
      createElement(NextTakeShareScreen, {
        takeCount: 1,
        arcId: "arc-1",
        send: { enabled: true, people: [ARTUR, MAYA, DANIEL], choice: null },
        onDone,
        onClose: () => {},
      }),
    );
  });
  expect(host.textContent).toContain("Your knowledge is worth sharing, and so are your questions.");
  expect(host.textContent).toContain("Choose who can answer you best, or send it to all of them and practise speaking.");
  expect(host.textContent).not.toContain("General community");
  expect(host.textContent).not.toContain("Only me");
  expect(ticked("Select all")).toBe("true");
  expect([ticked("Artur"), ticked("Maya Lindqvist"), ticked("Daniel Okafor")]).toEqual(["true", "true", "true"]);
  expect(option("Artur").textContent).toContain("Last sent");
  expect(option("Maya Lindqvist").textContent).not.toContain("Last sent");
  expect(continueOn()).toBe(true);

  await act(async () => option("Select all").click());
  expect(host.querySelectorAll('[aria-checked="true"]').length).toBe(0);
  expect(continueOn()).toBe(false);

  await act(async () => option("Artur").click());
  expect(ticked("Select all")).toBe("false");
  await act(async () => (host.querySelector('[data-testid="share-continue"]') as HTMLButtonElement).click());
  expect(onDone).toHaveBeenCalledTimes(1);
  // Nothing is sent before the Take exists (R2).
  expect(send.sendTake).not.toHaveBeenCalled();
  expect(appended.at(-1)?.body).toBe("Artur");
  expect(appended.at(-1)?.metadata).toMatchObject({ step: "share", share: { kind: "people", all: false, user_ids: ["u-artur"], names: ["Artur"] } });

  applyNextTakeShare("take-2");
  applyNextTakeShare("take-3");
  expect(send.sendTake).toHaveBeenCalledTimes(1);
  expect(send.sendTake).toHaveBeenCalledWith("take-2", { all: false, userIds: ["u-artur"] });
});

it("with sending on, a sent Take's line opens the screen to add people, never to unsend", async () => {
  send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [ARTUR, MAYA, DANIEL] });
  send.fetchLastSend.mockResolvedValue({ enabled: true, choice: { all: false, userIds: ["u-artur"] } });
  const rec = {
    client_id: "rec3", role: "user" as const, kind: "recording_summary" as const, body: "",
    metadata: { session_id: "take-3", arc_id: "arc-1", take_index: 3 }, client_created_at: "2026-11-04T10:00:00Z",
  };
  const line = {
    client_id: "l3", role: "user" as const, kind: "walk_step" as const, body: "Artur",
    metadata: { step: "share", author: "speaker", arc_id: "arc-1", share: { kind: "people", all: false, user_ids: ["u-artur"], names: ["Artur"] } },
    client_created_at: "2026-11-04T09:59:00Z",
  };
  const change = latestShareLine([line, rec]);
  expect(change).toMatchObject({ takeSessionId: "take-3", people: { user_ids: ["u-artur"] } });
  await act(async () => {
    root.render(createElement(ReportCard, { message: rec, shareLine: "Artur", shareChange: change }));
  });
  await act(async () => button("Artur").click());
  expect(ticked("Artur")).toBe("true");
  expect(ticked("Maya Lindqvist")).toBe("false");
  // Who it went to stays ticked: nothing is unsent.
  await act(async () => option("Artur").click());
  expect(ticked("Artur")).toBe("true");

  await act(async () => option("Maya Lindqvist").click());
  await act(async () => (document.querySelector('[data-testid="share-continue"]') as HTMLButtonElement).click());
  expect(send.sendTake).toHaveBeenCalledWith("take-3", { all: false, userIds: ["u-artur", "u-maya"] });
  expect(appended.at(-1)?.body).toBe("Artur, Maya Lindqvist");
  expect(appended.at(-1)?.metadata).toMatchObject({ take_session_id: "take-3", share: { kind: "people", user_ids: ["u-artur", "u-maya"] } });
  expect(document.querySelector('[data-testid="share-continue"]')).toBeNull();
});
