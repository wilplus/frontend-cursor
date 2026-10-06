import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BLANK_DRAFT,
  draftBody,
  draftFrom,
  draftProblem,
  mapCoachExercise,
  saveCoachExerciseWithVideo,
  suggestExerciseId,
  type CoachExerciseDraft,
} from "./coachExercises";

/* -------------------------------------------------------------------------- */
/*  EXERCISE AUTHORING IN THE COACH PANEL — the client (founder 2026-09-29,    */
/*  decision 4)                                                               */
/*                                                                            */
/*  Pins: the list reads the kept version and the transcript's state; the     */
/*  save speaks the backend's names and carries the AI draft only when the    */
/*  coach asked for one; a NEW exercise is born through the video call with   */
/*  its definition beside the file; every BFF route goes through callBackend. */
/* -------------------------------------------------------------------------- */

const GOOD: CoachExerciseDraft = {
  ...BLANK_DRAFT,
  exerciseId: "land-the-ending",
  title: "Land the ending",
  instruction: "Say the last word fully.",
  acousticProblemTags: ["ending_compression", "rushing"],
  mainTarget: "ending_compression",
};

describe("mapCoachExercise", () => {
  it("reads the live row with its latest version and the transcript's state", () => {
    const row = mapCoachExercise({
      exercise_id: "land-it",
      title: "Land it",
      instruction: "…",
      introduction_copy: "",
      explanation_video_url: "https://cdn/x.mp4",
      acoustic_problem_tags: ["rushing", 7],
      matching_criteria: { primary_problem_tag: "rushing" },
      active: true,
      version: 3,
      latest_version: {
        version: 3, source: "coach_panel", transcript_status: "done",
        ai_draft_text: "draft", created_at: "2026-09-29T10:00:00Z",
      },
    });
    expect(row?.version).toBe(3);
    expect(row?.acousticProblemTags).toEqual(["rushing"]);
    expect(row?.latestVersion).toEqual({
      version: 3, source: "coach_panel", transcriptStatus: "done",
      aiDraftText: "draft", createdAt: "2026-09-29T10:00:00Z",
    });
    expect(draftFrom(row!).mainTarget).toBe("rushing");
  });

  it("treats an unreadable transcript state as no transcript, and no version row as none", () => {
    const row = mapCoachExercise({
      exercise_id: "x", title: "X", latest_version: { version: 1, transcript_status: "maybe" },
    });
    expect(row?.latestVersion?.transcriptStatus).toBe("not_requested");
    expect(mapCoachExercise({ exercise_id: "x", title: "X" })?.latestVersion).toBeNull();
    expect(mapCoachExercise({ title: "no id" })).toBeNull();
  });
});

describe("draftBody", () => {
  it("speaks the backend's names and carries the main target inside the criteria", () => {
    const body = draftBody(GOOD);
    expect(body).toEqual({
      exercise_id: "land-the-ending",
      title: "Land the ending",
      instruction: "Say the last word fully.",
      introduction_copy: "",
      acoustic_problem_tags: ["ending_compression", "rushing"],
      active: true,
      matching_criteria: {
        requires_multiple_acoustic_signals: true,
        max_per_take: 1,
        primary_problem_tag: "ending_compression",
      },
    });
    // No video address for a new exercise: the backend fills it from the file.
    expect(body).not.toHaveProperty("explanation_video_url");
    // No AI draft unless the coach asked for one.
    expect(body).not.toHaveProperty("ai_draft_text");
  });

  it("keeps the stored video and the draft beside the final when there are any", () => {
    const body = draftBody({
      ...GOOD,
      explanationVideoUrl: "https://cdn/x.mp4",
      aiDraftText: "First draft.",
      aiDraftModelVersion: "m-1",
    });
    expect(body.explanation_video_url).toBe("https://cdn/x.mp4");
    expect(body.ai_draft_text).toBe("First draft.");
    expect(body.ai_draft_model_version).toBe("m-1");
  });
});

describe("draftProblem", () => {
  it("names the first thing an author must fix, the video last", () => {
    expect(draftProblem({ ...GOOD, exerciseId: "Land It" }, false)).toMatch(/id/);
    expect(draftProblem({ ...GOOD, title: " " }, false)).toMatch(/name/);
    expect(draftProblem({ ...GOOD, acousticProblemTags: [] }, false)).toMatch(/error/);
    expect(draftProblem(GOOD, false)).toMatch(/video/);
    expect(draftProblem(GOOD, true)).toBeNull();
  });

  it("suggests an id from a title", () => {
    expect(suggestExerciseId("Land the ending!")).toBe("land-the-ending");
    expect(suggestExerciseId("  2nd try: Émphasis ")).toBe("nd-try-emphasis");
  });
});

describe("saveCoachExerciseWithVideo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the file and the definition together, to the exercise's own address", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        exercise: { exercise_id: "land-the-ending", title: "Land the ending", version: 1 },
        version: 1,
        transcript_status: "pending",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });
    const result = await saveCoachExerciseWithVideo(
      { ...GOOD, explanationVideoUrl: "https://old/x.mp4" }, file,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.transcriptStatus).toBe("pending");
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe("/api/v2/coach/exercises/land-the-ending/video");
    const form = (init as RequestInit).body as FormData;
    expect((form.get("video_file") as File).name).toBe("clip.mp4");
    const definition = JSON.parse(form.get("exercise") as string);
    expect(definition.title).toBe("Land the ending");
    // The old address never rides along: the new file IS the video.
    expect(definition).not.toHaveProperty("explanation_video_url");
  });
});

describe("the doors", () => {
  const routes = [
    "src/app/api/v2/coach/exercises/route.ts",
    "src/app/api/v2/coach/exercises/[exerciseId]/video/route.ts",
    "src/app/api/v2/coach/exercises/script-draft/route.ts",
  ];

  it("every BFF route goes through callBackend and names its own upstream", () => {
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toContain("callBackend(");
      expect(source).toContain("/v2/coach/exercises");
      expect(source).not.toMatch(/\bfetch\(/);
    }
  });

  it("the page is its own route, founder-gated, and never mounts a router hook", () => {
    const page = readFileSync("src/app/admin/library/page.tsx", "utf8");
    expect(page).toContain("redirect(\"/login?redirectTo=/admin/library\")");
    expect(page).toContain("if (!isFounderEmail(user.email)) notFound();");
    const client = readFileSync("src/app/admin/library/page.client.tsx", "utf8");
    expect(client).toContain("useUserProfile()");
    expect(client).not.toContain("useRouter");
    expect(client).not.toContain("useSearchParams");
  });

});
