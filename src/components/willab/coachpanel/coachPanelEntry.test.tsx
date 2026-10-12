// @vitest-environment jsdom
/* The Lounge's coach door is the redrawn panel's, with its two pinned buttons,
   and no switch decides it (founder 2026-10-11, "keep the new designs, make
   them permanent"). */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachWalkEntry from "../coachwalk/CoachWalkEntry";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});
const draw = async () => {
  await act(async () => root.render(<CoachWalkEntry />));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

describe("CoachWalkEntry", () => {
  it("draws the redrawn door: the bubble and the pinned buttons, not today's queue button", async () => {
    await draw();
    expect(host.querySelector("[data-testid='coach-walk-bubble']")).not.toBeNull();
    expect(host.querySelector("[data-testid='coach-panel-pinned']")).not.toBeNull();
    expect([...host.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("Your queue");
  });
});
