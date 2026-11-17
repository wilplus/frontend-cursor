// @vitest-environment jsdom
/*
STORY    As a speaker, I want one speaking-coach home with all my active
         projects, so I can keep and practise projects concurrently.
OUTCOME  The home waits for the project index and Speaking coach state, then
         paints Speaking coach, every active project and Start a new project.
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
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { TrainingArc } from "@/services/api/trainings";

const api = vi.hoisted(() => ({ fetchTrainings: vi.fn(), takeTrainings: vi.fn() }));
const pdf = vi.hoisted(() => ({ page: vi.fn() }));
const thread = vi.hoisted(() => ({ loading: true, messages: [] as LoungeMessage[] }));
vi.mock("@/services/api/trainings", () => ({ fetchTrainings: api.fetchTrainings }));
vi.mock("@/services/api/bootPrefetch", () => ({ takeTrainings: api.takeTrainings }));
vi.mock("../LoungeThreadContext", () => ({ useLoungeThreadMaybe: () => thread }));
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
  practiceProgress: 0,
  practiceChunks: [],
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
  thread.loading = true;
  api.fetchTrainings.mockReset();
  api.takeTrainings.mockReset().mockImplementation(() => api.fetchTrainings());
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

  it("keeps a deckless project's palette background stable across renders", async () => {
    api.fetchTrainings.mockResolvedValue([arc("stable-project", "Board pitch")]);
    thread.loading = false;
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
    thread.loading = false;
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
    thread.loading = false;
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
    thread.loading = false;
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
    thread.loading = false;

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
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Wczytywanie");
    await flush();
    expect(host.textContent).toContain("Trener wystąpień");
    expect(host.textContent).toContain("English board pitch");
  });

  it("propagates a manual locale choice through an already-mounted screen", async () => {
    api.fetchTrainings.mockResolvedValue([arc("a", "English board pitch")]);
    thread.loading = false;

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
