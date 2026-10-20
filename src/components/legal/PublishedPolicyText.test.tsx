// @vitest-environment jsdom
/*
STORY    As a reader of the Privacy page, I want the stored policy or a plain
         "could not load" line, never an endless spinner or an old stand-in,
         so that I always know what I agreed to.
OUTCOME
  O1  The stored policy text is shown with its version number.
  O2  When no stored copy can be had, the "could not load" line is shown.
PROVES   O1 -> "shows the stored copy once it is published"
         O2 -> "shows the unavailable line once the record answers without a copy"
WHY      Founder 2026-09-25, F3 = A.
*/
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
