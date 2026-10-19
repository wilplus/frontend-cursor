// @vitest-environment jsdom
/**
 * STORY    As a speaker, I want a feature announcement I can dismiss with Not
 *          now, and its Yes off until a policy exists, so that nothing turns
 *          on or records consent without me.
 * OUTCOME
 *   O1  Not now records the decision, hides the sheet, records no consent.
 *   O2  Without a policy, Yes is a disabled button (no link to the data
 *       choices), the sheet says why, and pressing it records nothing.
 * PROVES   O1 -> "not now records the answer, hides the sheet and creates no consent"
 *          O2 -> "yes stays disabled while the policy is missing"
 * WHY      Rings, 2026-09-29: only the data choices screen records a consent (L3).
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

  it("yes stays disabled while the policy is missing", async () => {
    fetchMock.mockImplementation(() => reply(ringPayload([{ ...PHASE1, consent_policy_available: false }])));
    await render();
    expect(container.textContent).toContain(PHASE1.title);
    expect(container.textContent).toContain("once the policy is in place");
    expect(container.querySelector("a")).toBeNull();
    const yes = byText("[founder copy] Turn on in my data choices") as HTMLButtonElement;
    expect(yes).toBeDefined();
    expect(yes.disabled).toBe(true);
    const before = fetchMock.mock.calls.length;
    await act(async () => yes.click());
    await flush();
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
