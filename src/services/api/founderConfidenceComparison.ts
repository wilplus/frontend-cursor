export type ConfidenceComparisonValue = "yes" | "no" | "neutral";

export interface FounderComparisonRow {
  snippetId: string;
  transcript: string;
  machineValue: ConfidenceComparisonValue | null;
  coachValue: ConfidenceComparisonValue | null;
  coachUnrateable: boolean;
  agreement: boolean | null;
  bothConfident: boolean;
}

export interface FounderConfidenceComparison {
  sessionId: string;
  rows: FounderComparisonRow[];
  summary: {
    labelled: number;
    comparable: number;
    same: number;
    different: number;
    bothConfident: number;
  };
  note: string;
}

function value(raw: unknown): ConfidenceComparisonValue | null {
  return raw === "yes" || raw === "no" || raw === "neutral" ? raw : null;
}

function count(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

export function mapFounderConfidenceComparison(
  raw: unknown,
): FounderConfidenceComparison | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.session_id !== "string" || !Array.isArray(body.rows)) {
    return null;
  }
  const rows = body.rows.flatMap((entry): FounderComparisonRow[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.snippet_id !== "string") return [];
    return [
      {
        snippetId: row.snippet_id,
        transcript: typeof row.transcript === "string" ? row.transcript : "",
        machineValue: value(row.machine_value),
        coachValue: value(row.coach_value),
        coachUnrateable: row.coach_unrateable === true,
        agreement: typeof row.agreement === "boolean" ? row.agreement : null,
        bothConfident: row.both_confident === true,
      },
    ];
  });
  const summary =
    body.summary && typeof body.summary === "object"
      ? (body.summary as Record<string, unknown>)
      : {};
  return {
    sessionId: body.session_id,
    rows,
    summary: {
      labelled: count(summary.labelled),
      comparable: count(summary.comparable),
      same: count(summary.same),
      different: count(summary.different),
      bothConfident: count(summary.both_confident),
    },
    note:
      typeof body.note === "string"
        ? body.note
        : "Machine is a proposal, not a quorum vote.",
  };
}

export async function fetchFounderConfidenceComparison(
  sessionId: string,
): Promise<FounderConfidenceComparison | null> {
  try {
    const response = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(
        sessionId,
      )}/confidence-comparison`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) return null;
    return mapFounderConfidenceComparison(await response.json());
  } catch {
    return null;
  }
}
