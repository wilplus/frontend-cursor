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
  it("shows the stand-in while the record has not answered", () => {
    api.fetchPublishedPolicyText.mockReturnValue(new Promise(() => {}));
    render("could not load");
    expect(container.textContent).toBe("waiting");
  });

  it("shows the unavailable line once the record answers without a copy", async () => {
    api.fetchPublishedPolicyText.mockResolvedValue({ kind: "fallback" });
    render("could not load");
    await settle();
    expect(container.textContent).toBe("could not load");
  });

  it("keeps the stand-in for a page that gives no unavailable line", async () => {
    api.fetchPublishedPolicyText.mockResolvedValue({ kind: "fallback" });
    render();
    await settle();
    expect(container.textContent).toBe("waiting");
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

  it("renders what the server read at once, and the browser does not ask again", () => {
    // Founder 2026-09-25, decisions 2/3: the copy is in the HTML sent.
    render("could not load", { kind: "published", copy: "Served words.", version: "3.1" });
    expect(container.textContent).toContain("Served words.");
    expect(api.fetchPublishedPolicyText).not.toHaveBeenCalled();
  });

  it("tries again in the browser when the server could not read it", async () => {
    api.fetchPublishedPolicyText.mockResolvedValue({
      kind: "published", copy: "Second try.", version: "3.1",
    });
    render("could not load", { kind: "fallback" });
    expect(container.textContent).toBe("waiting");
    await settle();
    expect(api.fetchPublishedPolicyText).toHaveBeenCalledWith("privacy");
    expect(container.textContent).toContain("Second try.");
  });
});
