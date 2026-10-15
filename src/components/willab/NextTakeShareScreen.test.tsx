// @vitest-environment jsdom
/* Fix 1 (founder 2026-10-15): before the next Take nothing is ticked, so a
   share is always the speaker's own choice (Privacy 3.6 §4d); "Only me" is a
   choice too. */
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
