import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OFFER_PROMPT,
  hasOffer,
  offerDraft,
  readOfferType,
  type OfferType,
} from "./loungeOffers";

type WinShim = {
  window?: { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
};

const TYPES: OfferType[] = ["install", "joke"];

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
    // "credit" is retired (founder 2026-07-31). A legacy bubble carrying it
    // must read as null so it renders as ordinary bot text rather than
    // resurrecting an offer whose action pair no longer exists.
    expect(readOfferType({ offer: "credit" })).toBeNull();
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

    expect(hasOffer([], "joke")).toBe(false);
  });
});

