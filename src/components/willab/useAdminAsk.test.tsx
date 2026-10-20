// @vitest-environment jsdom
/*
STORY    As a speaker, I want a question the founder sent me from the CEO
         panel to come at the end of a Take, as that Take's one ask, and only
         once per Take, so that it never competes with recording again.
OUTCOME
  O1  It shows when a Take's message waits for it, and not before.
  O2  After a reload it is not posted again: its form opens again.
  O3  With no ask left to show, the Take's message comes at once.
PROVES   O1 -> "shows at the end of a Take whose message waits for it"
         O2 -> "is not posted again after a reload"
         O3 -> "lets the Take's message go when there is nothing to ask"
WHY      Founder 2026-10-18: the admin's ask was not shown in the chat;
         founder 2026-10-20: at the end of a Take, from Take 2, one action
         at a time (it no longer shows when the chat opens).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ bffFetch: vi.fn() }));
vi.mock("@/lib/api/bffFetch", () => api);

import { useAdminAsk, type AdminAsk } from "./useAdminAsk";
import type { OfferType } from "./loungeOffers";

let container: HTMLDivElement;
let root: Root;
const append = vi.fn();
const openOffer = vi.fn();

const letGo = vi.fn();

function Probe({ waitingId, asked }: { waitingId: string | null; asked: OfferType | null }) {
  useAdminAsk({ threadLoading: false, append, installCanOffer: true, openOffer, waitingId, asked, letGo });
  return null;
}

async function mount(ask: AdminAsk | null, waitingId: string | null, asked: OfferType | null = null) {
  api.bffFetch.mockResolvedValue({ kind: "response", ok: true, body: { ask } });
  await act(async () => {
    root.render(createElement(Probe, { waitingId, asked }));
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
  it("shows at the end of a Take whose message waits for it", async () => {
    await mount(whatsapp, null);
    expect(api.bffFetch).not.toHaveBeenCalled(); // opening the chat asks nothing
    await mount(whatsapp, "summary-take-2");
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ offer: "whatsapp", after_take: "summary-take-2" }) }),
    );
    expect(openOffer).toHaveBeenCalledWith("whatsapp");
  });

  it("is not posted again after a reload", async () => {
    await mount({ ...whatsapp, status: "shown" }, "summary-take-2", "whatsapp");
    expect(append).not.toHaveBeenCalled();
    expect(openOffer).toHaveBeenCalledWith("whatsapp");
  });

  it("lets the Take's message go when there is nothing to ask", async () => {
    await mount(null, "summary-take-2");
    expect(append).not.toHaveBeenCalled();
    expect(letGo).toHaveBeenCalledTimes(1);
  });
});
