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
  O3  It is asked again when the server says so (a community added since)
      or when my choice was given under other words than the screen's.
PROVES   O1 -> "is ● Record Take N and a grey Close, the one way out"
         O2 -> "asks at Take 2, then records Take 3 at once with the remembered choice"
         O3 -> "asks again after a community is added or when the words changed"
WHY      Founder lock 2026-10-12, sections 4 and 9; locked Ideal Text screen.
         O2, O3: founder 2026-10-31, backend N309 item 5 (sharing is asked
         once; replaces G1's ask before every Take).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchRememberedShare: vi.fn(),
  shareTake: vi.fn(async () => ({ ok: true as const, data: {} })),
}));
vi.mock("@/services/api/communities", () => api);
vi.mock("./NextTakeShareScreen", () => ({
  default: () => createElement("div", { "data-testid": "share-screen" }),
}));
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
});
