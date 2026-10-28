// @vitest-environment jsdom
/*
STORY    As a speaker, I want to leave my WhatsApp number to hear when my coach's feedback is in, checked once with a code, so that the message reaches me and the number signs me in too.
OUTCOME
  O1  A number too short for its country sends no code.
  O2  A full number gets a code on WhatsApp; a wrong code says so; the right
      one saves it and the offer closes (backend N230).
  O3  Not now sends nothing and closes.
  O4  A number I typed in the chat without its country code is in the form,
      to fix, not to type again (founder 2026-10-20).
PROVES   O1 -> sends no code for a number too short
         O2 -> checks the number with a code, then saves it and closes
         O3 -> Not now sends nothing and closes
         O4 -> opens with the number typed in the chat
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ sendNumberCode: vi.fn(), confirmNumberCode: vi.fn() }));
vi.mock("@/services/api/whatsappNumber", () => api);
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {} }) }));

import { WhatsAppOfferActions, WHATSAPP_COPY } from "./WillabWhatsAppPrompt";
import { WHATSAPP_AUTH_COPY } from "@/components/auth/WhatsAppAuth";

let container: HTMLDivElement;
let root: Root;
const offer = {
  canOffer: true, phone: null, softDismiss: vi.fn(), markSaved: vi.fn(), refresh: vi.fn(),
  draft: null as string | null, setDraft: vi.fn(),
};
const onResolve = vi.fn();

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
  api.sendNumberCode.mockResolvedValue("sent");
  act(() => root.render(createElement(WhatsAppOfferActions, { offer, onResolve })));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const type = (text: string, selector = "input") =>
  act(() => {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const press = (label: string) =>
  act(async () => {
    [...container.querySelectorAll("button")].find((b) => b.textContent === label)!.click();
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });

describe("WhatsApp offer", () => {
  it("sends no code for a number too short", async () => {
    type("600 100");
    await press(WHATSAPP_COPY.save);
    expect(api.sendNumberCode).not.toHaveBeenCalled();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("checks the number with a code, then saves it and closes", async () => {
    type("+44 7700 900-123");
    await press(WHATSAPP_COPY.save);
    expect(api.sendNumberCode).toHaveBeenCalledWith("+447700900123");
    expect(container.textContent).toContain(WHATSAPP_AUTH_COPY.codeTitle);

    api.confirmNumberCode.mockResolvedValueOnce(false);
    type("111111", "#whatsapp-offer-code");
    await press(WHATSAPP_AUTH_COPY.continue);
    expect(container.textContent).toContain(WHATSAPP_AUTH_COPY.wrongCode);
    expect(offer.markSaved).not.toHaveBeenCalled();

    api.confirmNumberCode.mockResolvedValueOnce(true);
    type("482916", "#whatsapp-offer-code");
    await press(WHATSAPP_AUTH_COPY.continue);
    expect(api.confirmNumberCode).toHaveBeenLastCalledWith("+447700900123", "482916");
    expect(offer.markSaved).toHaveBeenCalledWith("+447700900123");
    expect(onResolve).toHaveBeenCalled();
  });

  it("opens with the number typed in the chat", async () => {
    // The Lounge keys the form by the draft, so it opens again with it.
    act(() => root.render(createElement(WhatsAppOfferActions, { key: "draft", offer: { ...offer, draft: "07700 900461" }, onResolve })));
    expect(container.querySelector("input")!.value).toContain("770 090 0461");
  });

  it("Not now sends nothing and closes", async () => {
    await press(WHATSAPP_COPY.notNow);
    expect(api.sendNumberCode).not.toHaveBeenCalled();
    expect(offer.softDismiss).toHaveBeenCalled();
    expect(onResolve).toHaveBeenCalled();
  });
});
