// @vitest-environment jsdom
/**
 * The announcement sheet (rings, 2026-09-29): shows what the backend says
 * is pending, in placeholder copy; "not now" records an answer and hides the
 * sheet; the Phase-2 "yes" stays disabled until the policy exists; and no
 * button ever records a consent.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RingAnnouncementSheet from "./RingAnnouncementSheet";
import { resetRingStateCache } from "@/services/api/rings";

vi.mock("next/link", () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) =>
    createElement("a", { href, onClick }, children),
}));

const PHASE1 = {
  feature: "exercise_service",
  title: "[founder copy] Exercises matched to your moments",
  body: "[founder copy] Explain the practice tick.",
  requires_consent: true,
  consent_purpose: "personalised_practice",
  consent_policy_available: true,
  announced_at: "2026-09-29T10:00:00Z",
};

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function ringPayload(pending: unknown[]) {
  return { ring: 3, features_on: [], pending_announcements: pending, unavailable: false };
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });

beforeEach(() => {
  resetRingStateCache();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  resetRingStateCache();
});

async function render() {
  act(() => root.render(createElement(RingAnnouncementSheet)));
  await flush();
}

const buttons = () => Array.from(container.querySelectorAll("button"));
const byText = (text: string) => buttons().find((b) => b.textContent?.trim() === text);

describe("RingAnnouncementSheet", () => {

  it("not now records the answer, hides the sheet and creates no consent", async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith("/decision") ? reply({ decision: { decision: "not_now" } }) : reply(ringPayload([PHASE1]))
    );
    await render();
    await act(async () => {
      byText("[founder copy] Not now")!.click();
    });
    await flush();
    const decision = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/decision"));
    expect(decision).toBeDefined();
    expect(decision![0]).toBe("/api/v2/user/rings/announcements/exercise_service/decision");
    expect(JSON.parse(String(decision![1].body))).toEqual({ decision: "not_now" });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("consent"))).toBe(false);
    expect(container.querySelector('[data-testid="ring-announcement-sheet"]')).toBeNull();
  });
});
