// @vitest-environment jsdom
/*
STORY    As a speaker before my next Take, I want nothing ticked for me and
         Continue to wait until I choose, with "Only me" counting as a
         choice, so that any sharing is my own decision; and I want the line
         under my latest Take's recording to open the same screen with my
         choice ticked, so that I can change who hears that Take and the
         ones after it.
OUTCOME
  O1  Nothing starts ticked, Continue is off, and choosing "Only me" turns
      it on.
  O2  The line under my latest Take opens the screen with my choice ticked
      (and not my recording's feedback); Continue shares that Take as I
      now chose, stamped with the words I saw, and its line says the new
      choice; "Only me" takes it back from every community.
PROVES   O1 -> "starts with nothing ticked; Continue waits for a choice, Only me counts"
         O2 -> "the latest Take's line opens the screen ticked as it stands, and a change re-stamps that Take"
WHY      Founder 2026-10-15 (Privacy 3.6 section 4d). O2: founder
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
const appended = vi.hoisted(() => [] as Array<{ body: string; metadata?: Record<string, unknown> | null }>);
vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadMaybe: () => ({ append: async (draft: (typeof appended)[number]) => appended.push(draft) }),
}));

import NextTakeShareScreen from "./NextTakeShareScreen";
import ReportCard from "./ReportCard";
import { NEXT_SHARE_WORDS_VERSION } from "@/lib/willab/nextTakeShare";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.shareTake.mockClear();
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
