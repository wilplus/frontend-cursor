// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE ARC ROW SAYS WHETHER IT WENT OUT.                                      */
/*                                                                            */
/*  Founder 2026-09-24: "when feedback sent; change the state to sent from     */
/*  open to sent".                                                            */
/*                                                                            */
/*  Per-take `review_state` already carried this — the backend sets            */
/*  "delivered" the moment `results_published_at` lands — and the roster chip  */
/*  reads it. The arc row on this screen was the one place that ignored it, so */
/*  a finished project sat in the coach's list reading Open for ever, looking  */
/*  exactly like one with work waiting.                                       */
/*                                                                            */
/*  EVERY TAKE, NOT SOME. A take recorded after a delivery is real work, and   */
/*  an arc calling itself Sent while carrying one would hide that take rather  */
/*  than surface it. The asymmetry is deliberate: Open on a finished arc costs */
/*  a look, Sent on an unfinished one costs a student.                        */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchCoachStudentDetail = vi.fn();
vi.mock("@/services/api/coachStudentDetail", async (load) => {
  const actual = await load<typeof import("@/services/api/coachStudentDetail")>();
  return { ...actual, fetchCoachStudentDetail: (id: string) => fetchCoachStudentDetail(id) };
});

import StudentDetailOverlay from "./StudentDetailOverlay";
import type { ReviewState } from "@/services/api/coachStudentDetail";

/** One arc, `states` takes deep. */
function detail(states: (ReviewState | null)[]) {
  return {
    pseudonym: "Playful Finch",
    domain: "public_speaking",
    goal: "Chilling",
    previousGoal: null,
    goalChangedAt: null,
    sessions: states.map((reviewState, i) => ({
      sessionId: `take-${i + 1}`,
      topic: "Book",
      createdAt: "2026-09-20T10:00:00Z",
      state: "done",
      feeling: null,
      reviewState,
      arcId: "arc-1",
      arcIdealReady: false,
    })),
  };
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  fetchCoachStudentDetail.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mount(states: (ReviewState | null)[]) {
  fetchCoachStudentDetail.mockResolvedValue(detail(states));
  await act(async () => {
    root.render(
      createElement(StudentDetailOverlay, {
        userId: "u1",
        onClose: () => {},
        onOpenReview: () => {},
        // The arc rows only render when the host threads an opener.
        onOpenStarVerdicts: () => {},
      }),
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** The arc row's trailing state word. */
function rowState(): string | null {
  const row = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes("Review"),
  );
  if (!row) return null;
  const text = (row.textContent ?? "").trim();
  if (text.endsWith("Sent")) return "Sent";
  if (text.endsWith("Open")) return "Open";
  return text;
}

describe("the arc row reports whether the analysis went out", () => {
  it("reads Sent once every take is delivered", async () => {
    await mount(["delivered", "delivered"]);
    expect(rowState()).toBe("Sent");
  });

  it("reads Open while a take is still to review", async () => {
    await mount(["delivered", "to_review"]);
    expect(rowState()).toBe("Open");
  });

  it("reads Open when a take is saved but not published", async () => {
    // "Saved feedback means REVIEWED" — reviewed is not delivered, and the
    // student has had nothing yet.
    await mount(["reviewed"]);
    expect(rowState()).toBe("Open");
  });

  it("reads Open on an older payload that cannot claim delivery", async () => {
    // `review_state` is null on payloads from before the field existed. It is
    // not evidence of delivery, so it must not read as one.
    await mount([null]);
    expect(rowState()).toBe("Open");
  });

  it("stays pressable when Sent", async () => {
    // A delivered arc is still worth re-reading; only the label changes.
    await mount(["delivered"]);
    const row = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Review"),
    );
    expect(row).toBeTruthy();
    expect(row!.disabled).toBe(false);
  });
});
