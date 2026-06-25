import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OFFER_PROMPT,
  hasOffer,
  offerDraft,
  readCreditOfferLive,
  readOfferType,
  writeCreditOfferLive,
  type OfferType,
} from "./loungeOffers";

type WinShim = {
  window?: { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
};

const TYPES: OfferType[] = ["install", "joke", "credit"];

describe("offerDraft", () => {
  it("builds a persisted text bubble with the offer discriminator", () => {
    for (const type of TYPES) {
      const d = offerDraft(type);
      expect(d.kind).toBe("text");
      expect(d.role).toBe("bot");
      expect(d.body).toBe(OFFER_PROMPT[type]);
      expect(d.metadata).toEqual({ offer: type });
    }
  });

  it("uses no em-dashes in any prompt (house style)", () => {
    for (const type of TYPES) {
      expect(OFFER_PROMPT[type]).not.toContain("—");
    }
  });
});

describe("readOfferType", () => {
  it("reads a valid offer type back", () => {
    expect(readOfferType({ offer: "install" })).toBe("install");
    expect(readOfferType({ offer: "joke" })).toBe("joke");
    expect(readOfferType({ offer: "credit" })).toBe("credit");
  });

  it("returns null for ordinary / malformed metadata", () => {
    expect(readOfferType(null)).toBeNull();
    expect(readOfferType(undefined)).toBeNull();
    expect(readOfferType({})).toBeNull();
    expect(readOfferType({ offer: "nope" })).toBeNull();
    expect(readOfferType({ offer: 7 })).toBeNull();
    expect(readOfferType({ report_type: "readout" })).toBeNull();
  });
});

describe("hasOffer", () => {
  it("detects an existing offer of a type, ignoring others", () => {
    const messages = [
      { metadata: { offer: "joke" } },
      { metadata: { report_type: "readout" } },
      { metadata: null },
    ];
    expect(hasOffer(messages, "joke")).toBe(true);
    expect(hasOffer(messages, "install")).toBe(false);
    expect(hasOffer(messages, "credit")).toBe(false);
    expect(hasOffer([], "joke")).toBe(false);
  });
});

describe("credit-offer-live marker", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as unknown as WinShim).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    };
  });
  afterEach(() => {
    delete (globalThis as unknown as WinShim).window;
  });

  it("round-trips: false → set → true → clear → false (dedups across reload)", () => {
    expect(readCreditOfferLive()).toBe(false);
    writeCreditOfferLive(true);
    expect(readCreditOfferLive()).toBe(true);
    writeCreditOfferLive(false);
    expect(readCreditOfferLive()).toBe(false);
  });
});
