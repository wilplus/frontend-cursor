// @vitest-environment jsdom
/*
STORY    As a speaker opening the app, I want my existing chat, composer and
         safe primary action available before the optional status reconciliation
         answers.
OUTCOME
  O1  The chat surface renders while the readout request is still pending; the
      request starts only after the chat boot settles.
  O2  A readout error leaves the existing status alone instead of turning an
      unavailable history into an empty one.
PROVES   O1 -> "readout reconciliation is non-blocking and starts once"
         O2 -> "a scoped status failure does not jump the chat"
*/
import { act, createElement, useCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/services/api/readouts", () => ({
  fetchReadoutsForStatus: reads.fetch,
}));

import { __resetChatBootForTests, markChatBootSettled, markChatBootStarted } from "@/lib/chatBoot";
import { useStatusHydration } from "./useStatusHydration";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

function Surface({ onSettle }: { onSettle: (status: string) => void }) {
  const settle = useCallback(onSettle, [onSettle]);
  useStatusHydration(true, "maria", "lounge_idle", settle);
  return createElement(
    "main",
    null,
    createElement("textarea", { "data-testid": "composer" }),
    createElement("button", { "data-testid": "primary-action" }, "Record"),
  );
}

beforeEach(() => {
  __resetChatBootForTests();
  markChatBootStarted();
  reads.fetch.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("status hydration readiness", () => {
  it("keeps the chat usable and starts one read after boot settles", async () => {
    let release!: (value: { rows: []; ok: true }) => void;
    reads.fetch.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const settled = vi.fn();

    act(() => root.render(createElement(Surface, { onSettle: settled })));
    expect(container.querySelector("[data-testid=\"composer\"]")).not.toBeNull();
    expect(container.querySelector("[data-testid=\"primary-action\"]")).not.toBeNull();
    expect(reads.fetch).not.toHaveBeenCalled();

    await act(async () => {
      markChatBootSettled();
      expect(reads.fetch).toHaveBeenCalledTimes(1);
      release({ rows: [], ok: true });
    });
    expect(settled).toHaveBeenCalledWith("lounge_idle");
  });

  it("does not change the visible status when the background read fails", async () => {
    reads.fetch.mockResolvedValue({ rows: [], ok: false });
    const settled = vi.fn();

    act(() => root.render(createElement(Surface, { onSettle: settled })));
    await act(async () => markChatBootSettled());

    expect(settled).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid=\"composer\"]")).not.toBeNull();
  });
});
