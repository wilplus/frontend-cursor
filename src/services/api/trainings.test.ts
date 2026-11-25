/*
STORY    As the chat and project surfaces open together, I want one current
         trainings read shared by them, without ever seeing another account's
         projects.
OUTCOME  O1  Concurrent and recent reads use one authenticated request.
         O2  A different authenticated user gets a separate result.
         O3  A Take's range follows the recording on new and older responses.
         O4  A successful archive or restore refreshes the active project list.
PROVES   O1 -> "one fetch is shared and the successful result is reused"
         O2 -> "the cache is scoped to the authenticated identity"
         O3 -> "retains the recorded slide range on each matching Take"
         O4 -> "refetches the active list after a project is archived or restored"
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getAuthToken: vi.fn() }));
const bff = vi.hoisted(() => ({ bffFetch: vi.fn() }));

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: auth.getAuthToken }));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: bff.bffFetch }));

import {
  __resetTrainingsCacheForTests,
  fetchTrainings,
} from "./trainings";
import { archiveProject, unarchiveProject } from "./projectArchive";

const response = (topic: string) => ({
  kind: "response",
  ok: true,
  status: 200,
  body: { trainings: [{ arc_id: topic, topic }] },
});

beforeEach(() => {
  __resetTrainingsCacheForTests();
  auth.getAuthToken.mockReset().mockResolvedValue("user-a-token");
  bff.bffFetch.mockReset();
});

afterEach(() => {
  __resetTrainingsCacheForTests();
});

describe("shared trainings reads", () => {
  it("shares concurrent calls and reuses the successful result", async () => {
    let release!: (value: ReturnType<typeof response>) => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      release = resolve;
    });
    bff.bffFetch.mockReturnValue(pending);

    const first = fetchTrainings();
    const second = fetchTrainings();
    await Promise.resolve();
    release(response("board-pitch"));

    const [one, two] = await Promise.all([first, second]);
    expect(one?.[0].arcId).toBe("board-pitch");
    expect(two).toEqual(one);
    expect(bff.bffFetch).toHaveBeenCalledTimes(1);

    await expect(fetchTrainings()).resolves.toEqual(one);
    expect(bff.bffFetch).toHaveBeenCalledTimes(1);
  });

  it("does not reuse one user's projects for another user", async () => {
    bff.bffFetch.mockResolvedValueOnce(response("user-a-project"));
    await expect(fetchTrainings()).resolves.toEqual([
      expect.objectContaining({ arcId: "user-a-project" }),
    ]);

    auth.getAuthToken.mockResolvedValueOnce("user-b-token");
    bff.bffFetch.mockResolvedValueOnce(response("user-b-project"));
    await expect(fetchTrainings()).resolves.toEqual([
      expect.objectContaining({ arcId: "user-b-project" }),
    ]);
    expect(bff.bffFetch).toHaveBeenCalledTimes(2);
  });

  it("refetches the active list after a project is archived or restored", async () => {
    const archived = { ...response("board-pitch"), body: { trainings: [] } };
    let finishOldRead!: (result: ReturnType<typeof response>) => void;
    const oldRead = new Promise<ReturnType<typeof response>>((resolve) => { finishOldRead = resolve; });
    bff.bffFetch.mockResolvedValueOnce(response("board-pitch"))
      .mockReturnValueOnce(oldRead)
      .mockResolvedValueOnce(response("archive")).mockResolvedValueOnce(archived)
      .mockResolvedValueOnce(response("restore")).mockResolvedValueOnce(response("board-pitch"));

    await expect(fetchTrainings()).resolves.toEqual([expect.objectContaining({ arcId: "board-pitch" })]);
    const inFlight = fetchTrainings({ force: true });
    await Promise.resolve();
    await expect(archiveProject("board-pitch")).resolves.toBe(true);
    finishOldRead(response("board-pitch"));
    await expect(inFlight).resolves.toEqual([]);
    await expect(fetchTrainings()).resolves.toEqual([]);
    await expect(unarchiveProject("board-pitch")).resolves.toBe(true);
    await expect(fetchTrainings()).resolves.toEqual([expect.objectContaining({ arcId: "board-pitch" })]);
  });

  it("retains the recorded slide range on each matching Take", async () => {
    bff.bffFetch.mockResolvedValue({
      ...response("board-pitch"),
      body: { trainings: [{
        arc_id: "board-pitch",
        takes: [
          { session_id: "legacy", take_index: 1 },
          { session_id: "current", take_index: 2, recorded_range: { start_slide: 3, end_slide: 5 } },
        ],
        practice_chunks: [
          { latest_session_id: "legacy", start_slide: 1, end_slide: 2, attempts: 4, delivery_label: "Good" },
          { latest_session_id: "current", start_slide: 6, end_slide: 7, attempts: 1, delivery_label: "Almost" },
        ],
      }] },
    });
    const [project] = (await fetchTrainings())!;
    expect(project.takes.map((take) => take.recordedRange)).toEqual([
      { startSlide: 1, endSlide: 2 }, { startSlide: 3, endSlide: 5 },
    ]);
  });
});
