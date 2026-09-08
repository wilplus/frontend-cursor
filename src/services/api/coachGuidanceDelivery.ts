import { mapReadoutFeatures, type ReadoutFeatures } from "@/components/willab/readout";

/** D3 is deliberately local/synthetic. There is no env override in this slice. */
export const COACH_GUIDANCE_D3_UI_ENABLED = false;

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
  syntheticOnly: true;
  servesUser: false;
  datasetEligible: false;
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
    row.synthetic_only !== true ||
    row.serves_user !== false ||
    row.dataset_eligible !== false ||
    !Array.isArray(row.items)
  ) return null;
  const items = row.items.map(mapItem);
  if (items.some((item) => item === null)) return null;
  return {
    reviewBatchId: text(row.review_batch_id),
    revealGrantId: text(row.reveal_grant_id),
    batchComplete: true,
    items: items as CoachGuidanceItem[],
    syntheticOnly: true,
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
    exercise_offer_id: item.exerciseOfferId ?? "",
    exercise_version_id: item.exerciseVersionId ?? "",
    need_contract_id: item.needContractId ?? "",
    written_note: input.writtenNote.trim(),
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
