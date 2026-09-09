import { mapReadoutFeatures, type ReadoutFeatures } from "@/components/willab/readout";

/** Presentation-only switch. The API still requires its independent master
 * gate and exact user/principal allowlist, so this cannot activate serving. */
export const COACH_GUIDANCE_D3_UI_ENABLED =
  process.env.NEXT_PUBLIC_MLC3_PILOT_UI_ENABLED === "true";

export interface CoachGuidanceIdentity {
  reviewBatchId: string;
  revealGrantId: string;
  revealAccessId: string;
  reviewAssignmentId: string;
  feedbackMembershipId: string;
  feedbackCandidateId: string;
}

export interface CoachGuidanceItem extends CoachGuidanceIdentity {
  snippetId: string;
  legacyStarKey: string | null;
  feedbackFamily: "confident_voice" | "rewrite_clarity" | "great_formulation";
  features: ReadoutFeatures;
  exerciseEligible: boolean;
  exerciseOfferId: string | null;
  exerciseVersionId: string | null;
  needContractId: string | null;
}

export interface CoachGuidanceBatch {
  reviewBatchId: string;
  revealGrantId: string;
  batchComplete: true;
  items: CoachGuidanceItem[];
  operationMode: "synthetic_dark" | "allowlisted_service";
  syntheticOnly: boolean;
  servesUser: false;
  datasetEligible: false;
}

export type FirstClientCoachDecision =
  | "rating_yes"
  | "rating_in_between"
  | "rating_no"
  | "rating_not_sure"
  | "rating_audio_unclear";

export interface FirstClientCoachAssignment {
  assignmentId: string;
  audioRef: string;
  packetSha256: string;
  taxonomyVersion: "confidence-five-state-v1";
  judgment: FirstClientCoachDecision | null;
}

export interface FirstClientCoachReviewSet {
  reviewSetId: string;
  practiceSessionId: string;
  assignments: FirstClientCoachAssignment[];
  complete: boolean;
}

export interface FirstClientCoachReviewBatch {
  projectId: string;
  reviewSets: FirstClientCoachReviewSet[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | null {
  const valueText = text(value);
  return valueText ? valueText : null;
}

function mapItem(raw: unknown): CoachGuidanceItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const feedbackFamily = text(row.feedback_family);
  if (
    !["confident_voice", "rewrite_clarity", "great_formulation"].includes(
      feedbackFamily,
    )
  ) return null;
  const mapped = {
    reviewBatchId: text(row.review_batch_id),
    revealGrantId: text(row.reveal_grant_id),
    revealAccessId: text(row.reveal_access_id),
    reviewAssignmentId: text(row.review_assignment_id),
    feedbackMembershipId: text(row.feedback_membership_id),
    feedbackCandidateId: text(row.feedback_candidate_id),
    snippetId: text(row.snippet_id),
  };
  if (Object.values(mapped).some((value) => !value)) return null;
  return {
    ...mapped,
    legacyStarKey: optionalText(row.legacy_star_key),
    feedbackFamily: feedbackFamily as CoachGuidanceItem["feedbackFamily"],
    features: mapReadoutFeatures(row.features),
    exerciseEligible: row.exercise_eligible === true,
    exerciseOfferId: optionalText(row.exercise_offer_id),
    exerciseVersionId: optionalText(row.exercise_version_id),
    needContractId: optionalText(row.need_contract_id),
  };
}

export function mapCoachGuidanceBatch(raw: unknown): CoachGuidanceBatch | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (
    row.batch_complete !== true ||
    row.serves_user !== false ||
    row.dataset_eligible !== false ||
    !Array.isArray(row.items)
  ) return null;
  const operationMode = row.operation_mode === "allowlisted_service"
    ? "allowlisted_service"
    : row.synthetic_only === true
      ? "synthetic_dark"
      : null;
  if (!operationMode) return null;
  const items = row.items.map(mapItem);
  if (items.some((item) => item === null)) return null;
  return {
    reviewBatchId: text(row.review_batch_id),
    revealGrantId: text(row.reveal_grant_id),
    batchComplete: true,
    items: items as CoachGuidanceItem[],
    operationMode,
    syntheticOnly: row.synthetic_only === true,
    servesUser: false,
    datasetEligible: false,
  };
}

