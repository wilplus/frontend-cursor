// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  FOUNDER 2026-09-25 — the coach names the error on a moment, and attaching */
/*  an exercise teaches the library, with undo.                               */
/*                                                                            */
/*  Pinned here:                                                              */
/*    1. the payload's names and teachings are read, junk dropped, and an     */
/*       older backend that sends neither still maps;                         */
/*    2. naming, withdrawing and undoing call the right addresses, and a      */
/*       failure says so instead of pretending it worked;                     */
/*    3. a new error whose name is already in the library is NAMED, never     */
/*       re-filed over someone else's entry;                                  */
/*    4. retired entries are never offered, and a teaching shows the          */
/*       exercise's name, not its id.                                         */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  nameMomentError: vi.fn(),
  undoLibraryTeaching: vi.fn(),
  listSpeakingErrors: vi.fn(),
  saveSpeakingError: vi.fn(),
}));

vi.mock("@/services/api/coachConfidencePractice", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/services/api/coachConfidencePractice")
  >();
  return {
    ...actual,
    nameMomentError: services.nameMomentError,
    undoLibraryTeaching: services.undoLibraryTeaching,
  };
});

vi.mock("@/services/api/speakingErrors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api/speakingErrors")>();
  return {
    ...actual,
    listSpeakingErrors: services.listSpeakingErrors,
    saveSpeakingError: services.saveSpeakingError,
  };
});

import {
  LibraryTeachings,
  MOMENT_ERRORS_COPY,
  MomentErrors,
  exerciseTitle,
  fileOrReuse,
  namableErrors,
} from "./coachMomentErrors";
import {
  mapCoachConfidencePractice,
  type CoachConfidencePractice,
} from "@/services/api/coachConfidencePractice";
import type { SpeakingError } from "@/services/api/speakingErrors";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const RAW = {
  id: "p1",
  exact_passage: "and that is why we ship",
  exercise: {
    exercise_id: "land-it",
    title: "Land the last three words",
    instruction: "Slow down on the final three words.",
  },
  available_exercises: [
    { exercise_id: "one-breath", title: "One breath per sentence", instruction: "" },
  ],
  attempts: [],
};

function practice(extra: Record<string, unknown> = {}): CoachConfidencePractice {
  const mapped = mapCoachConfidencePractice({ ...RAW, ...extra });
  if (!mapped) throw new Error("fixture did not map");
  return mapped;
}

function entry(errorId: string, over: Partial<SpeakingError> = {}): SpeakingError {
  return {
    errorId,
    label: errorId.replace(/_/g, " "),
    definition: "What is measured.",
    asks: "One question?",
    status: "observed",
    detectorRef: null,
    observedBy: null,
    active: true,
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(services).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = () => act(async () => { await Promise.resolve(); });
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === text || b.getAttribute("aria-label") === text,
  );

/* ── the payload ────────────────────────────────────────────────────────── */

describe("mapCoachConfidencePractice", () => {
  it("reads the coach's names and the library teachings", () => {
    const p = practice({
      named_errors: [
        { error_id: "rushing", label: "Rushing" },
        { error_id: "", label: "junk" },
        "junk",
        { error_id: "no_label" },
      ],
      library_teachings: [
        { teaching_id: "t1", exercise_id: "land-it", error_id: "rushing", error_label: "Rushing" },
        { teaching_id: "t2", exercise_id: "land-it" },
      ],
    });
    expect(p.namedErrors).toEqual([
      { errorId: "rushing", label: "Rushing" },
      { errorId: "no_label", label: "no_label" },
    ]);
    expect(p.libraryTeachings).toEqual([
      { teachingId: "t1", exerciseId: "land-it", errorId: "rushing", errorLabel: "Rushing" },
    ]);
  });

  it("still maps a practice from a backend that sends neither", () => {
    const p = practice();
    expect(p.namedErrors).toEqual([]);
    expect(p.libraryTeachings).toEqual([]);
  });
});

/* ── the calls ──────────────────────────────────────────────────────────── */

describe("the client calls", () => {
  it("name and undo are one PATCH each on this moment's review", async () => {
    const actual = await vi.importActual<
      typeof import("@/services/api/coachConfidencePractice")
    >("@/services/api/coachConfidencePractice");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ practice: RAW }),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await actual.nameMomentError("s 1", "sn/2", "rushing", true);
      await actual.undoLibraryTeaching("s 1", "sn/2", "t1");
    } finally {
      vi.unstubAllGlobals();
    }
    const base = "/api/v2/coach/sessions/s%201/snippets/sn%2F2/confidence-practice";
    expect(fetchMock.mock.calls[0][0]).toBe(base);
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name_error: { error_id: "rushing", named: true },
    });
    expect(fetchMock.mock.calls[1][0]).toBe(base);
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      undo_teaching: "t1",
    });
  });

  it("the review's BFF route forwards a PATCH to the backend", () => {
    const route = read(
      "app/api/v2/coach/sessions/[sessionId]/snippets/[snippetId]/confidence-practice/route.ts",
    );
    expect(route).toContain("export async function PATCH(");
    expect(route).toContain('method: "PATCH"');
  });
});

/* ── naming ─────────────────────────────────────────────────────────────── */

describe("namableErrors", () => {
  it("offers live entries not yet named, never retired ones", () => {
    const library = [entry("rushing"), entry("mumble"), entry("old", { active: false })];
    expect(
      namableErrors(library, [{ errorId: "rushing", label: "Rushing" }]).map((e) => e.errorId),
    ).toEqual(["mumble"]);
  });
});

