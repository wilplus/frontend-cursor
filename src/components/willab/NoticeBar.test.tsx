// @vitest-environment jsdom
/*
STORY    As a speaker, I want a question or a price the founder sent me, and
         the WhatsApp ask, to come as a bar at the top of the chat, one at a
         time, never in the buttons I record with, so that it never competes
         with my next Take.
OUTCOME
  O1  The ask comes in the bar with its own words (the WhatsApp ask under
      its opener), once a visit, and is reported shown.
  O2  ✕ closes the bar.
  O3  The promo price never shows in the iPhone app (it has no buying).
PROVES   O1 -> "shows the ask in the bar once a visit"
         O2 -> "closes on Not now"
         O3 -> "never shows the promo in the iPhone app"
WHY      Founder 2026-11-03 (backend N391): "do not mix notifications ...
         with the main screen buttons. The notifications should come as
         notifications at the top as a separate bar."
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ bffFetch: vi.fn() }));
vi.mock("@/lib/api/bffFetch", () => api);
const native = vi.hoisted(() => ({ isNativeApp: vi.fn(() => false) }));
vi.mock("@/lib/auth/nativeSignIn", () => native);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import NoticeBar, { type BarAsk } from "./NoticeBar";
import type { WhatsAppOffer } from "./WillabWhatsAppPrompt";

let container: HTMLDivElement;
let root: Root;

async function mount(ask: BarAsk | null) {
  api.bffFetch.mockResolvedValue({ kind: "response", ok: true, body: { ask } });
  await act(async () => {
    root.render(createElement(NoticeBar, { signedIn: true, whatsapp: {} as WhatsAppOffer }));
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    // An ask fetches its sheet's code at once (NoticeBar's WARM): let it land.
    await vi.dynamicImportSettled();
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  api.bffFetch.mockReset();
  native.isNativeApp.mockReturnValue(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const whatsapp: BarAsk = { id: "a1", kind: "whatsapp", consent_key: null, opener: "It seems you enjoy using WillpowerLab." };

describe("NoticeBar", () => {
  it("shows the ask in the bar once a visit", async () => {
    await mount(whatsapp);
    expect(container.textContent).toContain("It seems you enjoy using WillpowerLab.");
    expect(container.textContent).toContain("Want a WhatsApp when your coach replies? Add your number.");
    expect(api.bffFetch).toHaveBeenCalledWith("/api/v2/user/asks/a1", expect.objectContaining({ json: { event: "shown" } }));
    // The same tab's next load is not a visit: the backend is not asked again.
    act(() => root.unmount());
    root = createRoot(container);
    api.bffFetch.mockClear();
    await mount(whatsapp);
    expect(api.bffFetch).not.toHaveBeenCalled();
  });

  it("closes on Not now", async () => {
    await mount({ id: "a2", kind: "consent", consent_key: "training" });
    expect(container.textContent).toContain("One question about how we use your data is still open.");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Not now"]')!.click();
    });
    expect(container.textContent).toBe("");
  });

  it("never shows the promo in the iPhone app", async () => {
    native.isNativeApp.mockReturnValue(true);
    await mount({
      id: "a3", kind: "promo", consent_key: null,
      promotion: { plan: "pro", price_cents: 900, list_cents: 1900, ends_at: "2026-12-01" } as BarAsk["promotion"],
    });
    expect(container.textContent).toBe("");
  });
});
