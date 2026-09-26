// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-25 — an interrupted new-project setup is listed in the     */
/*  picker as a Draft, above every project, and tapping it resumes it.        */
/*  Rendered against the REAL draft store (only the network is mocked), so    */
/*  a regression anywhere between storage and the row shows up here.          */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchTrainings: vi.fn() }));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/projectArchive", () => ({ archiveProject: vi.fn() }));

import ProjectPicker from "./ProjectPicker";
import {
  beginSetupDraft,
  listSetupDrafts,
  readActiveSetupDraft,
  saveSetupDraft,
} from "@/lib/willab/setupDraft";
import type { TrainingArc } from "@/services/api/trainings";

const project: TrainingArc = {
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
};

function keepDraft(topic: string) {
  beginSetupDraft("owner-1");
  const id = readActiveSetupDraft("owner-1")!.id;
  saveSetupDraft("owner-1", id, {
    step: 2,
    topic,
    audience: "",
    desiredCallToAction: "",
    lengthSec: null,
    slides: [{ title: "", body: "" }],
    presentationRef: null,
    strategicContext: "",
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchTrainings.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const rowLabels = () =>
  Array.from(container.querySelectorAll("button"))
    .map((b) => b.textContent?.trim() ?? "")
    .filter((t) => t && !t.includes("Start"));

async function render(arcs: TrainingArc[], onResumeDraft = vi.fn()) {
  api.fetchTrainings.mockResolvedValue(arcs);
  act(() => root.render(createElement(ProjectPicker, {
    ownerId: "owner-1",
    onNewTopic: vi.fn(),
    onResumeDraft,
    onContinue: vi.fn(),
    onSkip: vi.fn(),
    onClose: vi.fn(),
  })));
  await flush();
  return onResumeDraft;
}

describe("setup drafts in the picker", () => {
  it("lists the draft first, marked Draft, above the projects", async () => {
    keepDraft("Investor update");
    await render([project]);
    expect(rowLabels()[0]).toBe("Investor updateDraft");
    expect(rowLabels()).toContain("Board pitch");
  });

  it("keeps the list for a draft even with no projects yet", async () => {
    keepDraft("Investor update");
    await render([]);
    expect(container.textContent).toContain("Start a new project");
    expect(container.textContent).not.toContain("Start your first project");
    expect(rowLabels()[0]).toBe("Investor updateDraft");
  });

  it("tapping the draft resumes it", async () => {
    keepDraft("Investor update");
    const onResume = await render([project]);
    const row = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Investor update"));
    act(() => row?.click());
    expect(onResume).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "Investor update", step: 2 })
    );
    expect(listSetupDrafts("owner-1")).toHaveLength(1);
  });
});
