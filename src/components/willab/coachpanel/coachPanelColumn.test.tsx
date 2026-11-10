// @vitest-environment jsdom
/*
STORY    As a coach on a computer, I want my queue and every screen after it
         as wide as Will's chat, the way the rest of the app is, not a narrow
         strip in the middle (backend N627).
OUTCOME
  O1  Opened from the list of chats ("Your queue"), the panel is drawn in
      the column Will's chat fills, and ‹ closes it from there.
PROVES   O1 -> "opened from the list of chats, the panel is drawn in Will's column and closes from there"
WHY      Backend N627; frontend #1363 did the same for the AI models overlay.
         No snapshot or CSS test: one check that the panel's frame is the
         shared column, every screen and sheet drawing through it.
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../coachwalk/useMomentsQueue", () => ({
  useMomentsQueue: () => ({ speakers: [], waiting: 0, loading: false, settled: true, refresh: () => undefined }),
}));
vi.mock("@/services/api/coachPanel", () => ({
  fetchErrorAudit: vi.fn(async () => null),
  fetchBlockPicks: vi.fn(async () => null),
  fetchV4MomentPicks: vi.fn(async () => null),
  fetchV4SurerPairs: vi.fn(async () => null),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({
  useConfidenceChainReceipt: () => ({ current: null }),
}));

import CoachPanelDoor from "./CoachPanelDoor";
import { WILL_COLUMN } from "./CoachPanel";
import { openCoachQueue } from "@/lib/willab/coachDoor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("the coach panel fills Will's column (backend N627)", () => {
  it("opened from the list of chats, the panel is drawn in Will's column and closes from there", async () => {
    act(() => root.render(<CoachPanelDoor />));
    await flush();
    expect(document.querySelector("[data-testid='coach-panel-queue']")).toBeNull();
    // The "Your queue" row in the list of chats opens the panel this way.
    act(() => openCoachQueue());
    await flush();
    const queue = document.querySelector<HTMLElement>("[data-testid='coach-panel-queue']");
    expect(queue).not.toBeNull();
    const frame = queue!.closest<HTMLElement>(".walk-stage-column");
    expect(WILL_COLUMN).toBe("md:mx-auto md:max-w-3xl");
    expect(frame?.className.split(" ")).toEqual(expect.arrayContaining(WILL_COLUMN.split(" ")));
    expect(frame?.className).not.toContain("430px");
    // ‹ in the panel's own top bar closes it, back to the list.
    const back = queue!.querySelector<HTMLButtonElement>(".walk-ovtop button")!;
    await act(async () => back.click());
    await flush();
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(document.querySelector("[data-testid='coach-panel-queue']")).toBeNull();
  });
});
