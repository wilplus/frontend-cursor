import { describe, expect, it } from "vitest";
import type { CopilotStudentQueueItem } from "@/lib/api/admin-client";
import {
  removeArchivedQueueRowByBackendResult,
  resolveQueueArchiveSessionId,
} from "./queue-archive";

function queueRow(overrides: Partial<CopilotStudentQueueItem>): CopilotStudentQueueItem {
  return {
    student_id: "u-1",
    session_id: null,
    state: "Draft",
    ...overrides,
  };
}

describe("queue-archive helpers", () => {
  it("resolves session id with required fallback order", () => {
    const fallbackMap = new Map<string, string>([["u-1", "sess-from-map"]]);

    expect(
      resolveQueueArchiveSessionId({
        student: queueRow({ session_id: "sess-from-row" }),
        preferredSessionId: "sess-preferred",
        resolvedDraftSessionByStudentId: fallbackMap,
      })
    ).toBe("sess-preferred");

    expect(
      resolveQueueArchiveSessionId({
        student: queueRow({ session_id: "sess-from-row" }),
        resolvedDraftSessionByStudentId: fallbackMap,
      })
    ).toBe("sess-from-row");

    expect(
      resolveQueueArchiveSessionId({
        student: queueRow({ draft_generation_session_id: "sess-from-draft-generation" } as unknown as CopilotStudentQueueItem),
        resolvedDraftSessionByStudentId: fallbackMap,
      })
    ).toBe("sess-from-draft-generation");

    expect(
      resolveQueueArchiveSessionId({
        student: queueRow({
          profile: {
            learning_profile: {
              metadata: { session_id: "sess-from-learning-metadata" },
            },
          } as unknown as CopilotStudentQueueItem["profile"],
        }),
        resolvedDraftSessionByStudentId: fallbackMap,
      })
    ).toBe("sess-from-learning-metadata");

    expect(
      resolveQueueArchiveSessionId({
        student: queueRow({ student_id: "u-1", session_id: null }),
        resolvedDraftSessionByStudentId: fallbackMap,
      })
    ).toBe("sess-from-map");
  });

  it("keeps archive persistence across reload and unarchive", () => {
    const archivedRow = queueRow({ student_id: "u-archived", session_id: "sess-a" });
    const otherRow = queueRow({ student_id: "u-other", session_id: "sess-b" });
    const initialRows = [archivedRow, otherRow];

    const afterArchive = removeArchivedQueueRowByBackendResult(initialRows, {
      user_id: "u-archived",
      session_id: "sess-a",
      archived: true,
    });
    expect(afterArchive.map((row) => row.student_id)).toEqual(["u-other"]);

    // Backend source of truth after reload with include_archived=false.
    const reloadedAfterArchive = [otherRow];
    expect(reloadedAfterArchive.map((row) => row.student_id)).toEqual(["u-other"]);

    // Backend source of truth after unarchive + reload.
    const reloadedAfterUnarchive = [archivedRow, otherRow];
    expect(reloadedAfterUnarchive.map((row) => row.student_id).sort()).toEqual([
      "u-archived",
      "u-other",
    ]);
  });
});
