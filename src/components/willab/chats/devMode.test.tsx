// @vitest-environment jsdom
/*
STORY    As a host in Build, the panel under the tabs is the Speaking coach
         chip and nothing called Developer mode. That switch already sits
         elsewhere, so this panel does not draw a second one (backend N648
         still draws its own screens when they are opened).
OUTCOME
  O1  Build's bar has the Speaking coach chip and no Developer mode row,
      whether or not the dev read answers.
  O2  A week with fewer than five people reads "fewer than 5", and a chart
      that could not be counted is drawn as not counted, never as zero.
PROVES   O1 -> "Build has the Speaking coach chip and no Developer mode row"
         O2 -> "N648 a hidden week reads fewer than 5, and a chart with no weeks is not counted, never zero"
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
import { DevParts } from "./DevMode";
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
  it("Build has the Speaking coach chip and no Developer mode row", async () => {
    bff.routes["GET /api/v2/chats/setup/dev"] = DEV;
    await open();
    const bar = container.querySelector("[data-build-bar]")!;
    expect(bar.querySelector("[data-dev-switch]")).toBeNull();
    expect(bar.querySelector("[data-dev-row]")).toBeNull();
    expect(bar.textContent).not.toContain("Developer mode");
    expect(bar.querySelector("[data-open-coach]")?.textContent).toContain("Speaking coach");
  });

  it("N648 a hidden week reads fewer than 5, and a chart with no weeks is not counted, never zero", async () => {
    act(() => root.render(createElement(DevParts, { read: DEV as never })));
    await flush();
    await click('[data-dev-part="charts"]');
    expect(container.querySelector("[data-dev-hidden]")?.textContent).toBe("2026-11-02: fewer than 5");
    const none = container.querySelector("[data-dev-uncounted]") as HTMLElement;
    expect(none.textContent).toContain("Not counted right now.");
    expect(none.textContent).not.toContain("0");
    expect(container.querySelector('[data-dev-chart="ideal_texts"] a')).toBeNull();
  });

});
