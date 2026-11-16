// @vitest-environment jsdom
/*
STORY    As a speaker, I want one speaking-coach home with all my active
         projects, so I can keep and practise projects concurrently.
OUTCOME  The home waits for the project index and Speaking coach state, then
         paints Speaking coach, every active project and Start a new project.
PROVES   Opening a project is a local navigation callback; it never archives
         another project.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { TrainingArc } from "@/services/api/trainings";

const api = vi.hoisted(() => ({ fetchTrainings: vi.fn() }));
const thread = vi.hoisted(() => ({ loading: true, messages: [] as LoungeMessage[] }));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("../LoungeThreadContext", () => ({ useLoungeThreadMaybe: () => thread }));

import ProductHome from "./ProductHome";

const arc = (arcId: string, topic: string, archived = false): TrainingArc => ({
  arcId,
  topic,
  createdAt: null,
  takeCount: 0,
  takes: [],
  batchVerified: false,
  idealReady: false,
  bestPresentationArcId: arcId,
  coverRef: null,
  deletion: null,
  archived,
  practiceProgress: 0,
  practiceChunks: [],
});

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  thread.loading = true;
  api.fetchTrainings.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

describe("Speaking coach home", () => {
  it("waits for both sources and paints only active projects", async () => {
    let resolve: (value: TrainingArc[]) => void = () => undefined;
    const projects = new Promise<TrainingArc[]>((done) => { resolve = done; });
    api.fetchTrainings.mockReturnValue(projects);
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    expect(host.querySelector("[data-product-home-loading]")).not.toBeNull();

    thread.loading = false;
    await act(async () => resolve([arc("a", "Board pitch"), arc("b", "Team update"), arc("old", "Old", true)]));
    await flush();
    expect(host.textContent).toContain("Speaking coach");
    expect(host.textContent).toContain("Board pitch");
    expect(host.textContent).toContain("Team update");
    expect(host.textContent).not.toContain("Old");
    expect(host.textContent).toContain("Start a new project");
    expect(host.querySelector("[data-add-someone]")).toBeNull();
  });

  it("opens projects without an archive side effect", async () => {
    const open = vi.fn();
    api.fetchTrainings.mockResolvedValue([arc("a", "Board pitch"), arc("b", "Team update")]);
    thread.loading = false;
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: open,
      onStartNewProject: vi.fn(),
    })));
    await flush();
    await act(async () => (host.querySelector('[data-home-row="b"] button') as HTMLButtonElement).click());
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ arcId: "b" }));
  });
});
