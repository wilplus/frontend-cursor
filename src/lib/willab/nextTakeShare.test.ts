// @vitest-environment jsdom
/*
STORY    As a speaker, I want my sharing choice applied once, to my next uploaded Take, with the wording I saw, and "Only me" to share nothing, so that I control who hears me; and I want the choice I keep shown under each Take's recording, so that I always see who hears me.
OUTCOME
  O1  My choice shares the next Take once, with the wording I saw, and not the Take after.
  O2  Choosing Only me shares nothing.
  O3  A Take that kept my choice without asking has the same line under its
      recording, a change from the line replaces that Take's line, and only
      my latest Take's line opens the sharing screen, ticked as it stands.
PROVES   O1 -> shares the next uploaded Take as chosen, once, with the words the speaker saw
         O2 -> Only me shares nothing
         O3 -> says a kept or changed choice as its Take's line, and only the latest Take's line opens the screen
WHY      Founder lock 2026-10-12, section 5; O3: founder 2026-10-31, backend
         N309 item 5 (sharing is asked once; the choice is the line under
         each Take's recording, which opens the screen to change it).
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

const { shareTake } = vi.hoisted(() => ({ shareTake: vi.fn(async () => ({ ok: true as const, data: {} })) }));
vi.mock("@/services/api/communities", () => ({ shareTake }));

import { applyNextTakeShare, keepNextTakeShare, NEXT_SHARE_WORDS_VERSION } from "./nextTakeShare";
import { latestShareLine, shareChat, shareLineDraft, shareLines } from "./walkThread";
import { WALK_COPY } from "@/components/willab/idealEditCopy";

describe("sharing the next Take (lock 2026-10-12, section 5)", () => {
  beforeEach(() => {
    localStorage.clear();
    shareTake.mockClear();
  });

  it("shares the next uploaded Take as chosen, once, with the words the speaker saw", () => {
    keepNextTakeShare({ general: true, communityIds: ["c1"] });
    applyNextTakeShare("take-2");
    applyNextTakeShare("take-3");
    expect(shareTake).toHaveBeenCalledTimes(1);
    expect(shareTake).toHaveBeenCalledWith("take-2", {
      general: true,
      communityIds: ["c1"],
      none: false,
      shareWordsVersion: NEXT_SHARE_WORDS_VERSION,
    });
  });

  it("Only me shares nothing", () => {
    keepNextTakeShare({ general: true, communityIds: [] });
    keepNextTakeShare(null);
    applyNextTakeShare("take-2");
    expect(shareTake).not.toHaveBeenCalled();
  });

  it("says a kept or changed choice as its Take's line, and only the latest Take's line opens the screen", () => {
    const invita = "11111111-1111-4111-8111-111111111111";
    const share = { general: false, community_ids: [invita], none: false, words_version: "sharing-screen-2026-10-12" };
    const asked = shareChat(2, ["mine"], ["Invita"], "arc-1", share).map((d, i) => ({
      ...d, client_id: `q${i}`, metadata: d.metadata ?? {}, client_created_at: `2026-11-02T09:00:0${i}Z`,
    }));
    const rec = (n: number, at: string) => ({
      client_id: `rec${n}`, role: "user" as const, kind: "recording_summary" as const, body: "",
      metadata: { session_id: `take-${n}`, arc_id: "arc-1", take_index: n }, client_created_at: at,
    });
    const line = (draft: ReturnType<typeof shareLineDraft>, id: string, at: string) => ({
      ...draft, client_id: id, metadata: draft.metadata ?? {}, client_created_at: at,
    });
    // Take 3 kept the choice: its line, no question before it.
    const kept = line(shareLineDraft("Only my community (Invita)", share, "arc-1"), "k3", "2026-11-02T11:00:00Z");
    // Then the speaker changed Take 3's line to Only me.
    const changed = line(
      shareLineDraft(WALK_COPY.shareOnlyMe, { ...share, community_ids: [], none: true }, "arc-1", "take-3"),
      "c3", "2026-11-02T12:00:00Z",
    );
    const thread = [...asked, rec(2, "2026-11-02T10:00:00Z"), kept, rec(3, "2026-11-02T11:30:00Z")];
    expect(shareLines(thread)).toEqual(new Map([["rec2", "Only my community (Invita)"], ["rec3", "Only my community (Invita)"]]));
    expect(latestShareLine(thread)).toMatchObject({ recording: "rec3", takeSessionId: "take-3", ticks: ["mine"], communityIds: [invita] });
    expect(shareLines([...thread, changed]).get("rec3")).toBe(WALK_COPY.shareOnlyMe);
    expect(latestShareLine([...thread, changed])).toMatchObject({ recording: "rec3", ticks: ["none"] });
    // A latest Take with no line has nothing to open.
    expect(latestShareLine([...thread, rec(4, "2026-11-02T13:00:00Z")])).toBeNull();
  });
});
