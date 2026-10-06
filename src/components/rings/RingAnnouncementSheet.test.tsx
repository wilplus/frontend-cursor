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
const PHASE2 = {
  feature: "confidence_learning_writes",
  title: "[founder copy] A new way for willab to learn from your practice",
  body: "[founder copy] Explain; link the policy.",
  requires_consent: true,
  consent_purpose: "pooled_model_improvement",
  consent_policy_available: false,
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
  it("renders nothing when nothing is pending or the read failed", async () => {
    fetchMock.mockImplementation(() => reply(ringPayload([])));
    await render();
    expect(container.querySelector('[data-testid="ring-announcement-sheet"]')).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    resetRingStateCache();
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));
    await render();
    expect(container.querySelector('[data-testid="ring-announcement-sheet"]')).toBeNull();
  });

  it("shows the founder's placeholder copy and only placeholder copy", async () => {
    fetchMock.mockImplementation(() => reply(ringPayload([PHASE1])));
    await render();
    const sheet = container.querySelector('[data-testid="ring-announcement-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.textContent).toContain(PHASE1.title);
    for (const button of buttons()) expect(button.textContent).toMatch(/^\[founder copy\]/);
    for (const link of Array.from(container.querySelectorAll("a"))) expect(link.textContent).toMatch(/^\[founder copy\]/);
    // Never a score, a ring number or anyone else's data.
    expect(sheet!.textContent).not.toMatch(/ring 3|score|verdict/i);
  });

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

  it("the Phase-1 yes goes to the data choices screen; the Phase-2 yes is disabled until the policy exists", async () => {
    fetchMock.mockImplementation(() => reply(ringPayload([PHASE1])));
    await render();
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/account/data-consent");
    act(() => root.unmount());
    root = createRoot(container);
    resetRingStateCache();
    fetchMock.mockImplementation(() => reply(ringPayload([PHASE2])));
    await render();
    const yes = byText("[founder copy] Yes");
    expect(yes).toBeDefined();
    expect(yes!.disabled).toBe(true);
    expect(container.textContent).toContain("[founder copy] This choice will be available once the policy is in place.");
  });

  it("the Phase-2 yes goes to the training card on the data choices screen once the policy exists (N48.5 Q27 A)", async () => {
    fetchMock.mockImplementation(() =>
      reply(ringPayload([{ ...PHASE2, consent_policy_available: true }])));
    await render();
    const link = container.querySelector("a");
    // The one consent authority is the training yes, on its own card there;
    // the bundled model-improvement page records nothing any more.
    expect(link?.getAttribute("href")).toBe("/account/data-consent");
    expect(link?.textContent).toBe("[founder copy] Yes");
    // The sheet still records an answer, never a consent: the only POST it
    // can make is the announcement decision.
    expect(container.textContent).not.toContain("This choice will be available");
  });
});
