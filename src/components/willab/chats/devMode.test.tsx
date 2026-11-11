// @vitest-environment jsdom
/*
STORY    As a host with the chat builder's ring, I switch on Developer mode
         under Build's two tabs and see in plain numbers how close my chat is
         to the speaking coach, what it notices, what it says, charts by week
         and my training data to keep; off the ring I see none of it (backend
         N648).
OUTCOME
  O1  With the ring, Build has a "Developer mode" switch; on, it shows the
      five parts, each opening its screen.
  O2  A week with fewer than five people reads "fewer than 5", and a chart
      that could not be counted is drawn as not counted, never as zero.
  O3  Off the ring (the read is 404) there is no switch and nothing else.
PROVES   O1 -> "N648 Developer mode: the switch under the tabs shows the five parts, each opening its screen"
         O2 -> "N648 a hidden week reads fewer than 5, and a chart with no weeks is not counted, never zero"
         O3 -> "N648 off the ring nothing of Developer mode shows"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bff = vi.hoisted(() => ({ routes: {} as Record<string, unknown> }));
vi.mock("@/lib/api/bffFetch", () => ({
  bffFetch: vi.fn(async (path: string, init?: { method?: string }) => {
    const answer = bff.routes[`${init?.method ?? "GET"} ${path}`];
    if (answer === undefined) return { kind: "response", ok: false, status: 404, body: { code: "NOT_FOUND" } };
    return { kind: "response", ok: true, status: 200, body: answer };
  }),
}));
vi.mock("../useUserProfile", () => ({ useUserProfile: () => ({ profile: { first_name: "Lena" }, loading: false, isCoach: false }) }));

import WillBuild from "./WillBuild";
import { forgetSetup } from "./hostsetup/hostSetupDoor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SETUP = { recipe: null, parts: [], own_chat: { title: "Lena", line: "Hi." }, cost: null };
const DEV = {
  close: { done: 2, of: 3, items: [{ key: "a", label: "Its name", status: "built" }, { key: "b", label: "Its hello", status: "built" }, { key: "c", label: "Practice", status: "not_started" }] },
  notice: [{ model_id: "m1", q: "Is this a dry scalp?", level_name: "Still learning", next_name: "Learns from cases", need: { step: "settle", more: 12, have: 8, of: 20 }, pct: 40, segments: 8, experiments: null, agreed: null }],
  says: [{ model_id: "m1", q: "Is this a dry scalp?", says: "Your scalp looks dry.", on: true, helped: { a: 3, b: 4 }, more_to_tell: 26, enough_at: 30 }],
  charts: [
    { name: "people", weeks: [{ week: "2026-11-02", count: null, fewer_than: 5 }, { week: "2026-11-09", count: 7 }] },
    { name: "ideal_texts", weeks: null },
  ],
  data: [{ model_id: "m1", q: "Is this a dry scalp?", files: { jsonl: "/v2/models/m1/download?format=jsonl", csv: "/v2/models/m1/download?format=csv" } }],
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  bff.routes = {};
  forgetSetup();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const flush = async () => {
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
};
const text = () => container.textContent ?? "";
const click = async (sel: string) => {
  await act(async () => (container.querySelector(sel) as HTMLElement).click());
  await flush();
};
async function open() {
  bff.routes["GET /api/v2/chats/setup"] = SETUP;
  act(() => root.render(createElement(WillBuild, { onBack: () => undefined })));
  await flush();
}

describe("Developer mode (backend N648)", () => {
  it("N648 Developer mode: the switch under the tabs shows the five parts, each opening its screen", async () => {
    bff.routes["GET /api/v2/chats/setup/dev"] = DEV;
    await open();
    await click("[data-dev-switch]");
    for (const t of ["How close to the speaking coach", "What I notice", "What I say", "Charts", "Your training data"]) expect(text()).toContain(t);
    await click('[data-dev-part="close"]');
    expect(text()).toContain("Your chat does 2 of the 3 things the speaking coach does.");
    await click("[data-dev-back]");
    await click('[data-dev-part="says"]');
    expect(text()).toContain("Helped 3 of 4 times.");
    expect(text()).toContain("26 more answers before I can tell for sure.");
    await click("[data-dev-back]");
    await click('[data-dev-part="data"]');
    expect((container.querySelector("[data-dev-data] a") as HTMLAnchorElement).getAttribute("href")).toBe("/api/v2/models/m1/download?format=jsonl");
  });

  it("N648 a hidden week reads fewer than 5, and a chart with no weeks is not counted, never zero", async () => {
    bff.routes["GET /api/v2/chats/setup/dev"] = DEV;
    await open();
    await click("[data-dev-switch]");
    await click('[data-dev-part="charts"]');
    expect(container.querySelector("[data-dev-hidden]")?.textContent).toBe("2026-11-02: fewer than 5");
    const none = container.querySelector("[data-dev-uncounted]") as HTMLElement;
    expect(none.textContent).toContain("Not counted right now.");
    expect(none.textContent).not.toContain("0");
    expect(container.querySelector('[data-dev-chart="ideal_texts"] a')).toBeNull();
  });

  it("N648 off the ring nothing of Developer mode shows", async () => {
    await open();
    expect(container.querySelector("[data-dev-switch]")).toBeNull();
    expect(text()).not.toContain("Developer mode");
  });
});
