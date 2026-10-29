// @vitest-environment jsdom
/*
STORY    As a speaker, I want to work on one project at a time and be asked
         before I leave the current one, so that starting or going back to a
         project never mixes two presentations, and nothing is lost.
OUTCOME
  O1  "Start a new project" asks "One project at a time", naming the project
      with my newest Take; Continue archives that one, then starts the new
      project; Cancel leaves me on the list with nothing archived.
  O2  Picking another project asks the same; Continue archives the current
      one and opens the one I picked. Picking the current one asks nothing,
      and with no Take yet nothing is asked.
  O3  "Record Take N" on an archived project asks first; Continue brings it
      back, archives the current one, then records. On the current project
      it records at once, asking nothing (Never 3).
PROVES   O1 -> "Start a new project asks, and Continue archives the current one first"
         O2 -> "another project asks; the current one and a first project do not"
         O3 -> "Record Take N on an archived project asks; on the current one it never does"
WHY      Founder 2026-10-29, backend N254 (items 1, 2, 4, 5).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
  archiveProject: vi.fn(),
  unarchiveProject: vi.fn(),
}));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/projectArchive", () => ({
  archiveProject: api.archiveProject,
  unarchiveProject: api.unarchiveProject,
}));
vi.mock("@/lib/willab/setupDraft", () => ({
  listSetupDrafts: () => [],
  deleteSetupDraft: () => undefined,
}));
vi.mock("./NextTakeShareScreen", () => ({ default: () => null }));

import ProjectPicker from "./ProjectPicker";
import IdealTextActions from "./IdealTextActions";
import { useArchivedReturn } from "./OneProjectQuestion";
import type { TrainingArc } from "@/services/api/trainings";

function arc(arcId: string, topic: string, lastTakeAt: string | null): TrainingArc {
  return {
    arcId,
    topic,
    createdAt: null,
    takeCount: lastTakeAt ? 2 : 0,
    takes: [],
    batchVerified: false,
    idealReady: false,
    bestPresentationArcId: arcId,
    coverRef: null,
    deletion: null,
    archived: false,
    lastTakeAt,
  };
}
const BOARD = arc("arc-board", "Board pitch", "2026-10-28T10:00:00Z");
const TEAM = arc("arc-team", "Team update", "2026-10-20T10:00:00Z");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchTrainings.mockReset();
  api.archiveProject.mockReset().mockResolvedValue(true);
  api.unarchiveProject.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
const button = (label: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.trim() === label,
  );
const QUESTION = "One project at a time";
const BODY = "“Board pitch” will be archived. Its Takes and Ideal Text stay safe, and you can bring it back from Data & consent.";

async function picker(arcs: TrainingArc[]) {
  api.fetchTrainings.mockResolvedValue(arcs);
  const props = { onNewTopic: vi.fn(), onContinue: vi.fn() };
  act(() =>
    root.render(
      createElement(ProjectPicker, {
        ownerId: "owner-1",
        onResumeDraft: vi.fn(),
        onSkip: vi.fn(),
        onClose: vi.fn(),
        ...props,
      }),
    ),
  );
  await flush();
  return props;
}

describe("the \"+\" and its projects", () => {
  it("Start a new project asks, and Continue archives the current one first", async () => {
    const props = await picker([TEAM, BOARD]);
    await act(async () => button("Start a new project")?.click());
    expect(document.body.textContent).toContain(QUESTION);
    expect(document.body.textContent).toContain(BODY);

    await act(async () => button("Cancel")?.click());
    expect(document.body.textContent).not.toContain(QUESTION);
    expect(api.archiveProject).not.toHaveBeenCalled();
    expect(props.onNewTopic).not.toHaveBeenCalled();

    await act(async () => button("Start a new project")?.click());
    await act(async () => button("Continue")?.click());
    await flush();
    expect(api.archiveProject).toHaveBeenCalledWith("arc-board");
    expect(props.onNewTopic).toHaveBeenCalledTimes(1);
  });

  it("another project asks; the current one and a first project do not", async () => {
    const props = await picker([TEAM, BOARD]);
    await act(async () => button("Board pitch")?.click());
    expect(document.body.textContent).not.toContain(QUESTION);
    expect(props.onContinue).toHaveBeenCalledWith(BOARD);

    await act(async () => button("Team update")?.click());
    expect(document.body.textContent).toContain(BODY);
    await act(async () => button("Continue")?.click());
    await flush();
    expect(api.archiveProject).toHaveBeenCalledWith("arc-board");
    expect(props.onContinue).toHaveBeenLastCalledWith(TEAM);

    // No Take anywhere yet: nothing is current, nothing is asked.
    act(() => root.unmount());
    root = createRoot(container);
    const fresh = await picker([arc("arc-new", "Keynote", null)]);
    await act(async () => button("Start a new project")?.click());
    expect(document.body.textContent).not.toContain(QUESTION);
    expect(fresh.onNewTopic).toHaveBeenCalledTimes(1);
  });
});

describe("Record Take N on the Ideal Text page", () => {
  function Bottom({ archived, onNewTake }: { archived: boolean; onNewTake: () => void }) {
    const back = useArchivedReturn("arc-team", { projectArchived: archived });
    return createElement(
      "div",
      null,
      createElement(IdealTextActions, { takeCount: 0, onNewTake, confirmFirst: back.confirmFirst }),
      back.layer,
    );
  }

  it("Record Take N on an archived project asks; on the current one it never does", async () => {
    const onNewTake = vi.fn();
    act(() => root.render(createElement(Bottom, { archived: false, onNewTake })));
    await act(async () => button("Record the next take")?.click());
    expect(onNewTake).toHaveBeenCalledTimes(1);
    expect(api.fetchTrainings).not.toHaveBeenCalled();

    api.fetchTrainings.mockResolvedValue([BOARD]);
    act(() => root.render(createElement(Bottom, { archived: true, onNewTake })));
    await act(async () => button("Record the next take")?.click());
    await flush();
    expect(document.body.textContent).toContain(BODY);
    expect(onNewTake).toHaveBeenCalledTimes(1);

    await act(async () => button("Continue")?.click());
    await flush();
    expect(api.unarchiveProject).toHaveBeenCalledWith("arc-team");
    expect(api.archiveProject).toHaveBeenCalledWith("arc-board");
    expect(onNewTake).toHaveBeenCalledTimes(2);
  });
});
