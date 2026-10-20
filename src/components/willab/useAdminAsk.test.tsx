// @vitest-environment jsdom
/*
STORY    As a speaker, I want a question the admin sent me to appear the next
         time I open the chat, never while I record, and only once, so that
         it never interrupts a Take.
OUTCOME
  O1  It shows when I open the chat, with no Take needed.
  O2  Nothing shows while I am recording.
  O3  It is not posted again once it is in my chat.
PROVES   O1 -> "shows the next time they open the chat, with no Take"
         O2 -> "waits while they are recording"
         O3 -> "is not posted again once its bubble is in the thread"
WHY      Founder 2026-10-18: the admin's ask was not shown in the chat.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ bffFetch: vi.fn() }));
vi.mock("@/lib/api/bffFetch", () => api);

import { useAdminAsk, type AdminAsk } from "./useAdminAsk";

let container: HTMLDivElement;
let root: Root;
const append = vi.fn();
const openOffer = vi.fn();

function Probe({ state }: { state: string }) {
  useAdminAsk({
    state,
    threadLoading: false,
    append,
    installCanOffer: true,
    activeOffer: null,
    openOffer,
  });
  return null;
}

async function mount(ask: AdminAsk, state: string) {
  api.bffFetch.mockResolvedValue({ kind: "response", ok: true, body: { ask } });
  await act(async () => {
    root.render(createElement(Probe, { state }));
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
  append.mockResolvedValue({});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const whatsapp: AdminAsk = { id: "a1", kind: "whatsapp", consent_key: null, status: "waiting" };

describe("an admin ask", () => {
  it("shows the next time they open the chat, with no Take", async () => {
    await mount(whatsapp, "lounge_idle");
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ offer: "whatsapp" }) }));
    expect(openOffer).toHaveBeenCalledWith("whatsapp");
  });

  it("waits while they are recording", async () => {
    await mount(whatsapp, "lab_recording");
    expect(append).not.toHaveBeenCalled();
    expect(openOffer).not.toHaveBeenCalled();
  });

  it("is not posted again once its bubble is in the thread", async () => {
    await mount({ ...whatsapp, status: "shown" }, "lounge_idle");
    expect(append).not.toHaveBeenCalled();
  });
});
