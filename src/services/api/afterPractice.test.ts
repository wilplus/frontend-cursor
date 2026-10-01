import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  answerLendYourEar,
  fetchBoldVoices,
  mapBoldVoices,
  mapLendYourEarSet,
  setVoiceAlbumShare,
} from "./afterPractice";

/* -------------------------------------------------------------------------- */
/*  AFTER THE PRACTICE — the clients (Phases 3 and 4, founder 2026-10-01)      */
/*  Pins: the maps read the backend's names and nothing else (a Lend your    */
/*  ear clip is an id and a sound); a refusal carries its status and code;   */
/*  every BFF route goes through callBackend by the one relay idiom.         */
/* -------------------------------------------------------------------------- */

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

describe("the maps", () => {
  it("read Bold voices", () => {
    const out = mapBoldVoices({
      own: [{ clip_id: "a-1", audio_ref: "https://a", duration_ms: 2500, passage: "words", practice_id: "p" }],
      coach_readings: [{ clip_id: "r-1", media_url: "https://r", media_kind: "audio", passage: "line" }],
      others: [],
      steps_shown: { bold_voices: "t1", stranger: "x" },
    });
    expect(out.own[0]).toEqual({ clipId: "a-1", audioRef: "https://a", durationMs: 2500, passage: "words", practiceId: "p" });
    expect(out.coachReadings[0].audioRef).toBe("https://r");
    expect(out.stepsShown).toEqual({ bold_voices: "t1" });
  });

  it("a Lend your ear clip is an id and a sound", () => {
    const out = mapLendYourEarSet({ set_id: "s", clips: [{ clip_id: "c", audio_ref: "https://c", duration_ms: 1, answered: false, name: "leak" }] });
    expect(out.clips[0]).toEqual({ clipId: "c", audioRef: "https://c", durationMs: 1, answered: false });
  });
});

describe("the calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("carry the body and read the refusal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ answered: 1, of: 3 }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await answerLendYourEar("set-1", "c", "yes")).toEqual({ ok: true, data: { answered: 1, of: 3 } });
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe("/api/v2/user/lend-your-ear/set-1/answers");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ clip_id: "c", value: "yes" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ code: "NOT_FOUND" }) }));
    expect(await fetchBoldVoices("t")).toEqual({ ok: false, status: 404, code: "NOT_FOUND" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await setVoiceAlbumShare("s", true)).toEqual({ ok: false, status: 0, code: null });
  });

  it("every BFF route goes through the one relay", () => {
    const routes = [
      "src/app/api/v2/user/takes/[takeSessionId]/bold-voices/route.ts",
      "src/app/api/v2/user/takes/[takeSessionId]/bold-voices/heard/route.ts",
      "src/app/api/v2/user/takes/[takeSessionId]/after-practice-step/route.ts",
      "src/app/api/v2/user/takes/[takeSessionId]/lend-your-ear/route.ts",
      "src/app/api/v2/user/lend-your-ear/[setId]/answers/route.ts",
      "src/app/api/v2/user/voice-album/[snippetId]/share/route.ts",
      "src/app/api/v2/coach/readings/route.ts",
      "src/app/api/v2/coach/readings/[readingId]/publish/route.ts",
      "src/app/api/v2/coach/corpus-clips/route.ts",
      "src/app/api/v2/coach/corpus-clips/[clipId]/label/route.ts",
    ];
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toMatch(/relay(Json|Form)\(/);
      expect(source).not.toMatch(/\bfetch\(/);
    }
    expect(readFileSync("src/app/api/_lib/afterPracticeRelay.ts", "utf8")).toContain("callBackend(");
  });
});
