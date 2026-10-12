// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PacePanel from "./PacePanel";

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("PacePanel", () => {
  let root: Root;
  let host: HTMLElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("says Not available on a refusal and draws no number", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(403, { code: "FORBIDDEN", error: "Not available" })));
    await act(async () => {
      root.render(<PacePanel />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const text = host.textContent ?? "";
    expect(text).toContain("Not available for this account.");
    expect(host.querySelectorAll('[role="meter"]').length).toBe(0);
  });
});