describe("fileOrReuse", () => {
  it("names an entry that already exists instead of filing over it", async () => {
    const result = await fileOrReuse(
      { label: "Trailing mumble", definition: "", asks: "" },
      [entry("trailing_mumble")],
    );
    expect(result).toEqual({ ok: true, errorId: "trailing_mumble" });
    expect(services.saveSpeakingError).not.toHaveBeenCalled();
  });

  it("refuses an incomplete draft with the Errors page's own sentence", async () => {
    const result = await fileOrReuse({ label: "New thing", definition: "", asks: "" }, []);
    expect(result.ok).toBe(false);
    expect(services.saveSpeakingError).not.toHaveBeenCalled();
  });

  it("files a new one and hands back its id", async () => {
    services.saveSpeakingError.mockResolvedValue({
      ok: true,
      data: entry("trailing_mumble"),
    });
    const result = await fileOrReuse(
      { label: "Trailing mumble", definition: "Volume drops.", asks: "Carried?" },
      [],
    );
    expect(result).toEqual({ ok: true, errorId: "trailing_mumble" });
    expect(services.saveSpeakingError).toHaveBeenCalledWith(
      expect.objectContaining({ errorId: "trailing_mumble", label: "Trailing mumble" }),
    );
  });
});

describe("MomentErrors", () => {
  const render = (named: CoachConfidencePractice["namedErrors"], onPractice = vi.fn()) => {
    act(() =>
      root.render(
        createElement(MomentErrors, { sessionId: "s1", snippetId: "sn1", named, onPractice }),
      ),
    );
    return onPractice;
  };

  it("shows what the coach named, and withdraws one", async () => {
    const updated = practice();
    services.nameMomentError.mockResolvedValue(updated);
    const onPractice = render([{ errorId: "rushing", label: "Rushing" }]);
    expect(container.textContent).toContain("Rushing");
    await act(async () => button(MOMENT_ERRORS_COPY.remove("Rushing"))?.click());
    expect(services.nameMomentError).toHaveBeenCalledWith("s1", "sn1", "rushing", false);
    expect(onPractice).toHaveBeenCalledWith(updated);
  });

  it("names one from the library", async () => {
    services.listSpeakingErrors.mockResolvedValue({
      ok: true,
      data: [entry("rushing", { label: "Rushing" }), entry("old", { active: false, label: "Old" })],
    });
    const updated = practice();
    services.nameMomentError.mockResolvedValue(updated);
    const onPractice = render([]);
    await act(async () => button(MOMENT_ERRORS_COPY.nameOne)?.click());
    await flush();
    expect(button("Old")).toBeUndefined();
    await act(async () => button("Rushing")?.click());
    expect(services.nameMomentError).toHaveBeenCalledWith("s1", "sn1", "rushing", true);
    expect(onPractice).toHaveBeenCalledWith(updated);
  });

  it("says so when naming fails, and changes nothing", async () => {
    services.nameMomentError.mockResolvedValue(null);
    const onPractice = render([{ errorId: "rushing", label: "Rushing" }]);
    await act(async () => button(MOMENT_ERRORS_COPY.remove("Rushing"))?.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      MOMENT_ERRORS_COPY.failed,
    );
    expect(onPractice).not.toHaveBeenCalled();
  });
});

/* ── teaching ───────────────────────────────────────────────────────────── */

describe("LibraryTeachings", () => {
  const taught = practice({
    library_teachings: [
      { teaching_id: "t1", exercise_id: "land-it", error_id: "rushing", error_label: "Rushing" },
    ],
  });

  const render = (p: CoachConfidencePractice, onPractice = vi.fn()) => {
    act(() =>
      root.render(
        createElement(LibraryTeachings, {
          sessionId: "s1",
          snippetId: "sn1",
          practice: p,
          onPractice,
        }),
      ),
    );
    return onPractice;
  };

  it("tells the coach what the library learned, by the exercise's name", () => {
    render(taught);
    expect(container.textContent).toContain(
      MOMENT_ERRORS_COPY.taught("Land the last three words", "Rushing"),
    );
  });

  it("undoes it on this moment", async () => {
    const updated = practice();
    services.undoLibraryTeaching.mockResolvedValue(updated);
    const onPractice = render(taught);
    await act(async () => button(MOMENT_ERRORS_COPY.undo)?.click());
    expect(services.undoLibraryTeaching).toHaveBeenCalledWith("s1", "sn1", "t1");
    expect(onPractice).toHaveBeenCalledWith(updated);
  });

  it("says so when the undo fails", async () => {
    services.undoLibraryTeaching.mockResolvedValue(null);
    const onPractice = render(taught);
    await act(async () => button(MOMENT_ERRORS_COPY.undo)?.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      MOMENT_ERRORS_COPY.undoFailed,
    );
    expect(onPractice).not.toHaveBeenCalled();
  });

  it("shows nothing when nothing was taught", () => {
    render(practice());
    expect(container.textContent).toBe("");
  });
});

describe("exerciseTitle", () => {
  it("prefers the name, and falls back to the id only if it is gone", () => {
    const p = practice();
    expect(exerciseTitle(p, "one-breath")).toBe("One breath per sentence");
    expect(exerciseTitle(p, "land-it")).toBe("Land the last three words");
    expect(exerciseTitle(p, "retired-one")).toBe("retired-one");
  });
});

describe("the sheet", () => {
  it("hosts both, with its own practice setter", () => {
    const sheet = read("components/willab/CoachConfidencePracticeReview.tsx");
    expect(sheet).toContain("<MomentErrors");
    expect(sheet).toContain("<LibraryTeachings");
    expect(sheet.match(/onPractice=\{setPractice\}/g)).toHaveLength(2);
  });
});
