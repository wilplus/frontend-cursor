// @vitest-environment jsdom
/* Founder 2026-09-25, F3 = A: the Privacy page waits for the stored policy
 * instead of showing the stale v1.2 stand-in, and says so plainly when the
 * record cannot be read — a loading line must never spin for good. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ fetchAuthorization: vi.fn() }));
vi.mock("@/services/api/processingAuthorization", () => auth);

import { PublishedPolicyText } from "./PublishedPolicyText";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  auth.fetchAuthorization.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(unavailable?: string) {
  act(() =>
    root.render(
      <PublishedPolicyText which="privacy" unavailable={unavailable}>
        waiting
      </PublishedPolicyText>,
    ),
  );
}

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("PublishedPolicyText", () => {
  it("shows the stand-in while the record has not answered", () => {
    auth.fetchAuthorization.mockReturnValue(new Promise(() => {}));
    render("could not load");
    expect(container.textContent).toBe("waiting");
  });

  it("shows the unavailable line once the record answers without a copy", async () => {
    auth.fetchAuthorization.mockResolvedValue({ kind: "error" });
    render("could not load");
    await settle();
    expect(container.textContent).toBe("could not load");
  });

  it("keeps the stand-in for a page that gives no unavailable line", async () => {
    auth.fetchAuthorization.mockResolvedValue({ kind: "unavailable" });
    render();
    await settle();
    expect(container.textContent).toBe("waiting");
  });

  it("shows the stored copy once it is published", async () => {
    auth.fetchAuthorization.mockResolvedValue({
      kind: "acceptance_required",
      policy: {
        privacy: { copy: "The stored words.", version: "3.1" },
        terms: { copy: "t", version: "3.1" },
      },
    });
    render("could not load");
    await settle();
    expect(container.textContent).toContain("The stored words.");
    expect(container.textContent).toContain("Version 3.1");
  });
});
