// @vitest-environment jsdom
/*
STORY    As a speaker, when I open an older Take's Ideal Text card (1.0 while
         the project is at 3.0), I want to read what I said in that Take,
         not my latest words.
OUTCOME
  O1  An older card opens its own version, the card at the end of an older
      Take's walk too; the newest card opens the live page, as before.
  O2  The older version's page shows that Take's words slide by slide and
      names its Take, never the latest Take's words.
  O3  A version that is the newest, or has no saved words, opens the live
      page, decided before any page is drawn (one screen per tap); one not
      kept says so on the page, the newest says nothing.
  O4  The older page says which Take it is, leads to the latest, and shows
      the helper words of its time orange (N380).
PROVES   O1 -> "an older card opens its own version, the newest the live page"
         O2 -> "shows that Take's words"
         O3 -> "falls back to the live page"
         O4 -> "says which Take, leads to the latest, keeps its helper words"
WHY      Founder 2026-11-03, backend N375, N376, N380; rule 5.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReportCard from "./ReportCard";
import { WalkStepBubble } from "./Lounge";
import IdealTextPastVersion from "./IdealTextPastVersion";
import { resolvePastIdealText } from "@/lib/willab/pastIdealText";
import type { IdealTextRevision } from "@/services/api/blockVariants";
import { type LoungeMessage } from "@/services/api/loungeMessages";

const revisions = vi.fn();
vi.mock("@/services/api/blockVariants", async (load) => {
  const actual = await load<typeof import("@/services/api/blockVariants")>();
  return { ...actual, fetchIdealTextRevisions: (arcId: string) => revisions(arcId) };
});
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "test-token") }));
vi.mock("@/services/api/idealText", async (load) => {
  const actual = await load<typeof import("@/services/api/idealText")>();
  return { ...actual, primeIdealTextDisplay: vi.fn(), warmIdealTextOpen: vi.fn() };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  revisions.mockReset();
  revisions.mockResolvedValue({
    kind: "ready",
    headRevision: 3,
    revisions: [
      { revision: 3, takeIndex: 3, text: "What I said in Take three.", slides: null, presentationRef: null, helperWords: [], createdAt: null, isHead: true },
      { revision: 1, takeIndex: 1, text: "What I said in Take one.\n\nStill on slide one.\n\nOn to slide two.", slides: [0, 0, 1], presentationRef: null, helperWords: [{ slideIndex: 1, phrases: ["slide two"] }], createdAt: null, isHead: false },
    ],
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const card = (version: number): LoungeMessage => ({
  client_id: `card-${version}`,
  role: "bot",
  kind: "ideal_text",
  body: "",
  metadata: { arc_id: "arc-1", version, topic: "Q3 Board pitch" },
  client_created_at: "2026-11-03T09:00:00Z",
});

async function tapCard(version: number, latest: boolean) {
  const onOpenIdealText = vi.fn();
  const onOpenPastIdealText = vi.fn();
  await act(async () => {
    root.render(createElement(ReportCard, { message: card(version), latestForArc: latest, onOpenIdealText, onOpenPastIdealText }));
  });
  await act(async () => {
    (container.querySelector("[role=button], button") as HTMLElement).click();
  });
  return { onOpenIdealText, onOpenPastIdealText };
}

const past = (n: number) => ({ by: "version" as const, n, title: "Q3 Board pitch" });

async function draw(revision: IdealTextRevision, latestTake: number | null) {
  const onLatest = vi.fn();
  await act(async () => {
    root.render(createElement(IdealTextPastVersion, { revision, past: past(1), latestTake, onClose: vi.fn(), onLatest }));
  });
  return onLatest;
}

describe("an older Take's Ideal Text card (N375)", () => {
  it("an older card opens its own version, the newest the live page", async () => {
    const older = await tapCard(1, false);
    expect(older.onOpenPastIdealText).toHaveBeenCalledWith("arc-1", expect.objectContaining({ by: "version", n: 1 }));
    expect(older.onOpenIdealText).not.toHaveBeenCalled();
    const newest = await tapCard(3, true);
    expect(newest.onOpenIdealText).toHaveBeenCalledWith("arc-1");
    expect(newest.onOpenPastIdealText).not.toHaveBeenCalled();
  });

  it("an older Take's walk ends on that Take's words", async () => {
    const onOpenIdealText = vi.fn();
    const onOpenPastIdealText = vi.fn();
    const end: LoungeMessage = { ...card(1), kind: "walk_step", metadata: { arc_id: "arc-1", step: "end", take_index: 1 } };
    await act(async () => {
      root.render(createElement(WalkStepBubble, { message: end, card: { title: "Q3 Board pitch", take: 1 }, onOpenIdealText, onOpenPastIdealText }));
    });
    await act(async () => {
      (container.querySelector("button") as HTMLElement).click();
    });
    expect(onOpenPastIdealText).toHaveBeenCalledWith("arc-1", expect.objectContaining({ by: "take", n: 1 }));
    expect(onOpenIdealText).not.toHaveBeenCalled();
  });

  it("shows that Take's words, slide by slide", async () => {
    const opened = await resolvePastIdealText("arc-1", past(1));
    if (opened.kind !== "past") throw new Error("expected the older version");
    await draw(opened.revision, opened.latestTake);
    expect(container.textContent).toContain("What I said in Take one.");
    expect(container.textContent).not.toContain("Take three");
    // Two slides: the first holds two paragraphs, the second one.
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(container.textContent).toContain("Slide 2");
  });

  it("says which Take, leads to the latest, keeps its helper words", async () => {
    const opened = await resolvePastIdealText("arc-1", past(1));
    if (opened.kind !== "past") throw new Error("expected the older version");
    const onLatest = await draw(opened.revision, opened.latestTake);
    expect(container.textContent).toContain("This is what you said in Take 1.");
    const go = [...container.querySelectorAll("button")].find((b) => b.textContent === "Go to Take 3");
    await act(async () => go!.click());
    expect(onLatest).toHaveBeenCalled();
    // The words of its time, orange where the words say them.
    expect(container.querySelector(".walk-helper-word")?.textContent?.toLowerCase()).toBe("slide two");
  });

  it("falls back to the live page", async () => {
    expect(await resolvePastIdealText("arc-1", past(3))).toEqual({ kind: "live", notice: null });
    expect(await resolvePastIdealText("arc-1", past(2))).toEqual({
      kind: "live",
      notice: "Take 2's words weren't saved. This is Take 3.",
    });
  });
});
