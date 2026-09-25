// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-26 — ⋯ → Delete on every project row (N8 copy, P1).       */
/*                                                                            */
/*  Pinned here:                                                              */
/*    1. while PROJECT_DELETE_ENABLED is off, project rows carry no menu;     */
/*    2. Delete asks first with the signed words, and nothing is sent until   */
/*       "Request deletion";                                                  */
/*    3. after the request the row says "Deletion pending" and can't open;    */
/*    4. a pending row offers "Cancel deletion", which puts the row back;     */
/*    5. a confirmed deletion can no longer be cancelled;                     */
/*    6. a failed request says so and changes nothing.                        */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
const api = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
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
vi.mock("@/services/api/projectDeletion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/projectDeletion")>();
  return {
    ...actual,
    requestProjectDeletion: api.requestProjectDeletion,
    cancelProjectDeletion: api.cancelProjectDeletion,
  };
});
vi.mock("@/lib/willab/setupDraft", () => ({
  listSetupDrafts: () => [],
  deleteSetupDraft: () => undefined,
}));

import ProjectPicker from "./ProjectPicker";
import { PROJECT_DELETION_COPY as COPY } from "@/lib/willab/projectDeletionCopy";
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
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;
const onContinue = vi.fn();

beforeEach(() => {
  flag.on = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchTrainings.mockReset();
  api.requestProjectDeletion.mockReset();
  api.cancelProjectDeletion.mockReset();
  onContinue.mockReset();
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
    onContinue,
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

describe("while the delete is switched off", () => {
  it("shows project rows without a menu", async () => {
    flag.on = false;
    await renderWith([arc()]);
    expect(button("Board pitch")).toBeDefined();
    expect(button("More options for Board pitch")).toBeUndefined();
  });
});

describe("⋯ → Delete", () => {
  it("asks first with the signed words, and sends nothing until confirmed", async () => {
    await renderWith([arc()]);
    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Delete")?.click());
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Delete "Board pitch"?');
    expect(dialog.textContent).toContain(
      "Every take in this project and its ideal text will be permanently deleted. This can't be undone. We'll finish within 7 days, and until then the project is locked.",
    );
    expect(button(COPY.confirm, dialog)).toBeDefined();
    expect(api.requestProjectDeletion).not.toHaveBeenCalled();

    api.requestProjectDeletion.mockResolvedValue({
      ok: true, deletion: { state: "pending", dueAt: "2026-10-03" },
    });
    await act(async () => button(COPY.confirm, dialog)?.click());
    await flush();
    expect(api.requestProjectDeletion).toHaveBeenCalledWith("arc-1");
    expect(container.textContent).toContain("Deletion pending");
    expect(button("Board pitch")).toBeUndefined();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("a failed request says so and changes nothing", async () => {
    await renderWith([arc()]);
    await act(async () => button("More options for Board pitch")?.click());
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
  it("locks the row and offers Cancel deletion", async () => {
    await renderWith([arc({ deletion: { state: "pending", dueAt: null } })]);
    expect(container.textContent).toContain("Deletion pending");
    expect(button("Board pitch")).toBeUndefined();

    api.cancelProjectDeletion.mockResolvedValue({ ok: true, deletion: null });
    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button(COPY.cancel)?.click());
    await flush();
    expect(api.cancelProjectDeletion).toHaveBeenCalledWith("arc-1");
    expect(container.textContent).not.toContain("Deletion pending");
    expect(button("Board pitch")).toBeDefined();
  });

  it("can no longer be cancelled once an operator confirmed it", async () => {
    await renderWith([arc({ deletion: { state: "confirmed", dueAt: null } })]);
    expect(container.textContent).toContain("Deletion pending");
    expect(button("More options for Board pitch")).toBeUndefined();
  });
});
