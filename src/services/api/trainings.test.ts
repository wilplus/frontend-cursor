/*
STORY    As the chat and project surfaces open together, I want one current
         trainings read shared by them, without ever seeing another account's
         projects.
OUTCOME  O1  Concurrent and recent reads use one authenticated request.
         O2  A different authenticated user gets a separate result.
PROVES   O1 -> "one fetch is shared and the successful result is reused"
         O2 -> "the cache is scoped to the authenticated identity"
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
});
