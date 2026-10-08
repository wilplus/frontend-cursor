// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  "YOUR PROJECTS": THE EMPTY, LOADING AND FAILED STATES (build plan D-CS-8). */
/*                                                                            */
/*  With zero projects the card shows the founder-signed "No projects yet."   */
/*  (Q-B15 A (10), N62/N63) under the h2, where the list would be — never a   */
/*  blank card. Still loading it shows the voice mark (founder 2026-10-07:    */
/*  "your projects is empty, and I do have projects!"); a failed read says so */
/*  with Try again.                                                           */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
  fetchTrainingConsent: vi.fn(),
}));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/trainingConsent", () => ({ fetchTrainingConsent: api.fetchTrainingConsent }));
vi.mock("@/services/api/projectArchive", () => ({ unarchiveProject: vi.fn() }));
vi.mock("@/services/api/projectDeletion", () => ({
  requestProjectDeletion: vi.fn(),
  cancelProjectDeletion: vi.fn(),
}));

import ProjectsCard from "./ProjectsCard";
import { PROJECT_ARCHIVE_COPY } from "@/lib/willab/projectArchiveCopy";
import { PROJECT_DELETE_ENABLED } from "@/lib/willab/projectDeletionCopy";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.fetchTrainings.mockReset();
  api.fetchTrainingConsent.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () =>
  act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });

async function open() {
  act(() => root.render(createElement(ProjectsCard)));
  const opener = host.querySelector("button") as HTMLButtonElement;
  expect(opener.textContent).toBe(PROJECT_DELETE_ENABLED ? "Delete a project" : "Your projects");
  await act(async () => opener.click());
}

describe("the signed words", () => {
  it("are 'No projects yet.'", () => {
    expect(PROJECT_ARCHIVE_COPY.empty).toBe("No projects yet.");
  });
});

describe("the open card", () => {
  it("with zero projects: the h2, then the signed line 12px below it", async () => {
    api.fetchTrainings.mockResolvedValue([]);
    await open();
    await flush();
    const h2 = host.querySelector("h2") as HTMLElement;
    expect(h2.textContent).toBe("Your projects");
    const line = h2.nextElementSibling as HTMLElement;
    expect(line.tagName).toBe("P");
    expect(line.textContent).toBe("No projects yet.");
    expect(line.className).toContain("mt-3");
    expect(host.querySelector("ul")).toBeNull();
    expect(host.querySelector("[data-voice-mark]")).toBeNull();
  });

  it("while loading: the voice mark, no line, no list", async () => {
    api.fetchTrainings.mockReturnValue(new Promise(() => undefined));
    await open();
    expect(host.querySelector("h2")?.textContent).toBe("Your projects");
    expect(host.querySelector("[data-voice-mark]")).not.toBeNull();
    expect(host.textContent).not.toContain("No projects yet.");
    expect(host.querySelector("ul")).toBeNull();
  });

  it("when the read failed: says so with Try again, and never the empty line", async () => {
    api.fetchTrainings.mockResolvedValue(null);
    await open();
    await flush();
    const alert = host.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain("Couldn't load your projects.");
    expect(alert.querySelector("button")?.textContent).toBe("Try again");
    expect(host.textContent).not.toContain("No projects yet.");
    expect(host.querySelector("[data-voice-mark]")).toBeNull();
  });

  it("with projects: the list, and no empty line", async () => {
    api.fetchTrainings.mockResolvedValue([
      { arcId: "a", topic: "Board pitch", createdAt: null, takeCount: 1, takes: [],
        batchVerified: false, idealReady: false, bestPresentationArcId: "a", coverRef: null,
        deletion: null, archived: false },
    ]);
    await open();
    await flush();
    expect(host.querySelectorAll("li").length).toBe(1);
    expect(host.textContent).not.toContain("No projects yet.");
  });

  it("a project with a blank topic counts as none", async () => {
    api.fetchTrainings.mockResolvedValue([
      { arcId: "a", topic: "   ", createdAt: null, takeCount: 1, takes: [],
        batchVerified: false, idealReady: false, bestPresentationArcId: "a", coverRef: null,
        deletion: null, archived: false },
    ]);
    await open();
    await flush();
    expect(host.textContent).toContain("No projects yet.");
  });
});
