/*
STORY    As a visitor, I want the interface to start in Polish in Poland and
         English elsewhere, while my explicit EN/PL choice remains in control.
OUTCOME
  O1  PL edge country defaults to Polish; every other or missing country defaults to English.
  O2  A persisted EN or PL UI choice wins over the country default.
  O3  Incomplete Polish copy falls back to the approved English source.
  O4  Founder-approved project/setup UI is served in Polish.
PROVES O1/O2 -> request locale resolution; O3 -> safe translation fallback;
       O4 -> approved copy and interpolation
*/
import { describe, expect, it } from "vitest";
import {
  countryFromRequestHeaders,
  resolveUiLocale,
  resolveUiLocaleFromRequest,
  uiText,
  uiTextWith,
} from "./uiLocale";

function requestHeaders(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("UI locale foundation", () => {
  it("defaults to Polish for a Polish edge country and English otherwise", () => {
    expect(resolveUiLocaleFromRequest(requestHeaders({ "x-vercel-ip-country": "PL" }))).toBe("pl");
    expect(resolveUiLocaleFromRequest(requestHeaders({ "cf-ipcountry": "DE" }))).toBe("en");
    expect(resolveUiLocaleFromRequest(requestHeaders({}))).toBe("en");
  });

  it("accepts the supported edge country headers case-insensitively", () => {
    expect(countryFromRequestHeaders(requestHeaders({ "x-vercel-ip-country": "not-a-country", "cf-ipcountry": "pl" }))).toBe("PL");
    expect(resolveUiLocale({ country: "pl" })).toBe("pl");
  });

  it("lets a persisted EN or PL choice override the country default", () => {
    expect(resolveUiLocale({ persistedOverride: "en", country: "PL" })).toBe("en");
    expect(resolveUiLocale({ persistedOverride: "pl", country: "DE" })).toBe("pl");
    expect(resolveUiLocale({ persistedOverride: "de", country: "PL" })).toBe("pl");
  });

  it("falls back to English when Polish copy is not approved yet", () => {
    expect(uiText("pl", "footerAbout")).toBe("About us");
    expect(uiText("en", "footerPrivacy")).toBe("Privacy");
  });

  it("serves the founder-approved Polish project and setup UI", () => {
    expect(uiText("pl", "startNewProject")).toBe("Rozpocznij nowy projekt");
    expect(uiText("pl", "setupTimeLimitQuestion")).toBe("Czy masz limit czasu?");
    expect(uiTextWith("pl", "samePresentationAsTake", { take: 5 })).toBe(
      "Ta sama prezentacja co w nagraniu 5",
    );
  });
});
