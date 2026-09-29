// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FounderRingsLink from "./FounderRingsLink";
import { FOUNDER_EMAIL } from "@/lib/founder";

const auth = vi.hoisted(() => ({ email: null as string | null }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: auth.email ? { email: auth.email } : null },
      }),
    },
  }),
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  auth.email = null;
});

describe("the CEO header's link to the rings panel", () => {
  it("renders for the founder's account and points at /admin/rings", async () => {
    auth.email = FOUNDER_EMAIL;
    await act(async () => {
      root.render(createElement(FounderRingsLink));
    });
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/admin/rings");
    expect(link?.textContent).toBe("Rings");
  });

  it("renders nothing for any other account, and for no session", async () => {
    auth.email = "coach@willonski.com";
    await act(async () => {
      root.render(createElement(FounderRingsLink));
    });
    expect(container.querySelector("a")).toBeNull();

    auth.email = null;
    await act(async () => {
      root.render(createElement(FounderRingsLink));
    });
    expect(container.querySelector("a")).toBeNull();
  });
});
