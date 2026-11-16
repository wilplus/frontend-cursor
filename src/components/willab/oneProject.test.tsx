// @vitest-environment jsdom
/*
STORY    As a speaker, I want projects to stay concurrent, so opening or
         creating one never archives work in another.
OUTCOME  New-project actions start directly; an archived project is restored
         without archiving the current project.
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

import { useArchivedReturn, useNewProjectAsk } from "./OneProjectQuestion";

let root: Root;
let host: HTMLDivElement;

function NewProjectProbe({ onStart }: { onStart: () => void }) {
  const ask = useNewProjectAsk();
  return createElement("button", { onClick: () => ask.begin(onStart) }, "Start a new project");
}

function ArchivedProbe({ onGo }: { onGo: () => void }) {
  const result = useArchivedReturn("archived", { projectArchived: true });
  return createElement("button", { onClick: () => result.confirmFirst?.(onGo) }, "Record");
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.fetchTrainings.mockReset().mockResolvedValue([]);
  api.archiveProject.mockReset();
  api.unarchiveProject.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("concurrent projects", () => {
  it("starts a new project without asking to archive another", () => {
    const start = vi.fn();
    act(() => root.render(createElement(NewProjectProbe, { onStart: start })));
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    expect(start).toHaveBeenCalledTimes(1);
    expect(api.archiveProject).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("One project at a time");
  });

  it("restores an archived project without archiving the current one", async () => {
    const go = vi.fn();
    act(() => root.render(createElement(ArchivedProbe, { onGo: go })));
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    await Promise.resolve();
    expect(api.unarchiveProject).toHaveBeenCalledWith("archived");
    expect(api.archiveProject).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledTimes(1);
  });
});
