import { NextRequest, NextResponse } from "next/server";
import { proxyAdminWithCodes } from "@/app/api/admin/_proxyWithCodes";
import { getBackendUrl, getV2AccessToken } from "@/app/api/getAuth";

type RawStudent = {
  user_id?: string;
  student_id?: string;
  session_id?: string | null;
  pending_count?: number;
  email?: string | null;
  name?: string | null;
  stage?: string | null;
  justification?: string | null;
  canonical_score_for_display?: number | null;
  session_created_at?: string | null;
  sessionCreatedAt?: string | null;
  session?: { created_at?: string | null; createdAt?: string | null } | null;
  submitted_at?: string | null;
  lesson_submitted_at?: string | null;
  lessonSubmittedAt?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

function trimIso(s: string | null | undefined): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t || null;
}

function sessionCreatedFromRaw(raw: RawStudent): string | null {
  return (
    trimIso(raw.session_created_at) ??
    trimIso(raw.sessionCreatedAt) ??
    trimIso(raw.session?.created_at) ??
    trimIso(raw.session?.createdAt) ??
    null
  );
}

function cohortSyntheticId(cohort: Record<string, unknown>): string {
  const profile =
    String(cohort.profile_bucket ?? cohort.profile ?? "unknown").trim() || "unknown";
  const stage = String(cohort.stage_key ?? cohort.stage ?? "unknown").trim() || "unknown";
  return `${profile}::${stage}`;
}

function normalizeStudent(raw: RawStudent) {
  const studentId = raw.student_id ?? raw.user_id ?? "";
  return {
    student_id: studentId,
    session_id: raw.session_id ?? null,
    queue_position: null,
    state: "Draft" as const,
    draft_count: raw.pending_count ?? 1,
    ready_count: 0,
    sent_count: 0,
    session_created_at: sessionCreatedFromRaw(raw),
    submitted_at: raw.submitted_at ?? null,
    lesson_submitted_at: raw.lesson_submitted_at ?? raw.lessonSubmittedAt ?? null,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
    completed_at: raw.completed_at ?? null,
    profile: {
      email: raw.email ?? null,
      name: raw.name ?? null,
      stage: raw.stage ?? null,
      justification: raw.justification ?? null,
      canonical_score_for_display: raw.canonical_score_for_display ?? null,
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  const { cohortId } = await params;
  if (!cohortId || !cohortId.trim()) {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Missing cohortId" },
      { status: 400 }
    );
  }
  const qs = request.nextUrl.search || "";
  const primary = await proxyAdminWithCodes(request, {
    method: "GET",
    backendPath: `/v2/admin/copilot/cohorts/${encodeURIComponent(cohortId)}/students${qs}`,
  });
  if (primary.status !== 404) return primary;

  // Fallback for backends that only embed students in /copilot/cohorts.
  const token = await getV2AccessToken(request);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, { status: 401 });
  }
  const backend = getBackendUrl();
  const cohortsResponse = await fetch(`${backend}/v2/admin/copilot/cohorts${qs}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = (await cohortsResponse.json().catch(() => null)) as
    | { cohorts?: Array<Record<string, unknown>> }
    | null;
  if (!cohortsResponse.ok || !payload?.cohorts) {
    return NextResponse.json(
      {
        code: "COHORTS_FALLBACK_FAILED",
        error: "Could not load cohort students from embedded cohorts payload",
      },
      { status: cohortsResponse.status || 502 }
    );
  }
  const cohort =
    payload.cohorts.find((item) => String(item.id ?? "") === cohortId) ??
    payload.cohorts.find((item) => cohortSyntheticId(item) === cohortId);
  if (!cohort) {
    return NextResponse.json({ students: [] }, { status: 200 });
  }
  const students = Array.isArray((cohort as { students?: unknown[] }).students)
    ? ((cohort as { students?: unknown[] }).students as RawStudent[])
    : [];
  return NextResponse.json(
    {
      students: students
        .map(normalizeStudent)
        .filter((student) => Boolean(student.student_id)),
    },
    { status: 200 }
  );
}

