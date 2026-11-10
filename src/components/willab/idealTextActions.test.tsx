// @vitest-environment jsdom
/*
STORY    As a speaker, I want the bottom of my Ideal Text page to offer
         "Record Take N+1" and a grey Close, so that the next Take is always
         one tap away, and I want each Take to stay mine until I send it.
OUTCOME
  O1  The only buttons are "Record Take 2" and "Close", even when a review
      is waiting; Close closes the page.
  O2  "Record Take N" records at once, whatever I chose for an earlier
      Take: nothing is asked before it, nothing is sent or shared once it
      is up, and its line reads "Only me" (in the people shape with sending
      on, so the line opens "Who hears this Take" with nobody ticked; in the
      community shape with sending off). A choice kept on the phone from
      before is dropped, never applied. Nobody in my list: no line. A read
      that does not answer still records within 1.5 s.
PROVES   O1 -> "is ● Record Take N and a grey Close, the one way out"
         O2 -> "records at once with nothing sent, whatever was chosen before; its line is Only me"
WHY      Founder lock 2026-10-12, sections 4 and 9; locked Ideal Text screen.
         O2: founder 2026-11-10, backend N626 ("I don't want to send it to
         others now"; "Nothing by default"), replacing the remembered
         choice of N309 item 5, N470 and N479 item 5.
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
import { applyNextTakeShare } from "@/lib/willab/nextTakeShare";

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

const screen = () => host.querySelector('[data-testid="share-screen"]');

async function tapRecord() {
  await act(async () => {
    pill()!.click();
  });
}

describe("a Take goes to nobody unless I send it (backend N626)", () => {
  it("records at once with nothing sent, whatever was chosen before; its line is Only me", async () => {
    const ARTUR = { userId: "u-artur", name: "Artur", title: null, avatarUrl: null, chatId: "c1", lastSent: true };
    const onNewTake = vi.fn();
    const fresh = async (props: Record<string, unknown>) => {
      act(() => root.unmount());
      act(() => {
        root = createRoot(host);
      });
      await act(async () => render(props));
      await tapRecord();
    };
    // Sending on, "Everyone in my list" chosen before, and a choice still
    // kept on the phone from the old rule.
    send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [ARTUR] });
    send.fetchLastSend.mockResolvedValue({ enabled: true, choice: { all: true, userIds: [] } });
    localStorage.setItem("willab.nextTakeShare", JSON.stringify({ kind: "people", all: true, userIds: [], at: Date.now() }));
    await fresh({ takeCount: 2, onNewTake, arcId: "arc-1" });
    expect(screen()).toBeNull();
    expect(onNewTake).toHaveBeenCalledTimes(1);
    expect(appended.map((d) => d.body)).toEqual(["Only me"]);
    expect(appended[0].metadata).toMatchObject({ step: "share", arc_id: "arc-1", share: { kind: "people", all: false, user_ids: [] } });
    applyNextTakeShare("take-3");
    expect(send.sendTake).not.toHaveBeenCalled();
    expect(api.shareTake).not.toHaveBeenCalled();

    // Sending off: the same, its line in the community shape.
    send.fetchSendPeople.mockResolvedValue({ enabled: false, people: [] });
    await fresh({ takeCount: 3, onNewTake, arcId: "arc-1" });
    expect(onNewTake).toHaveBeenCalledTimes(2);
    expect(appended.at(-1)?.metadata).toMatchObject({ share: { none: true, general: false, community_ids: [] } });
    expect(api.fetchRememberedShare).not.toHaveBeenCalled();

    // Nobody in the list: nobody to send it to, so no line (R3).
    send.fetchSendPeople.mockResolvedValue({ enabled: true, people: [] });
    send.fetchLastSend.mockResolvedValue({ enabled: true, choice: null });
    const lines = appended.length;
    await fresh({ takeCount: 4, onNewTake });
    expect(onNewTake).toHaveBeenCalledTimes(3);
    expect(appended).toHaveLength(lines);

    // A read that never answers still records within 1.5 s (R1).
    vi.useFakeTimers();
    try {
      send.fetchSendPeople.mockReturnValue(new Promise(() => {}));
      await fresh({ takeCount: 5, onNewTake });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(screen()).toBeNull();
      expect(onNewTake).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
