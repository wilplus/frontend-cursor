import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ceoTaskAgentText,
  createCeoBug,
  deleteCeoTask,
  listCeoTasks,
  moveCeoTask,
  updateCeoTask,
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

  it("keeps project, view and feature filters explicit on reads", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tasks: [task] }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCeoTasks("product", "done", "feature-1")).resolves.toEqual([
      task,
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/v2/admin/ceo/work-items/tasks?project=product&view=done&feature_id=feature-1"
    );
  });

  it("sends manual feature correction and confirmed deletion", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            url.includes("confirmed=1") ? { deleted: true } : { task }
          ),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateCeoTask("product", "task-1", { feature_id: "feature-1" });
    await deleteCeoTask("product", "task-1");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ feature_id: "feature-1" }),
      })
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      "project=product&confirmed=1"
    );
  });

  it("formats one self-contained agent task", () => {
    expect(ceoTaskAgentText(task)).toBe(
      "[P1] Repair saving\n\nAs a speaker, I want saving to finish.\n\n" +
        "Fix the save path and add regression coverage."
    );
  });

  it("moves tasks without mutating the original list", () => {
    const two = { ...task, id: "task-2", title: "Second" };
    const three = { ...task, id: "task-3", title: "Third" };
    const original = [task, two, three];
    expect(moveCeoTask(original, 0, 2).map((row) => row.id)).toEqual([
      "task-2",
      "task-3",
      "task-1",
    ]);
    expect(original.map((row) => row.id)).toEqual(["task-1", "task-2", "task-3"]);
  });
});
