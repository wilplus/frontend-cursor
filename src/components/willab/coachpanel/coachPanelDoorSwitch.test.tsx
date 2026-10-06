// @vitest-environment jsdom
/* The Lounge's coach door and the coach panel's switch (build plan P1): off,
   today's door exactly; on, the redrawn door with its two pinned buttons. */
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
  it("switch off: today's door, unchanged (the bubble and the queue button)", async () => {
    await draw();
    expect(host.querySelector("[data-testid='coach-walk-bubble']")).not.toBeNull();
    expect(host.querySelector("[data-testid='coach-panel-pinned']")).toBeNull();
    expect([...host.querySelectorAll("button")].map((b) => b.textContent)).toContain("Your queue");
  });

  it("switch on (?coach2=1 outside production): the redrawn door", async () => {
    window.history.replaceState(null, "", "/?coach2=1");
    await draw();
    expect(host.querySelector("[data-testid='coach-walk-bubble']")).not.toBeNull();
    expect(host.querySelector("[data-testid='coach-panel-pinned']")).not.toBeNull();
    expect([...host.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("Your queue");
  });

  it("switch on by the deploy's flag", async () => {
    vi.stubEnv("NEXT_PUBLIC_COACH_PANEL_V2", "on");
    await draw();
    expect(host.querySelector("[data-testid='coach-panel-pinned']")).not.toBeNull();
  });
});
