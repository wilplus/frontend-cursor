// @vitest-environment jsdom
/*
 * STORY    As a speaker, I want to archive a project from the picker, never
 *          delete it there, with pending deletions locked, so that I tidy
 *          my list without risk.
 * OUTCOME
 *   O1  Every project row's ⋯ offers Archive and never Delete.
 *   O2  Archive runs at once (that project only) and the row leaves.
 *   O3  A failed archive says so and keeps the row.
 *   O4  A project with an open deletion request is locked, with no menu.
 * PROVES   O1 -> "offers Archive and never Delete"
 *          O2 -> "archives at once and the row leaves the list"
 *          O3 -> "a failed archive says so and keeps the row"
 *          O4 -> "is locked and has no menu"
 * WHY      Founder 2026-09-26 (N14): deleting moved to Data & consent.
 */
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
import type { TrainingArc } from "@/services/api/trainings";
import { PROJECT_ARCHIVE_COPY } from "@/lib/willab/projectArchiveCopy";

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
    await act(async () => button(PROJECT_ARCHIVE_COPY.archive)?.click());
    await flush();
    expect(api.archiveProject).toHaveBeenCalledTimes(1);
    expect(api.archiveProject).toHaveBeenCalledWith("arc-1");
    expect(api.requestProjectDeletion).not.toHaveBeenCalled();
    expect(button("Board pitch")).toBeUndefined();
    expect(button("Team update")).toBeDefined();
  });

  it("a failed archive says so and keeps the row", async () => {
    api.archiveProject.mockResolvedValue(false);
    await renderWith([arc()]);
    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button(PROJECT_ARCHIVE_COPY.archive)?.click());
    await flush();
    expect(api.archiveProject).toHaveBeenCalledWith("arc-1");
    expect(document.body.textContent).toContain(PROJECT_ARCHIVE_COPY.archiveFailed);
    expect(button("Board pitch")).toBeDefined();
  });
});

describe("a project with an open deletion request", () => {
  it("is locked and has no menu", async () => {
    await renderWith([
      arc({ deletion: { state: "pending", dueAt: null, cancellable: true } }),
    ]);
    expect(container.textContent).toContain("Deletion pending");
    expect(button("Board pitch")).toBeUndefined();
    expect(button("More options for Board pitch")).toBeUndefined();
  });
});
