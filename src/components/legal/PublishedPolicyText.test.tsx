// @vitest-environment jsdom
/* Founder 2026-09-25, F3 = A: the Privacy page waits for the stored policy
 * instead of showing the stale v1.2 stand-in, and says so plainly when the
 * record cannot be read — a loading line must never spin for good. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchPublishedPolicyText: vi.fn() }));
vi.mock("@/services/api/publishedPolicy", () => api);

import { PublishedPolicyText } from "./PublishedPolicyText";
import type { PolicyTextState } from "@/lib/legal/policyText";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchPublishedPolicyText.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(unavailable?: string, initial?: PolicyTextState) {
  act(() =>
    root.render(
      <PublishedPolicyText which="privacy" initial={initial} unavailable={unavailable}>
        waiting
      </PublishedPolicyText>,
    ),
  );
}

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("PublishedPolicyText", () => {

  it("shows the unavailable line once the record answers without a copy", async () => {
    api.fetchPublishedPolicyText.mockResolvedValue({ kind: "fallback" });
    render("could not load");
    await settle();
    expect(container.textContent).toBe("could not load");
  });

  it("shows the stored copy once it is published", async () => {
    api.fetchPublishedPolicyText.mockResolvedValue({
      kind: "published", copy: "The stored words.", version: "3.1",
    });
    render("could not load");
    await settle();
    expect(container.textContent).toContain("The stored words.");
    expect(container.textContent).toContain("Version 3.1");
  });
});
