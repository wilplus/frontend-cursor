// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-26 (N14) — the project picker's ⋯ offers Archive.         */
/*  Deleting a project moved to Data & consent (ProjectsCard.test.tsx         */
/*  carries the delete contract that used to live here, unchanged).           */
/*                                                                            */
/*  Pinned here:                                                              */
/*    1. every project row's ⋯ offers Archive and never Delete;               */
/*    2. Archive runs at once and the row leaves the list;                    */
/*    3. a failed archive says so and keeps the row;                          */
/*    4. a project with an open deletion request is locked, with no menu.     */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
  archiveProject: vi.fn(),
  requestProjectDeletion: vi.fn(),
}));

vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/projectArchive", () => ({
  archiveProject: api.archiveProject,
}));
vi.mock("@/services/api/projectDeletion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/projectDeletion")>();
  return { ...actual, requestProjectDeletion: api.requestProjectDeletion };
});
vi.mock("@/lib/willab/setupDraft", () => ({
  listSetupDrafts: () => [],
  deleteSetupDraft: () => undefined,
}));

import ProjectPicker from "./ProjectPicker";
import { mapProjectDeletion } from "@/services/api/projectDeletion";
import type { TrainingArc } from "@/services/api/trainings";

function arc(over: Partial<TrainingArc> = {}): TrainingArc {
  return {
    arcId: "arc-1",
    topic: "Board pitch",
    createdAt: null,
    takeCount: 2,
    takes: [],
    batchVerified: false,
    idealReady: false,
    bestPresentationArcId: "arc-1",
    coverRef: null,
    deletion: null,
    archived: false,
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchTrainings.mockReset();
  api.archiveProject.mockReset();
  api.requestProjectDeletion.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const button = (label: string, scope: ParentNode = document.body) =>
  Array.from(scope.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label);

async function renderWith(arcs: TrainingArc[]) {
  api.fetchTrainings.mockResolvedValue(arcs);
  act(() => root.render(createElement(ProjectPicker, {
    ownerId: "owner-1",
    onNewTopic: vi.fn(),
    onResumeDraft: vi.fn(),
    onContinue: vi.fn(),
    onSkip: vi.fn(),
    onClose: vi.fn(),
  })));
  await flush();
}

describe("mapProjectDeletion", () => {
  it("keeps only an open request", () => {
    expect(mapProjectDeletion({ state: "pending", due_at: "2026-10-03" }))
      .toEqual({ state: "pending", dueAt: "2026-10-03" });
    expect(mapProjectDeletion({ state: "cancelled" })).toBeNull();
    expect(mapProjectDeletion({ state: "done" })).toBeNull();
    expect(mapProjectDeletion(null)).toBeNull();
  });
});

describe("⋯ → Archive", () => {
  it("offers Archive and never Delete", async () => {
    await renderWith([arc()]);
    await act(async () => button("More options for Board pitch")?.click());
    expect(button("Archive")).toBeDefined();
    expect(button("Delete")).toBeUndefined();
  });

  it("archives at once and the row leaves the list", async () => {
    api.archiveProject.mockResolvedValue(true);
    await renderWith([arc(), arc({ arcId: "arc-2", topic: "Team update" })]);
    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Archive")?.click());
    await flush();
    expect(api.archiveProject).toHaveBeenCalledWith("arc-1");
    expect(button("Board pitch")).toBeUndefined();
    expect(button("Team update")).toBeDefined();
    expect(api.requestProjectDeletion).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("a failed archive says so and keeps the row", async () => {
    api.archiveProject.mockResolvedValue(false);
    await renderWith([arc()]);
    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Archive")?.click());
    await flush();
    expect(container.textContent).toContain("Couldn't archive. Try again.");
    expect(button("Board pitch")).toBeDefined();
  });
});

describe("a project with an open deletion request", () => {
  it("is locked and has no menu", async () => {
    await renderWith([arc({ deletion: { state: "pending", dueAt: null } })]);
    expect(container.textContent).toContain("Deletion pending");
    expect(button("Board pitch")).toBeUndefined();
    expect(button("More options for Board pitch")).toBeUndefined();
  });
});
