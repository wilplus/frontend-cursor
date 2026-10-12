import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCeoBug,
  type CeoTask,
} from "./workItems";

const task: CeoTask = {
  id: "task-1",
  project_key: "product",
  feature_id: null,
  bug_id: "bug-1",
  title: "Repair saving",
  user_story: "As a speaker, I want saving to finish.",
  body: "Fix the save path and add regression coverage.",
  attachments: [],
  priority: 1,
  order_key: 100,
  status: "active",
  generation_status: "ready",
  manually_edited: false,
  created_at: "2026-08-25",
  updated_at: "2026-08-25",
  done_at: null,
  archived_at: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CEO work item client", () => {
  it("creates a bug inside its explicit project with its attachments", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 202,
        json: () => Promise.resolve({ bug_id: "bug-1", task_id: "task-1" }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createCeoBug({
        project: "research",
        text: "The hypothesis field resets",
        attachments: [],
      })
    ).resolves.toEqual({ bugId: "bug-1", taskId: "task-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v2/admin/ceo/work-items/bugs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          project: "research",
          text: "The hypothesis field resets",
          attachments: [],
        }),
      })
    );
  });
});
