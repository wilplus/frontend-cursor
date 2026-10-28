// @vitest-environment jsdom
/*
STORY    As someone giving my WhatsApp number, I want to find my country by
         its flag, name or code, so that I don't have to remember the code.
OUTCOME
  O1  Poland is chosen at the start; the list opens with Poland, then the
      United States, then every country A to Z.
  O2  Searching "uk" finds the United Kingdom; picking it gives the number
      its +44.
  O3  A full number pasted with + picks its own country, and a leading 0 is
      dropped.
PROVES   O1, O2 -> "Poland first, then the US, then A to Z; search finds the UK"
         O3 -> "a pasted number picks its country"
WHY      Founder 2026-10-28, backend N230.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PhoneNumberField, { PHONE_FIELD_COPY } from "./PhoneNumberField";

let container: HTMLDivElement;
let root: Root;
const got = vi.fn();

beforeEach(() => {
  got.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(createElement(PhoneNumberField, { id: "n", onChange: got })));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const type = (el: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const options = () => [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')];
const countryButton = () => container.querySelector<HTMLButtonElement>("button")!;

describe("the number field", () => {
  it("Poland first, then the US, then A to Z; search finds the UK", () => {
    expect(countryButton().getAttribute("aria-label")).toBe(PHONE_FIELD_COPY.country("Poland", "48"));
    act(() => countryButton().click());
    const names = options().map((o) => o.textContent ?? "");
    expect(names[0]).toContain("Poland");
    expect(names[1]).toContain("United States");
    expect(names[2]).toContain("Afghanistan");

    type(document.body.querySelector<HTMLInputElement>('input[type="search"]')!, "uk");
    act(() => options()[0].click());
    expect(countryButton().getAttribute("aria-label")).toBe(PHONE_FIELD_COPY.country("United Kingdom", "44"));

    type(container.querySelector<HTMLInputElement>("#n")!, "07700 900123");
    expect(got).toHaveBeenLastCalledWith("+447700900123");
  });

  it("a pasted number picks its country", () => {
    type(container.querySelector<HTMLInputElement>("#n")!, "+1 201 555 0123");
    expect(countryButton().getAttribute("aria-label")).toBe(PHONE_FIELD_COPY.country("United States", "1"));
    expect(got).toHaveBeenLastCalledWith("+12015550123");
  });
});
