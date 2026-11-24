// @vitest-environment jsdom
/*
STORY    As a speaker, I want one speaking-coach home with all my active
         projects, so I can keep and practise projects concurrently.
OUTCOME  The home paints Speaking coach and Start a new project immediately,
         then fills the stable project-index slot without blocking the shell.
         Polish app UI localises the fixed rows without translating project names.
PROVES   Opening a project is a local navigation callback; it never archives
         another project; the locale test keeps user-authored names byte-for-byte.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import UiLocaleProvider from "@/components/ui/UiLocaleProvider";
import { UI_LOCALE_STORAGE_KEY } from "@/lib/uiLocale";
import type { TrainingArc } from "@/services/api/trainings";

const api = vi.hoisted(() => ({
  fetchTrainings: vi.fn(),
  takeTrainings: vi.fn(),
  archiveProject: vi.fn(),
  requestProjectDeletion: vi.fn(),
  renameProject: vi.fn(),
}));
const pdf = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/bootPrefetch", () => ({ takeTrainings: api.takeTrainings }));
vi.mock("@/services/api/projectArchive", () => ({ archiveProject: api.archiveProject }));
vi.mock("@/services/api/projectDeletion", () => ({ requestProjectDeletion: api.requestProjectDeletion }));
vi.mock("@/services/api/projectRename", () => ({ renameProject: api.renameProject }));
vi.mock("../pdfSlides", () => ({
  PdfPage: (props: { url: string; pageIndex: number }) => {
    pdf.page(props);
    return createElement("canvas", {
      "data-pdf-page": String(props.pageIndex),
      "data-pdf-url": props.url,
    });
  },
}));

import ProductHome from "./ProductHome";
import { publishProjectTrainings } from "@/lib/willab/projectTrainings";

const arc = (
  arcId: string,
  topic: string,
  archived = false,
  coverRef: string | null = null,
): TrainingArc => ({
  arcId,
  topic,
  createdAt: null,
  takeCount: 0,
  takes: [],
  batchVerified: false,
  idealReady: false,
  bestPresentationArcId: arcId,
  coverRef,
  deletion: null,
  archived,
});

let root: Root;
let host: HTMLDivElement;
let intersectionCallback: IntersectionObserverCallback | null;
const observe = vi.fn();

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  observe(target: Element): void {
    observe(target);
  }

  disconnect(): void {}
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.fetchTrainings.mockReset();
  api.takeTrainings.mockReset().mockImplementation(() => api.fetchTrainings());
  api.archiveProject.mockReset();
  api.requestProjectDeletion.mockReset();
  api.renameProject.mockReset();
  pdf.page.mockReset();
  intersectionCallback = null;
  observe.mockReset();
  localStorage.clear();
  document.documentElement.lang = "en";
  delete document.documentElement.dataset.uiLocale;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  document.documentElement.lang = "";
  delete document.documentElement.dataset.uiLocale;
});

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((item) => item.textContent?.trim() === label || item.getAttribute("aria-label") === label);
}

async function renderHome(projects: TrainingArc[]) {
  api.fetchTrainings.mockResolvedValue(projects);
  act(() => root.render(createElement(ProductHome, {
    onOpenSpeaking: vi.fn(),
    onOpenProject: vi.fn(),
    onStartNewProject: vi.fn(),
  })));
  await flush();
}

describe("Speaking coach home", () => {
  it("opens a finished recording from the sidebar before its project is listed", async () => {
    api.fetchTrainings.mockResolvedValue([]);
    const onOpenPendingProject = vi.fn();
    const pending = { key: "upload-a", ownerId: "speaker", projectId: null,
      topic: "Board pitch", takeIndex: 1, startedAt: Date.now() };
    act(() => root.render(createElement(ProductHome, {
      activeChat: "pending:upload-a",
      pendingProjects: [pending],
      onOpenPendingProject,
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    const row = host.querySelector<HTMLButtonElement>('[data-chat-row="pending:upload-a"]');
    expect(row?.getAttribute("aria-current")).toBe("page");
    act(() => row?.click());
    expect(onOpenPendingProject).toHaveBeenCalledWith(pending);
    await flush();

    act(() => publishProjectTrainings([{ ...arc("actual-project", pending.topic), takes: [
      { sessionId: "take-a", takeIndex: 1, createdAt: null, hasSlides: false,
        feedbackAvailable: false, uploadKey: pending.key },
    ] }]));
    expect(host.querySelector('[data-chat-row="pending:upload-a"]')).toBeNull();
    expect(host.querySelector('[data-chat-row="actual-project"]')).not.toBeNull();
  });

  it("keeps the shell and primary action usable while projects load", async () => {
    let resolve: (value: TrainingArc[]) => void = () => undefined;
    const projects = new Promise<TrainingArc[]>((done) => { resolve = done; });
    api.fetchTrainings.mockReturnValue(projects);
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    expect(host.querySelector("[data-product-home-loading]")).toBeNull();
    expect(host.textContent).toContain("Speaking coach");
    expect(host.querySelector("[data-product-projects-loading]")).not.toBeNull();
    expect(host.querySelector("[data-start-new-project]")).not.toBeNull();
    expect(host.textContent).not.toContain("Board pitch");

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
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: open,
      onStartNewProject: vi.fn(),
    })));
    await flush();
    await act(async () => (host.querySelector('[data-home-row="b"] button') as HTMLButtonElement).click());
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ arcId: "b" }));
  });

  it("keeps project controls within the coach group and floats the menu above the sidebar", async () => {
    await renderHome([arc("a", "Board pitch")]);

    const projectButton = host.querySelector('[data-chat-row="a"]');
    expect(projectButton?.closest("[data-product-projects]")).not.toBeNull();
    expect(button("More options for Speaking coach")).toBeUndefined();
    expect(button("More options for Board pitch")).toBeDefined();
    expect(button("More options for Board pitch")?.parentElement?.parentElement?.classList.contains("isolate"))
      .toBe(false);

    await act(async () => button("More options for Board pitch")?.click());
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    expect(menu?.parentElement).toBe(document.body);
    expect(host.contains(menu)).toBe(false);
  });

  it("archives only the selected project and removes it without a reload", async () => {
    api.archiveProject.mockResolvedValue(true);
    await renderHome([arc("a", "Board pitch"), arc("b", "Team update")]);

    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Archive")?.click());
    await flush();

    expect(api.archiveProject).toHaveBeenCalledWith("a");
    expect(host.querySelector('[data-chat-row="a"]')).toBeNull();
    expect(host.querySelector('[data-chat-row="b"]')).not.toBeNull();
  });

  it("renames the selected project in place after the server accepts it", async () => {
    api.renameProject.mockResolvedValue("Customer keynote");
    await renderHome([arc("a", "Board pitch")]);

    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Edit")?.click());
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Edit Board pitch"]');
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "Customer keynote");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Edit")?.click());
    await flush();

    expect(api.renameProject).toHaveBeenCalledWith("a", "Customer keynote");
    expect(host.textContent).toContain("Customer keynote");
    expect(host.textContent).not.toContain("Board pitch");
  });

  it("keeps rename pending in the row and shows success before closing it", async () => {
    let resolveRename: (name: string | null) => void = () => undefined;
    api.renameProject.mockReturnValue(new Promise<string | null>((resolve) => { resolveRename = resolve; }));
    await renderHome([arc("a", "Board pitch")]);

    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Edit")?.click());
    const input = host.querySelector<HTMLInputElement>("[data-project-name-input]");
    expect(input).not.toBeNull();
    await act(async () => button("Edit")?.click());
    expect(input?.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading");

    await act(async () => resolveRename("Customer keynote"));
    await flush();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Saved");
    expect(host.textContent).toContain("Customer keynote");
  });

  it("keeps the inline editor and shows the server error", async () => {
    api.renameProject.mockResolvedValue(null);
    await renderHome([arc("a", "Board pitch")]);

    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Edit")?.click());
    await act(async () => button("Edit")?.click());
    await flush();

    expect(host.querySelector("[data-project-edit-row]")).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Couldn't edit. Try again.");
  });

  it("keeps the project row and announces an archive failure", async () => {
    api.archiveProject.mockResolvedValue(false);
    await renderHome([arc("a", "Board pitch")]);

    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Archive")?.click());
    await flush();

    expect(host.querySelector('[data-chat-row="a"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Couldn't archive. Try again.");
  });

  it("requires confirmation and locks a project after a successful delete request", async () => {
    api.requestProjectDeletion.mockResolvedValue({
      ok: true,
      deletion: { state: "pending", dueAt: null, cancellable: true },
    });
    await renderHome([arc("a", "Board pitch")]);

    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Delete")?.click());
    expect(api.requestProjectDeletion).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Delete "Board pitch"?');

    await act(async () => button("Request deletion")?.click());
    await flush();

    expect(api.requestProjectDeletion).toHaveBeenCalledWith("a");
    expect(host.textContent).toContain("Deletion pending");
    expect(button("More options for Board pitch")).toBeUndefined();
    expect((host.querySelector('[data-chat-row="a"]') as HTMLButtonElement | null)?.disabled).toBe(true);
  });

  it("keeps a failed deletion visible and usable after showing the error", async () => {
    let finishRequest: (result: { ok: false; deletion: null }) => void = () => undefined;
    api.requestProjectDeletion.mockReturnValue(new Promise((resolve) => {
      finishRequest = resolve;
    }));
    const open = vi.fn();
    api.fetchTrainings.mockResolvedValue([arc("a", "Board pitch")]);
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: open,
      onStartNewProject: vi.fn(),
    })));
    await flush();

    await act(async () => button("More options for Board pitch")?.click());
    await act(async () => button("Delete")?.click());
    await act(async () => button("Request deletion")?.click());

    expect(host.querySelector('[data-chat-row="a"]')).not.toBeNull();
    await act(async () => finishRequest({ ok: false, deletion: null }));

    expect(host.querySelector('[data-chat-row="a"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Couldn't delete. Try again.");
    expect(button("Request deletion")).toBeUndefined();
    const projectRow = host.querySelector<HTMLButtonElement>('[data-chat-row="a"]');
    expect(projectRow?.disabled).toBe(false);
    await act(async () => projectRow?.click());
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ arcId: "a" }));
  });

  it("does not expose management actions for a project already pending deletion", async () => {
    await renderHome([
      Object.assign(arc("a", "Board pitch"), {
        deletion: { state: "pending", dueAt: null, cancellable: true },
      }),
    ]);

    expect(host.textContent).toContain("Deletion pending");
    expect(button("More options for Board pitch")).toBeUndefined();
    expect((host.querySelector('[data-chat-row="a"]') as HTMLButtonElement | null)?.disabled).toBe(true);
  });

  it("keeps a deckless project's palette background stable across renders", async () => {
    api.fetchTrainings.mockResolvedValue([arc("stable-project", "Board pitch")]);
    const props = {
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    };
    act(() => root.render(createElement(ProductHome, props)));
    await flush();

    const first = host.querySelector<HTMLElement>('[data-project-icon="stable-project"]');
    expect(first?.dataset.projectIconSource).toBe("palette");
    const firstTone = first?.style.backgroundColor;
    expect([
      "rgb(36, 79, 197)",
      "rgb(255, 106, 20)",
      "rgb(232, 163, 23)",
    ]).toContain(firstTone);
    expect(pdf.page).not.toHaveBeenCalled();

    act(() => root.render(createElement(ProductHome, { ...props })));
    const second = host.querySelector<HTMLElement>('[data-project-icon="stable-project"]');
    expect(second?.style.backgroundColor).toBe(firstTone);
  });

  it("does not mount a deck preview until its project icon enters the viewport", async () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const coverRef = "https://slides.example.test/board-pitch.pdf";
    api.fetchTrainings.mockResolvedValue([
      arc("deck-project", "Board pitch", false, coverRef),
    ]);
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    await flush();
    const icon = host.querySelector<HTMLElement>('[data-project-icon="deck-project"]');
    expect(icon?.dataset.projectIconSource).toBe("slide");
    expect(icon?.style.backgroundColor).toMatch(/^rgb\(/);
    expect(observe).toHaveBeenCalledWith(icon);
    expect(pdf.page).not.toHaveBeenCalled();

    await act(async () => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });

    expect(icon?.querySelector(
      '[data-pdf-url="https://slides.example.test/board-pitch.pdf"][data-pdf-page="0"]',
    )).not.toBeNull();
    expect(pdf.page).toHaveBeenCalledWith(expect.objectContaining({
      url: coverRef,
      pageIndex: 0,
    }));
  });

  it("loads page one when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const coverRef = "https://slides.example.test/no-observer.pdf";
    api.fetchTrainings.mockResolvedValue([
      arc("fallback-project", "Team update", false, coverRef),
    ]);
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    await flush();

    expect(pdf.page).toHaveBeenCalledWith(expect.objectContaining({
      url: coverRef,
      pageIndex: 0,
    }));
  });

  it("uses Polish fixed navigation while leaving project names unchanged", async () => {
    document.documentElement.lang = "pl";
    api.fetchTrainings.mockResolvedValue([arc("a", "English board pitch")]);
    act(() => root.render(createElement(ProductHome, {
      onOpenSpeaking: vi.fn(),
      onOpenProject: vi.fn(),
      onStartNewProject: vi.fn(),
    })));
    await flush();

    expect(host.textContent).toContain("Trener wystąpień");
    expect(host.textContent).toContain("Rozpocznij nowy projekt");
    expect(host.textContent).toContain("English board pitch");
    expect(host.textContent).not.toContain("Start a new project");
  });

  it("uses the server-resolved locale on the first mounted render", async () => {
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, "en");
    api.fetchTrainings.mockResolvedValue([arc("a", "English board pitch")]);

    act(() => root.render(
      createElement(
        UiLocaleProvider,
        { initialLocale: "pl" },
        createElement(LocaleSwitcher),
        createElement(ProductHome, {
          onOpenSpeaking: vi.fn(),
          onOpenProject: vi.fn(),
          onStartNewProject: vi.fn(),
        }),
      ),
    ));

    expect(host.querySelector('[aria-label="Use Polish"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Szukamy Twoich projektów…");
    await flush();
    expect(host.textContent).toContain("Trener wystąpień");
    expect(host.textContent).toContain("English board pitch");
  });

  it("propagates a manual locale choice through an already-mounted screen", async () => {
    api.fetchTrainings.mockResolvedValue([arc("a", "English board pitch")]);

    act(() => root.render(
      createElement(
        UiLocaleProvider,
        { initialLocale: "en" },
        createElement(LocaleSwitcher),
        createElement(ProductHome, {
          onOpenSpeaking: vi.fn(),
          onOpenProject: vi.fn(),
          onStartNewProject: vi.fn(),
        }),
      ),
    ));
    await flush();
    const mountedHome = host.querySelector("[data-product-home]");
    expect(host.textContent).toContain("Speaking coach");

    act(() => (host.querySelector('[aria-label="Use Polish"]') as HTMLButtonElement).click());

    expect(host.querySelector("[data-product-home]")).toBe(mountedHome);
    expect(host.textContent).toContain("Trener wystąpień");
    expect(host.textContent).toContain("Rozpocznij nowy projekt");
    expect(host.textContent).toContain("English board pitch");
    expect(localStorage.getItem(UI_LOCALE_STORAGE_KEY)).toBe("pl");
    expect(document.documentElement.lang).toBe("pl");
    expect(document.documentElement.dataset.uiLocale).toBe("pl");
  });
});
