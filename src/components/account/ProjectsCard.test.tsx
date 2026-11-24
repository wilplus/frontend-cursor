// @vitest-environment jsdom
/*
STORY    As a speaker, I want to see my projects in Data & consent, unarchive
         archived ones, and (once switched on) delete one only after a signed
         confirm and cancel it while pending, so that I manage my projects
         safely (deletion).
OUTCOME
  O1  Delete is switched off in production (PROJECT_DELETE_ENABLED): the list
      opens as "Your projects" and no project can be deleted or cancelled.
  O2  Archived projects are listed and marked; Unarchive sends one request
      and unmarks the row; a failed unarchive says so and changes nothing.
  O3  Switched on, Delete asks first with the signed words and sends nothing
      until "Request deletion"; then the row says "Deletion pending".
  O4  Switched on, a pending row the backend says is cancellable offers
      "Cancel deletion", which puts the row back.
PROVES   O1 -> "switched off, no project can be deleted"
         O2 -> "archived projects are marked and can be unarchived; a failure changes nothing"
         O3 -> "asks first with the signed words, and sends nothing until confirmed"
         O4 -> "offers Cancel deletion, which puts the row back"
WHY      Founder 2026-09-26 (N14). O3/O4 pin the delete contract for the day it
         is switched on; the rest of it (failure, training line, window words)
         is not tested while Delete cannot run.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
const api = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
  unarchiveProject: vi.fn(),
  requestProjectDeletion: vi.fn(),
  cancelProjectDeletion: vi.fn(),
  fetchTrainingConsent: vi.fn(),
}));

vi.mock("@/lib/willab/projectDeletionCopy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/willab/projectDeletionCopy")>();
  return {
    ...actual,
    get PROJECT_DELETE_ENABLED() {
      return flag.on;
    },
  };
});
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/trainingConsent", () => ({
  fetchTrainingConsent: api.fetchTrainingConsent,
}));
vi.mock("@/services/api/projectArchive", () => ({
  unarchiveProject: api.unarchiveProject,
}));
vi.mock("@/services/api/projectDeletion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/projectDeletion")>();
  return {
    ...actual,
    requestProjectDeletion: api.requestProjectDeletion,
    cancelProjectDeletion: api.cancelProjectDeletion,
  };
});

import ProjectsCard from "./ProjectsCard";
import { PROJECT_ARCHIVE_COPY as ARCHIVE } from "@/lib/willab/projectArchiveCopy";
import { PROJECT_DELETION_COPY as COPY } from "@/lib/willab/projectDeletionCopy";
import type { TrainingArc } from "@/services/api/trainings";

function project(over: Partial<TrainingArc> = {}): TrainingArc {
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
  flag.on = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  for (const fn of Object.values(api)) fn.mockReset();
  api.fetchTrainingConsent.mockResolvedValue(null);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
});
const button = (label: string, scope: ParentNode = document.body) =>
  Array.from(scope.querySelectorAll<HTMLButtonElement>("button"))
    .find((b) => b.textContent?.trim() === label);

async function openWith(projects: TrainingArc[]) {
  api.fetchTrainings.mockResolvedValue(projects);
  act(() => root.render(createElement(ProjectsCard)));
  const opener = button(flag.on ? "Delete a project" : "Your projects");
  expect(opener).toBeDefined();
  await act(async () => opener?.click());
  await flush();
  expect(api.fetchTrainings).toHaveBeenCalledWith({ includeArchived: true });
}

describe("switched off (production)", () => {
  it("switched off, no project can be deleted", async () => {
    flag.on = false;
    await openWith([
      project(),
      project({ arcId: "arc-2", topic: "Town hall", deletion: { state: "pending", dueAt: null, cancellable: true } }),
    ]);
    expect(container.textContent).toContain("Board pitch");
    expect(container.textContent).toContain("Town hall");
    expect(button("Delete")).toBeUndefined();
    expect(button(COPY.cancel)).toBeUndefined();
    expect(api.fetchTrainingConsent).not.toHaveBeenCalled();
  });
});

describe("archived projects", () => {
  it("archived projects are marked and can be unarchived; a failure changes nothing", async () => {
    await openWith([project({ archived: true })]);
    const row = () => container.querySelector("li") as HTMLElement;
    expect(row().textContent).toContain(ARCHIVE.archived);

    api.unarchiveProject.mockResolvedValue(false);
    await act(async () => button(ARCHIVE.unarchive)?.click());
    await flush();
    expect(row().querySelector('[role="alert"]')?.textContent).toBe("Couldn't save that. Try again.");
    expect(row().textContent).toContain(ARCHIVE.archived);

    api.unarchiveProject.mockResolvedValue(true);
    await act(async () => button(ARCHIVE.unarchive)?.click());
    await flush();
    expect(api.unarchiveProject).toHaveBeenLastCalledWith("arc-1");
    expect(api.unarchiveProject).toHaveBeenCalledTimes(2);
    expect(row().textContent).not.toContain(ARCHIVE.archived);
    expect(button(ARCHIVE.unarchive)).toBeUndefined();
  });
});

describe("Delete, once switched on", () => {
  it("asks first with the signed words, and sends nothing until confirmed", async () => {
    await openWith([project()]);
    await act(async () => button("Delete")?.click());
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Delete "Board pitch"?');
    expect(dialog.textContent).toContain(
      "Every take in this project and its ideal text will be permanently deleted. This can't be undone. We'll finish within 7 days, and until then the project is locked.",
    );
    expect(api.requestProjectDeletion).not.toHaveBeenCalled();

    api.requestProjectDeletion.mockResolvedValue({
      ok: true, deletion: { state: "pending", dueAt: "2026-10-03" },
    });
    await act(async () => button(COPY.confirm, dialog)?.click());
    await flush();
    expect(api.requestProjectDeletion).toHaveBeenCalledWith("arc-1");
    expect(container.textContent).toContain("Deletion pending");
    expect(button("Delete")).toBeUndefined();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe("a pending deletion, once switched on", () => {
  it("offers Cancel deletion, which puts the row back", async () => {
    await openWith([
      project({ deletion: { state: "pending", dueAt: null, cancellable: true } }),
    ]);
    expect(container.textContent).toContain("Deletion pending");
    api.cancelProjectDeletion.mockResolvedValue({ ok: true, deletion: null });
    await act(async () => button(COPY.cancel)?.click());
    await flush();
    expect(api.cancelProjectDeletion).toHaveBeenCalledWith("arc-1");
    expect(container.textContent).not.toContain("Deletion pending");
    expect(button("Delete")).toBeDefined();
  });
});
