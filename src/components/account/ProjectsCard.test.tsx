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
/*  And, new with Wave 3 (founder 2026-10-05, N48.4 Q17 A; TC-7b):            */
/*    8. with an active training yes the confirm ends with the signed "A     */
/*       model already trained stays." (W5 A, N50; it retired N10's          */
/*       sentence), and only then;                                            */
/*    9. the backend's `cancellable` decides whether Cancel deletion shows;   */
/*   10. the 7-day window's words (PROPOSED) show only once switched on.      */
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

import ProjectsCard, { pendingLabel, projectConfirmBody } from "./ProjectsCard";
import { PROJECT_DELETION_COPY as COPY } from "@/lib/willab/projectDeletionCopy";
import {
  LEAVING_COPY,
  PROJECT_DELETION_WINDOW_ENABLED,
} from "@/lib/legal/leavingCopy";
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

  it("can no longer be cancelled once an operator confirmed it", async () => {
    await openWith([
      project({ deletion: { state: "confirmed", dueAt: null, cancellable: false } }),
    ]);
    expect(container.textContent).toContain("Deletion pending");
    expect(button(COPY.cancel)).toBeUndefined();
    expect(button("Delete")).toBeUndefined();
  });

  it("offers no cancel once the backend says it can no longer land (Q17 A)", async () => {
    // Inside the 7-day window the request stays "pending"; the backend's
    // `cancellable` is the word on whether a cancel can still land.
    await openWith([
      project({ deletion: { state: "pending", dueAt: null, cancellable: false } }),
    ]);
    expect(container.textContent).toContain("Deletion pending");
    expect(button(COPY.cancel)).toBeUndefined();
  });

  it("keeps the signed label, not a date, while the window's words are off", async () => {
    const ahead = new Date(Date.now() + 3 * 86_400_000).toISOString();
    await openWith([
      project({ deletion: { state: "pending", dueAt: ahead, cancellable: true } }),
    ]);
    expect(PROJECT_DELETION_WINDOW_ENABLED).toBe(false);
    expect(container.textContent).toContain("Deletion pending");
    expect(container.textContent).not.toContain("Will be deleted on");
  });
});

describe("the training line for an active training yes (W5 A, TC-7b)", () => {
  async function confirmFor(training: unknown): Promise<HTMLElement> {
    api.fetchTrainingConsent.mockResolvedValue(training);
    await openWith([project()]);
    await act(async () => button("Delete")?.click());
    return document.querySelector('[role="dialog"]') as HTMLElement;
  }

  it("ends N8's body with the signed line when the yes is active", async () => {
    const dialog = await confirmFor({
      available: true, active: true, policyVersion: "t-1",
      copy: "Use my practice text...", copySha256: "x",
    });
    expect(api.fetchTrainingConsent).toHaveBeenCalledTimes(1);
    expect(dialog.textContent).toContain(`${COPY.body} ${LEAVING_COPY.trainingModelStays}`);
    // N10's retired sentence is gone from the code, never just hidden.
    expect(dialog.textContent).not.toContain("Recordings you shared for training");
  });

  it("keeps N8's body alone with the switch off, unavailable, or unreadable", async () => {
    for (const training of [
      { available: true, active: false, policyVersion: "t-1", copy: "c", copySha256: "x" },
      { available: false, active: false, policyVersion: null, copy: null, copySha256: null },
      null,
    ]) {
      const dialog = await confirmFor(training);
      expect(dialog.textContent).toContain(COPY.body);
      expect(dialog.textContent).not.toContain(LEAVING_COPY.trainingModelStays);
      await act(async () => button("Cancel", dialog)?.click());
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("is not even read while Delete is switched off", async () => {
    flag.on = false;
    await openWith([project()]);
    expect(api.fetchTrainingConsent).not.toHaveBeenCalled();
  });
});

describe("the confirm's words", () => {
  it("N8's body, or its first sentence and the window; a yes adds the line at the end", () => {
    expect(COPY.body.startsWith(COPY.bodyFirstSentence)).toBe(true);
    expect(projectConfirmBody(false, false)).toBe(COPY.body);
    expect(projectConfirmBody(true, false)).toBe(
      `${COPY.body} ${LEAVING_COPY.trainingModelStays}`,
    );
    expect(projectConfirmBody(false, true)).toBe(
      `${COPY.bodyFirstSentence} ${LEAVING_COPY.projectWindow}`,
    );
    expect(projectConfirmBody(true, true)).toBe(
      `${COPY.bodyFirstSentence} ${LEAVING_COPY.projectWindow} ${LEAVING_COPY.trainingModelStays}`,
    );
  });

  it("a pending row names its day only once the window is on and the day is ahead", () => {
    const ahead = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(pendingLabel(ahead, false)).toBe(COPY.pending);
    expect(pendingLabel(ahead, true)).toMatch(/^Will be deleted on \d{1,2} [A-Z][a-z]+$/);
    expect(pendingLabel(past, true)).toBe(COPY.pending);
    expect(pendingLabel(null, true)).toBe(COPY.pending);
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
