// @vitest-environment jsdom
/*
STORY    As a speaker before my next Take, I want nothing ticked for me and
         Continue to wait until I choose, with "Only me" counting as a
         choice, so that any sharing is my own decision.
OUTCOME
  O1  Nothing starts ticked, Continue is off, and choosing "Only me" turns
      it on.
PROVES   O1 -> "starts with nothing ticked; Continue waits for a choice, Only me counts"
WHY      Founder 2026-10-15 (Privacy 3.6 section 4d).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/services/api/communities", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCommunities: vi.fn(async () => ({ ok: true, data: [] })),
}));

import NextTakeShareScreen from "./NextTakeShareScreen";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("starts with nothing ticked; Continue waits for a choice, Only me counts", async () => {
  await act(async () => {
    root.render(createElement(NextTakeShareScreen, { takeCount: 1, onDone: () => {}, onClose: () => {} }));
  });
  const cont = host.querySelector('[data-testid="share-continue"]') as HTMLButtonElement;
  expect(cont.disabled).toBe(true);
  expect(host.querySelectorAll('[aria-checked="true"]').length).toBe(0);
  const onlyMe = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Only me"));
  await act(async () => onlyMe?.click());
  expect((host.querySelector('[data-testid="share-continue"]') as HTMLButtonElement).disabled).toBe(false);
});
