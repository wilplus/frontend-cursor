/*
STORY    As a coach, I want a new exercise video saved together with its
         definition at the exercise's own address, so that the exercise and
         its video never get out of step.
OUTCOME
  O1  The video file and the exercise definition go in one upload to that
      exercise's address, and the old video link is not sent.
PROVES   O1 -> "posts the file and the definition together, to the exercise's own address"
*/
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  saveCoachExerciseWithVideo,
  type CoachExerciseDraft,
} from "./coachExercises";

const GOOD: CoachExerciseDraft = {
  exerciseId: "land-the-ending",
  title: "Land the ending",
  instruction: "Say the last word fully.",
  introductionCopy: "",
  acousticProblemTags: ["ending_compression", "rushing"],
  mainTarget: "ending_compression",
  matchingCriteria: null,
  explanationVideoUrl: "",
  active: true,
  aiDraftText: null,
  aiDraftModelVersion: null,
};

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

