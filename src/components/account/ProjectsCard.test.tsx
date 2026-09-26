// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-26 (N14) — Your projects, in Data & consent.              */
/*                                                                            */
/*  Delete moved here from the project picker. The delete contract that was  */
/*  pinned there is pinned here, unchanged:                                   */
/*    1. while PROJECT_DELETE_ENABLED is off, no project can be deleted;      */
/*    2. Delete asks first with the signed words, and nothing is sent until   */
/*       "Request deletion";                                                  */
/*    3. after the request the row says "Deletion pending";                   */
/*    4. a pending row offers "Cancel deletion", which puts the row back;     */
/*    5. a confirmed deletion can no longer be cancelled;                     */
/*    6. a failed request says so and changes nothing.                        */
/*  And, new with Archive:                                                    */
/*    7. archived projects are listed, marked, and can be unarchived.         */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
const api = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
  unarchiveProject: vi.fn(),
  requestProjectDeletion: vi.fn(),
  cancelProjectDeletion: vi.fn(),
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

describe("while the delete is switched off", () => {
  it("lists the projects but offers no Delete", async () => {
    flag.on = false;
    await openWith([project()]);
    expect(container.textContent).toContain("Board pitch");
    expect(button("Delete")).toBeUndefined();
  });
});

describe("Delete", () => {
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

  it("a failed request says so and changes nothing", async () => {
    await openWith([project()]);
    await act(async () => button("Delete")?.click());
    api.requestProjectDeletion.mockResolvedValue({ ok: false, deletion: null });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    await act(async () => button(COPY.confirm, dialog)?.click());
    await flush();
    expect(dialog.textContent).toContain("Couldn't delete. Try again.");
    expect(container.textContent).not.toContain("Deletion pending");
  });
});

describe("a pending deletion", () => {
  it("offers Cancel deletion, which puts the row back", async () => {
    await openWith([project({ deletion: { state: "pending", dueAt: null } })]);
    expect(container.textContent).toContain("Deletion pending");
    api.cancelProjectDeletion.mockResolvedValue({ ok: true, deletion: null });
    await act(async () => button(COPY.cancel)?.click());
    await flush();
    expect(api.cancelProjectDeletion).toHaveBeenCalledWith("arc-1");
    expect(container.textContent).not.toContain("Deletion pending");
    expect(button("Delete")).toBeDefined();
  });

  it("can no longer be cancelled once an operator confirmed it", async () => {
    await openWith([project({ deletion: { state: "confirmed", dueAt: null } })]);
    expect(container.textContent).toContain("Deletion pending");
    expect(button(COPY.cancel)).toBeUndefined();
    expect(button("Delete")).toBeUndefined();
  });
});

describe("archived projects", () => {
  it("are listed, marked, and can be unarchived", async () => {
    flag.on = false;
    await openWith([project({ archived: true })]);
    expect(container.textContent).toContain("Archived");
    api.unarchiveProject.mockResolvedValue(true);
    await act(async () => button("Unarchive")?.click());
    await flush();
    expect(api.unarchiveProject).toHaveBeenCalledWith("arc-1");
    expect(button("Unarchive")).toBeUndefined();
    expect(container.textContent).not.toContain("Archived");
  });

  it("a failed unarchive says so and keeps the mark", async () => {
    flag.on = false;
    await openWith([project({ archived: true })]);
    api.unarchiveProject.mockResolvedValue(false);
    await act(async () => button("Unarchive")?.click());
    await flush();
    expect(container.textContent).toContain("Couldn't save that. Try again.");
    expect(button("Unarchive")).toBeDefined();
  });
});
