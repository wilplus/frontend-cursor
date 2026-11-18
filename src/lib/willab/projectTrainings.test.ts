// @vitest-environment jsdom
/*
STORY    As a speaker, I want project lists refreshed after recording changes,
         so the project picker and project chat share current ownership data.
OUTCOME  O1  Concurrent reads share one request and completed Takes revalidate.
PROVES   O1 -> the shared project-list adapter deduplicates and refreshes reads.
*/
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetch = vi.hoisted(() => vi.fn());
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: fetch }));

import { refreshProjectTrainings } from "./projectTrainings";

describe("the shared project-list read", () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it("shares one in-flight read and publishes the completed list", async () => {
    let resolve: (value: []) => void = () => undefined;
    fetch.mockReturnValue(new Promise((done) => { resolve = done; }));

    const first = refreshProjectTrainings();
    const second = refreshProjectTrainings();
    expect(fetch).toHaveBeenCalledTimes(1);

    resolve([]);
    await expect(first).resolves.toEqual([]);
    await expect(second).resolves.toEqual([]);
  });

  it("revalidates after a completed Take instead of keeping the prior list", async () => {
    const project = { arcId: "arc-new" };
    fetch.mockResolvedValueOnce([]).mockResolvedValueOnce([project]);

    await expect(refreshProjectTrainings()).resolves.toEqual([]);
    await expect(refreshProjectTrainings()).resolves.toEqual([project]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
