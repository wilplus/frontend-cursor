// @vitest-environment jsdom
/*
STORY    As a speaker, I want to leave my WhatsApp number to hear when my coach's feedback is in, with wrong numbers refused, so that the message reaches me.
OUTCOME
  O1  A number without its country code is refused on screen and nothing is sent.
  O2  A valid number is saved in full international form and the offer closes.
  O3  Not now sends nothing and closes.
PROVES   O1 -> refuses a number without its country code
         O2 -> saves a valid number in E.164 and closes
         O3 -> Not now sends nothing and closes
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ saveWhatsAppPhone: vi.fn() }));
vi.mock("@/services/api/whatsapp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/whatsapp")>();
  return { ...actual, ...api };
});

import { WhatsAppOfferActions, WHATSAPP_COPY } from "./WillabWhatsAppPrompt";

let container: HTMLDivElement;
let root: Root;
const offer = { canOffer: true, phone: null, softDismiss: vi.fn(), markSaved: vi.fn() };
const onResolve = vi.fn();

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
  api.saveWhatsAppPhone.mockResolvedValue(true);
  act(() => root.render(createElement(WhatsAppOfferActions, { offer, onResolve })));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const type = (text: string) =>
  act(() => {
    const input = container.querySelector("input")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const press = (label: string) =>
  act(async () => {
    [...container.querySelectorAll("button")].find((b) => b.textContent === label)!.click();
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });

describe("WhatsApp offer", () => {
  it("refuses a number without its country code", async () => {
    type("07700 900123");
    await press(WHATSAPP_COPY.save);
    expect(container.textContent).toContain(WHATSAPP_COPY.invalid);
    expect(api.saveWhatsAppPhone).not.toHaveBeenCalled();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("saves a valid number in E.164 and closes", async () => {
    type("+44 7700 900-123");
    await press(WHATSAPP_COPY.save);
    expect(api.saveWhatsAppPhone).toHaveBeenCalledWith("+447700900123");
    expect(offer.markSaved).toHaveBeenCalledWith("+447700900123");
    expect(onResolve).toHaveBeenCalled();
  });

  it("Not now sends nothing and closes", async () => {
    await press(WHATSAPP_COPY.notNow);
    expect(api.saveWhatsAppPhone).not.toHaveBeenCalled();
    expect(offer.softDismiss).toHaveBeenCalled();
    expect(onResolve).toHaveBeenCalled();
  });
});