export async function fetchCoachGuidanceBatch(
  arcId: string,
): Promise<CoachGuidanceBatch | null> {
  const response = await fetch(
    `/api/v2/coach/guidance/batches/${encodeURIComponent(arcId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  return mapCoachGuidanceBatch(await response.json().catch(() => null));
}

export async function submitCoachGuidance(input: {
  item: CoachGuidanceItem;
  writtenNote: string;
  video: File | null;
  attachmentClass: "general_product_guidance" | "mlc3_exercise";
  productSubcategory: "structure" | "delivery" | null;
  publishToCatalog?: boolean;
  independentCleanMedia?: boolean;
  exerciseKey?: string;
  exerciseInstruction?: string;
  languageCode?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = new FormData();
  const { item } = input;
  Object.entries({
    review_batch_id: item.reviewBatchId,
    reveal_grant_id: item.revealGrantId,
    reveal_access_id: item.revealAccessId,
    review_assignment_id: item.reviewAssignmentId,
    feedback_membership_id: item.feedbackMembershipId,
    feedback_candidate_id: item.feedbackCandidateId,
    attachment_class: input.attachmentClass,
    product_subcategory: input.productSubcategory ?? "",
    exercise_offer_id: input.attachmentClass === "mlc3_exercise"
      ? item.exerciseOfferId ?? ""
      : "",
    exercise_version_id: input.attachmentClass === "mlc3_exercise"
      ? item.exerciseVersionId ?? ""
      : "",
    need_contract_id: input.attachmentClass === "mlc3_exercise"
      ? item.needContractId ?? ""
      : "",
    written_note: input.writtenNote.trim(),
    publish_to_catalog: input.publishToCatalog ? "true" : "false",
    independent_clean_media: input.independentCleanMedia ? "true" : "false",
    exercise_key: input.exerciseKey ?? "",
    exercise_instruction: input.exerciseInstruction ?? "",
    language_code: input.languageCode ?? "en",
  }).forEach(([key, value]) => body.append(key, value));
  if (input.video) body.append("video", input.video);
  const response = await fetch("/api/v2/coach/guidance/attachments", {
    method: "POST",
    body,
  });
  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => ({}));
  return {
    ok: false,
    error:
      typeof payload.error === "string"
        ? payload.error
        : "We couldn't attach this guidance. Try again.",
  };
}

function mapFirstClientAssignment(raw: unknown): FirstClientCoachAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const judgment = row.judgment;
  if (
    typeof row.assignment_id !== "string" ||
    typeof row.audio_ref !== "string" ||
    !/^\/api\/v2\/coach\/mlc3\/reviews\/playback\/[0-9a-f-]{36}$/i.test(
      row.audio_ref,
    ) ||
    typeof row.packet_sha256 !== "string" ||
    row.taxonomy_version !== "confidence-five-state-v1" ||
    (judgment !== null && ![
      "rating_yes", "rating_in_between", "rating_no",
      "rating_not_sure", "rating_audio_unclear",
    ].includes(String(judgment)))
  ) return null;
  return {
    assignmentId: row.assignment_id,
    audioRef: row.audio_ref,
    packetSha256: row.packet_sha256,
    taxonomyVersion: "confidence-five-state-v1",
    judgment: judgment as FirstClientCoachDecision | null,
  };
}

export function mapFirstClientCoachReviews(
  raw: unknown,
): FirstClientCoachReviewBatch | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.project_id !== "string" || !Array.isArray(row.review_sets)) {
    return null;
  }
  const reviewSets: FirstClientCoachReviewSet[] = [];
  for (const rawSet of row.review_sets) {
    if (!rawSet || typeof rawSet !== "object") return null;
    const set = rawSet as Record<string, unknown>;
    if (
      typeof set.review_set_id !== "string" ||
      typeof set.practice_session_id !== "string" ||
      !Array.isArray(set.assignments)
    ) return null;
    const assignments = set.assignments.map(mapFirstClientAssignment);
    if (assignments.some((item) => item === null)) return null;
    reviewSets.push({
      reviewSetId: set.review_set_id,
      practiceSessionId: set.practice_session_id,
      assignments: assignments as FirstClientCoachAssignment[],
      complete: set.complete === true,
    });
  }
  return { projectId: row.project_id, reviewSets };
}

export async function fetchFirstClientCoachReviews(
  projectId: string,
): Promise<FirstClientCoachReviewBatch | null> {
  if (!COACH_GUIDANCE_D3_UI_ENABLED) return null;
  const response = await fetch(
    `/api/v2/coach/mlc3/reviews/${encodeURIComponent(projectId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;
  return mapFirstClientCoachReviews(await response.json().catch(() => null));
}

export async function confirmFirstClientCoachRender(
  assignment: FirstClientCoachAssignment,
  renderInstanceId: string,
): Promise<string | null> {
  const response = await fetch(
    `/api/v2/coach/mlc3/reviews/assignments/${encodeURIComponent(assignment.assignmentId)}/render`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `first-client-coach-render:${assignment.assignmentId}:${renderInstanceId}`,
      },
      body: JSON.stringify({
        render_instance_id: renderInstanceId,
        packet_sha256: assignment.packetSha256,
        rendered_at: new Date().toISOString(),
        client_version: "mlc3-first-client-coach-web-v1",
      }),
    },
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as {
    render_receipt_id?: unknown;
  } | null;
  return typeof payload?.render_receipt_id === "string"
    ? payload.render_receipt_id
    : null;
}

export async function submitFirstClientCoachJudgment(
  assignment: FirstClientCoachAssignment,
  renderReceiptId: string,
  decision: FirstClientCoachDecision,
): Promise<boolean> {
  const response = await fetch(
    `/api/v2/coach/mlc3/reviews/assignments/${encodeURIComponent(assignment.assignmentId)}/judgments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `first-client-coach-judgment:${assignment.assignmentId}:${decision}`,
      },
      body: JSON.stringify({ render_receipt_id: renderReceiptId, decision }),
    },
  );
  return response.ok;
}

export async function completeFirstClientCoachReview(
  reviewSetId: string,
): Promise<string | null> {
  const response = await fetch(
    `/api/v2/coach/mlc3/reviews/${encodeURIComponent(reviewSetId)}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `first-client-coach-complete:${reviewSetId}`,
      },
      body: "{}",
    },
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as {
    reveal_grant_id?: unknown;
  } | null;
  return typeof payload?.reveal_grant_id === "string"
    ? payload.reveal_grant_id
    : null;
}
