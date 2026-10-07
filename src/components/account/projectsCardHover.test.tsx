// @vitest-environment jsdom

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

import ProjectsCard, { QUIET_HOVER } from "./ProjectsCard";
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
}

function expectQuietHover(el: HTMLButtonElement | undefined) {
  expect(el).toBeDefined();
  const tokens = el!.className.split(/\s+/);
  expect(tokens).toContain("hover:bg-muted");
  expect(tokens).toContain("hover:text-foreground");
  expect(tokens).not.toContain("hover:bg-accent");
  expect(tokens).not.toContain("hover:text-accent-foreground");
  return tokens;
}

describe("ProjectsCard quiet outline hover (D-CS-6)", () => {
  it("exports the prototype grey hover that keeps text colour", () => {
    expect(QUIET_HOVER).toBe("hover:bg-muted hover:text-foreground");
  });

  it("hovers the Your projects opener grey and keeps its size", () => {
    flag.on = false;
    act(() => root.render(createElement(ProjectsCard)));
    const tokens = expectQuietHover(button("Your projects"));
    expect(tokens).toContain("h-10");
    expect(tokens).toContain("rounded-full");
  });

  it("hovers the Delete a project opener grey and keeps its size", () => {
    flag.on = true;
    act(() => root.render(createElement(ProjectsCard)));
    const tokens = expectQuietHover(button("Delete a project"));
    expect(tokens).toContain("h-10");
    expect(tokens).toContain("rounded-full");
  });

  it("hovers Unarchive grey and keeps its size", async () => {
    await openWith([project({ archived: true })]);
    const tokens = expectQuietHover(button("Unarchive"));
    expect(tokens).toContain("h-9");
    expect(tokens).toContain("rounded-full");
  });

  it("leaves the red Delete button hover untouched", async () => {
    await openWith([project()]);
    const deleteButton = button("Delete");
    expect(deleteButton).toBeDefined();
    const tokens = deleteButton!.className.split(/\s+/);
    expect(tokens).toContain("hover:bg-record/90");
  });
});
