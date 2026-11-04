// @vitest-environment jsdom
/*
STORY    As a speaker, I want the bottom of my Ideal Text page to offer
         "Record Take N+1" and a grey Close, so that the next Take is always
         one tap away.
OUTCOME
  O1  The only buttons are "Record Take 2" and "Close", even when a review
      is waiting; Close closes the page.
  O2  Sharing is asked once: "Record Take 2" with no choice yet opens the
      sharing screen; once I have chosen, "Record Take 3" starts the
      recording at once, my choice kept for that Take (shared with the
      words I saw) and stored as the line under its recording.
  O3  With sending off, it is asked again when the server says so (a
      community added since) or when my choice was given under other words
      than the screen's.
  O4  With sending on (N470, N472): "Record Take 3" records at once to the
      people I chose, the line naming them and the upload sent to them; a
      person who joined since my chosen people asks once, while "Everyone
      in my list" takes them in; nobody in my list records with nothing
      sent; a read that does not answer asks within 1.5 s, never holding
      the recording longer.
PROVES   O1 -> "is ● Record Take N and a grey Close, the one way out"
         O2 -> "asks at Take 2, then records Take 3 at once with the remembered choice"
         O3 -> "asks again after a community is added or when the words changed"
         O4 -> "with sending on, Take 3 goes at once to the people chosen; someone new asks once; nobody records anyway; a slow read asks"
WHY      Founder lock 2026-10-12, sections 4 and 9; locked Ideal Text screen.
         O2, O3: founder 2026-10-31, backend N309 item 5 (sharing is asked
         once; replaces G1's ask before every Take). O4: founder
         2026-11-04, backend N470 (#1702), N472 (#1704) items 5 and 7, R1, R3.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchRememberedShare: vi.fn(),
  shareTake: vi.fn(async () => ({ ok: true as const, data: {} })),
}));
vi.mock("@/services/api/communities", () => api);
const shown = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("./NextTakeShareScreen", () => ({
  default: (props: Record<string, unknown>) => {
    shown.push(props);
    return createElement("div", { "data-testid": "share-screen" });
  },
}));
// The backend's switch for sending (N470): off unless a test turns it on.
const send = vi.hoisted(() => ({
  fetchSendPeople: vi.fn(async (): Promise<unknown> => ({ enabled: false, people: [] })),
  fetchLastSend: vi.fn(async (): Promise<unknown> => ({ enabled: false, choice: null })),
  sendTake: vi.fn(async (): Promise<unknown> => []),
}));
vi.mock("@/services/api/takeSends", () => send);
const appended = vi.hoisted(() => [] as Array<{ body: string; metadata?: Record<string, unknown> | null }>);
vi.mock("./LoungeThreadContext", () => ({
  useLoungeThreadMaybe: () => ({ append: async (draft: (typeof appended)[number]) => appended.push(draft) }),
}));

import IdealTextActions from "./IdealTextActions";
import { applyNextTakeShare, NEXT_SHARE_WORDS_VERSION } from "@/lib/willab/nextTakeShare";

let root: Root;
let host: HTMLDivElement;

const BASE = { onNewTake: () => undefined };

function render(props: Record<string, unknown>) {
  act(() => {
    root.render(createElement(IdealTextActions, { ...BASE, ...props } as never));
  });
}

const buttons = () => [...host.querySelectorAll("button")];
const labels = () => buttons().map((b) => b.textContent?.trim());
const pill = () => host.querySelector("[data-walk-pill]") as HTMLButtonElement | null;
const link = () => host.querySelector("[data-walk-link]") as HTMLButtonElement | null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  api.fetchRememberedShare.mockReset().mockResolvedValue({ ok: true, data: { ask: true, choice: null } });
  api.shareTake.mockClear();
  send.fetchSendPeople.mockReset().mockResolvedValue({ enabled: false, people: [] });
  send.fetchLastSend.mockReset().mockResolvedValue({ enabled: false, choice: null });
  send.sendTake.mockClear();
  shown.length = 0;
  appended.length = 0;
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the next step (founder lock 2026-10-12, sections 4 and 9)", () => {
  it("is ● Record Take N and a grey Close, the one way out", () => {
    const onClose = vi.fn();
    render({ takeCount: 1, reviewWaiting: true, onReview: vi.fn(), onClose });
    expect(labels()).toEqual(["Record Take 2", "Close"]);
    expect(pill()!.textContent).toContain("Record Take 2");
    act(() => link()!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

const INVITA = "11111111-1111-4111-8111-111111111111";
const remembered = (over: Record<string, unknown> = {}) => ({
  ok: true,
  data: {
    ask: false,
    choice: {
      general: false,
      communityIds: [INVITA],
      none: false,
      wordsVersion: NEXT_SHARE_WORDS_VERSION,
      communities: [{ id: INVITA, name: "Invita" }],
      ...over,
    },
  },
});
const screen = () => host.querySelector('[data-testid="share-screen"]');

async function tapRecord() {
  await act(async () => {
    pill()!.click();
  });
}

describe("sharing is asked once (backend N309 item 5)", () => {
  it("asks at Take 2, then records Take 3 at once with the remembered choice", async () => {
    const onNewTake = vi.fn();
    await act(async () => render({ takeCount: 1, onNewTake }));
    await tapRecord();
    expect(screen()).not.toBeNull();
    expect(onNewTake).not.toHaveBeenCalled();

    act(() => root.unmount());
    act(() => {
      root = createRoot(host);
    });
    api.fetchRememberedShare.mockResolvedValue(remembered());
    await act(async () => render({ takeCount: 2, onNewTake, arcId: "arc-1" }));
    await tapRecord();
    expect(screen()).toBeNull();
    expect(onNewTake).toHaveBeenCalledTimes(1);
    // The line under Take 3's recording, carrying the choice it keeps.
    expect(appended.map((d) => d.body)).toEqual(["Only my community (Invita)"]);
    expect(appended[0].metadata).toMatchObject({ step: "share", arc_id: "arc-1", share: { community_ids: [INVITA] } });
    // Take 3's upload is shared as remembered, stamped with the words seen.
    applyNextTakeShare("take-3");
    expect(api.shareTake).toHaveBeenCalledWith("take-3", {
      general: false,
      communityIds: [INVITA],
      none: false,
      shareWordsVersion: NEXT_SHARE_WORDS_VERSION,
    });
  });

  it("asks again after a community is added or when the words changed", async () => {
    const onNewTake = vi.fn();
    // The server says ask: a community was added since the choice.
    api.fetchRememberedShare.mockResolvedValue({ ok: true, data: { ...remembered().data, ask: true } });
    await act(async () => render({ takeCount: 2, onNewTake }));
    await tapRecord();
    expect(screen()).not.toBeNull();

    act(() => root.unmount());
    act(() => {
      root = createRoot(host);
    });
    // Other words than the screen's.
    api.fetchRememberedShare.mockResolvedValue(remembered({ wordsVersion: "sharing-screen-2026-10-06" }));
    await act(async () => render({ takeCount: 3, onNewTake }));
    await tapRecord();
    expect(screen()).not.toBeNull();
    expect(onNewTake).not.toHaveBeenCalled();
    expect(appended).toEqual([]);
  });

  it("with sending on, Take 3 goes at once to the people chosen; someone new asks once; nobody records anyway; a slow read asks", async () => {
    const ARTUR = { userId: "u-artur", name: "Artur", title: null, avatarUrl: null, chatId: "c1", lastSent: true };
    const MAYA = { userId: "u-maya", name: "Maya Lindqvist", title: null, avatarUrl: null, chatId: "c2", lastSent: false };
    const SOFIA = { userId: "u-sofia", name: "Sofia Marin", title: null, avatarUrl: null, chatId: "c3", lastSent: false };
    const onNewTake = vi.fn();
    const fresh = async (props: Record<string, unknown>) => {
      act(() => root.unmount());
      act(() => {
        root = createRoot(host);
      });
      await act(async () => render(props));
      await tapRecord();
    };
    send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [ARTUR, MAYA] });
    send.fetchLastSend.mockResolvedValue({ enabled: true, choice: { all: false, userIds: ["u-artur", "u-maya"] } });
    await fresh({ takeCount: 2, onNewTake, arcId: "arc-1" });
    expect(screen()).toBeNull();
    expect(onNewTake).toHaveBeenCalledTimes(1);
    expect(appended.map((d) => d.body)).toEqual(["Artur, Maya Lindqvist"]);
    expect(api.fetchRememberedShare).not.toHaveBeenCalled();
    applyNextTakeShare("take-3");
    expect(send.sendTake).toHaveBeenCalledWith("take-3", { all: false, userIds: ["u-artur", "u-maya"] });
    expect(api.shareTake).not.toHaveBeenCalled();

    // Sofia joined since: chosen people ask once, with what was read.
    send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [ARTUR, MAYA, SOFIA] });
    await fresh({ takeCount: 3, onNewTake });
    expect(screen()).not.toBeNull();
    expect(shown.at(-1)?.send).toMatchObject({ enabled: true, people: [ARTUR, MAYA, SOFIA] });
    // "Everyone in my list" takes her in without asking.
    send.fetchLastSend.mockResolvedValue({ enabled: true, choice: { all: true, userIds: [] } });
    await fresh({ takeCount: 3, onNewTake });
    expect(screen()).toBeNull();
    expect(appended.at(-1)?.body).toBe("Everyone in my list");

    // Nobody in the list: the Take records, nothing kept to send (R3).
    send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [] });
    await fresh({ takeCount: 4, onNewTake });
    expect(screen()).toBeNull();
    expect(onNewTake).toHaveBeenCalledTimes(3);
    send.sendTake.mockClear();
    applyNextTakeShare("take-5");
    expect(send.sendTake).not.toHaveBeenCalled();

    // A read that never answers asks after 1.5 s, never holding the tap (R1).
    vi.useFakeTimers();
    try {
      send.fetchSendPeople.mockReturnValue(new Promise(() => {}));
      await fresh({ takeCount: 5, onNewTake });
      expect(screen()).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(screen()).not.toBeNull();
      expect(onNewTake).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
