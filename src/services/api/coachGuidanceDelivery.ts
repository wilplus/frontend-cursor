import { mapReadoutFeatures, type ReadoutFeatures } from "@/components/willab/readout";

/** Presentation-only switch. The API still requires its independent master
 * gate and rollout-aware database enrollment, so this cannot authorize a
 * principal or activate serving. */
export const COACH_GUIDANCE_D3_UI_ENABLED =
  process.env.NEXT_PUBLIC_MLC3_SERVICE_UI_ENABLED === "true";
export const COACH_INLINE_AUTHORING_UI_ENABLED =
  process.env.NEXT_PUBLIC_MLC3_COACH_INLINE_AUTHORING_ENABLED === "true";
export const CONFIDENT_MOMENT_BUNDLE_UI_ENABLED =
  process.env.NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED === "true";

/** The coach Bundle editor is presentation-only and deliberately requires all
 * three independently reviewed switches. A broad MLC-3 flag, an email in the
 * browser, or either feature switch by itself cannot mount the surface. */
export const COACH_CONFIDENT_MOMENT_AUTHORING_UI_ENABLED =
  COACH_GUIDANCE_D3_UI_ENABLED &&
  COACH_INLINE_AUTHORING_UI_ENABLED &&
  CONFIDENT_MOMENT_BUNDLE_UI_ENABLED;

export type FeedbackLanguageFamily =
  | "confident_voice"
  | "rewrite_clarity"
  | "great_formulation";

export interface CoachFeedbackLanguageTarget {
  bundleAttachmentId: string;
  reviewAssignmentId: string;
  revealAccessId: string;
  feedbackFamily: FeedbackLanguageFamily;
  allowedOutputKind: "comment" | "rephrase";
  allowedCommentPurpose:
    | "confidence_explanation"
    | "actionable_observation"
    | "positive_praise"
    | null;
  sourcePassage: {
    evidenceSpanId: string;
    text: string;
    textSha256: string;
  };
  expectedCurrentRevisionId: string | null;
  expectedCurrentDeliveryId: string | null;
}

export interface CoachBundleAuthoringContext {
  bundleId: string;
  sourceReviewAttachmentId: string;
  authorizedTargets: CoachFeedbackLanguageTarget[];
}

export interface CoachGuidanceIdentity {
  reviewBatchId: string;
  revealGrantId: string;
  revealAccessId: string;
  reviewAssignmentId: string;
  /** Offer-specific V3 identity. Ordinary frozen batch items do not have an
   * exercise offer and therefore carry neither value. */
  feedbackMembershipId: string | null;
  feedbackCandidateId: string | null;
}

export interface CoachGuidanceItem extends CoachGuidanceIdentity {
  snippetId: string;
  transcript: string;
  legacyStarKey: string | null;
  feedbackFamily: "confident_voice" | "rewrite_clarity" | "great_formulation";
  features: ReadoutFeatures;
  exerciseEligible: boolean;
  exerciseOfferId: string | null;
  exerciseVersionId: string | null;
  needContractId: string | null;
  authorizationSnapshotId: string | null;
  sourceRole: "source_before_exercise" | null;
  sourcePattern:
    | "low_confidence_rushing_dominant"
    | "near_confident"
    | "confident"
    | null;
  sourcePatternPolicyVersion: string | null;
  ordinalPolicyVersion: string | null;
  /** Present only after the exact reviewer-specific complete-batch reveal. */
  bundleAuthoringContext: CoachBundleAuthoringContext | null;
}

export interface CoachGuidanceBatch {
  reviewBatchId: string;
  revealGrantId: string;
  batchComplete: true;
  items: CoachGuidanceItem[];
  operationMode:
    | "synthetic_dark"
    | "allowlisted_service"
    | "cohort_service"
    | "general_service";
  syntheticOnly: boolean;
  servesUser: false;
  datasetEligible: false;
}

/** Select the post-blind item for one visible review act. D5 always supplies
 * the exact assignment identity; snippet fallback exists only for legacy
 * non-D5 rows and is never used to collapse the canonical batch. */
export function coachGuidanceItemsForReviewAct(
  batch: CoachGuidanceBatch | null,
  identity: { reviewAssignmentId: string | null; snippetId: string },
): CoachGuidanceItem[] {
  if (!batch) return [];
  return batch.items.filter((item) =>
    identity.reviewAssignmentId
      ? item.reviewAssignmentId === identity.reviewAssignmentId
      : item.snippetId === identity.snippetId
  );
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function canonicalUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

function mapBundleAuthoringContext(
  raw: unknown,
): CoachBundleAuthoringContext | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (!exactKeys(row, [
    "bundle_id", "source_review_attachment_id", "authorized_targets",
  ])) return null;
  const bundleId = canonicalUuid(row.bundle_id);
  const sourceReviewAttachmentId = canonicalUuid(
    row.source_review_attachment_id,
  );
  if (!bundleId || !sourceReviewAttachmentId ||
      !Array.isArray(row.authorized_targets)) return null;

  const targets: CoachFeedbackLanguageTarget[] = [];
  const seen = new Set<string>();
  for (const rawTarget of row.authorized_targets) {
    if (!rawTarget || typeof rawTarget !== "object") return null;
    const target = rawTarget as Record<string, unknown>;
    if (!exactKeys(target, [
      "bundle_attachment_id", "review_assignment_id", "reveal_access_id",
      "feedback_family", "allowed_output_kind", "allowed_comment_purpose",
      "source_passage", "expected_current_revision_id",
      "expected_current_delivery_id",
    ])) return null;
    const bundleAttachmentId = canonicalUuid(target.bundle_attachment_id);
    const reviewAssignmentId = canonicalUuid(target.review_assignment_id);
    const revealAccessId = canonicalUuid(target.reveal_access_id);
    const expectedCurrentRevisionId = target.expected_current_revision_id === null
      ? null
      : canonicalUuid(target.expected_current_revision_id);
    const expectedCurrentDeliveryId = target.expected_current_delivery_id === null
      ? null
      : canonicalUuid(target.expected_current_delivery_id);
    if (
      !bundleAttachmentId || !reviewAssignmentId || !revealAccessId ||
      (target.expected_current_revision_id !== null &&
        !expectedCurrentRevisionId) ||
      (target.expected_current_delivery_id !== null &&
        !expectedCurrentDeliveryId) ||
      seen.has(bundleAttachmentId)
    ) return null;
    seen.add(bundleAttachmentId);

    const family = target.feedback_family;
    const outputKind = target.allowed_output_kind;
    const purpose = target.allowed_comment_purpose;
    const allowed =
      (family === "confident_voice" && outputKind === "comment" &&
        purpose === "confidence_explanation") ||
      (family === "great_formulation" && outputKind === "comment" &&
        purpose === "positive_praise") ||
      (family === "rewrite_clarity" && outputKind === "rephrase" &&
        purpose === null) ||
      (family === "rewrite_clarity" && outputKind === "comment" &&
        purpose === "actionable_observation");
    if (!allowed) return null;

    if (!target.source_passage || typeof target.source_passage !== "object") {
      return null;
    }
    const passage = target.source_passage as Record<string, unknown>;
    if (!exactKeys(passage, ["evidence_span_id", "text", "text_sha256"])) {
      return null;
    }
    const evidenceSpanId = canonicalUuid(passage.evidence_span_id);
    if (
      !evidenceSpanId || typeof passage.text !== "string" ||
      !passage.text.trim() || typeof passage.text_sha256 !== "string" ||
      !SHA256_RE.test(passage.text_sha256)
    ) return null;

    targets.push({
      bundleAttachmentId,
      reviewAssignmentId,
      revealAccessId,
      feedbackFamily: family,
      allowedOutputKind: outputKind,
      allowedCommentPurpose: purpose,
      sourcePassage: {
        evidenceSpanId,
        text: passage.text,
        textSha256: passage.text_sha256,
      },
      expectedCurrentRevisionId,
      expectedCurrentDeliveryId,
    });
  }
  return { bundleId, sourceReviewAttachmentId, authorizedTargets: targets };
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
    snippetId: text(row.snippet_id),
  };
  if (Object.values(mapped).some((value) => !value)) return null;
  const exerciseEligible = row.exercise_eligible === true;
  const feedbackMembershipId = optionalText(row.feedback_membership_id);
  const feedbackCandidateId = optionalText(row.feedback_candidate_id);
  // These identities describe the exact V3 offer, not the blind review act.
  // Ordinary canonical assignments legitimately have neither; an exercise
  // item must have both and fails closed if either is absent.
  if (exerciseEligible && (!feedbackMembershipId || !feedbackCandidateId)) {
    return null;
  }
  const hasBundleContext = Object.prototype.hasOwnProperty.call(
    row, "bundle_authoring_context",
  );
  const bundleAuthoringContext = hasBundleContext
    ? mapBundleAuthoringContext(row.bundle_authoring_context)
    : null;
  if (hasBundleContext && !bundleAuthoringContext) return null;
  return {
    ...mapped,
    feedbackMembershipId,
    feedbackCandidateId,
    transcript: text(row.transcript),
    legacyStarKey: optionalText(row.legacy_star_key),
    feedbackFamily: feedbackFamily as CoachGuidanceItem["feedbackFamily"],
    features: mapReadoutFeatures(row.features),
    exerciseEligible,
    exerciseOfferId: optionalText(row.exercise_offer_id),
    exerciseVersionId: optionalText(row.exercise_version_id),
    needContractId: optionalText(row.need_contract_id),
    authorizationSnapshotId: optionalText(row.authorization_snapshot_id),
    sourceRole: row.source_role === "source_before_exercise"
      ? "source_before_exercise"
      : null,
    sourcePattern: [
      "low_confidence_rushing_dominant", "near_confident", "confident",
    ].includes(text(row.source_pattern))
      ? text(row.source_pattern) as CoachGuidanceItem["sourcePattern"]
      : null,
    sourcePatternPolicyVersion: optionalText(
      row.source_pattern_policy_version,
    ),
    ordinalPolicyVersion: optionalText(row.ordinal_policy_version),
    bundleAuthoringContext,
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
  const operationMode = [
    "allowlisted_service", "cohort_service", "general_service",
  ].includes(text(row.operation_mode))
    ? text(row.operation_mode) as CoachGuidanceBatch["operationMode"]
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

export interface CoachFeedbackLanguageResult {
  revisionId: string;
  revisionSha256: string;
  deliveryId: string | null;
  deliveryState: "scheduled_current_take" | "scheduled_next_take" | null;
  targetTakeId: string | null;
}

export function mapCoachFeedbackLanguageResult(
  raw: unknown,
  expected: { bundleId: string; bundleAttachmentId: string },
): CoachFeedbackLanguageResult | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const deliveryId = payload.delivery_id === null
    ? null
    : canonicalUuid(payload.delivery_id);
  const targetTakeId = payload.target_take_id === null
    ? null
    : canonicalUuid(payload.target_take_id);
  const deliveryState = payload.delivery_state;
  const scheduled =
    deliveryState === "scheduled_current_take" ||
    deliveryState === "scheduled_next_take";
  const validDeliveryTriple =
    (deliveryId === null && deliveryState === null && targetTakeId === null) ||
    (deliveryId !== null && scheduled && targetTakeId !== null);
  const revisionId = canonicalUuid(payload.revision_id);
  if (
    !exactKeys(payload, [
      "coach_feedback_language_contract_version", "bundle_id",
      "bundle_attachment_id", "revision_id", "revision_sha256",
      "delivery_id", "delivery_state", "target_take_id", "dataset_eligible",
    ]) ||
    payload.coach_feedback_language_contract_version !==
      "confident-moment-coach-feedback-language-v1" ||
    payload.bundle_id !== expected.bundleId ||
    payload.bundle_attachment_id !== expected.bundleAttachmentId ||
    !revisionId || typeof payload.revision_sha256 !== "string" ||
    !SHA256_RE.test(payload.revision_sha256) || !validDeliveryTriple ||
    payload.dataset_eligible !== false
  ) return null;
  return {
    revisionId,
    revisionSha256: payload.revision_sha256,
    deliveryId,
    deliveryState: deliveryState as CoachFeedbackLanguageResult["deliveryState"],
    targetTakeId,
  };
}

export async function publishCoachFeedbackLanguage(input: {
  item: CoachGuidanceItem;
  target: CoachFeedbackLanguageTarget;
  revisionText: string;
  idempotencyKey: string;
}): Promise<
  | { ok: true; value: CoachFeedbackLanguageResult }
  | { ok: false; error: string }
> {
  if (!COACH_CONFIDENT_MOMENT_AUTHORING_UI_ENABLED) {
    return { ok: false, error: "This feedback editor is not available." };
  }
  const context = input.item.bundleAuthoringContext;
  const target = input.target;
  const authorizedTarget = context?.authorizedTargets.find(
    (candidate) => candidate.bundleAttachmentId === target.bundleAttachmentId,
  );
  if (
    !context || !authorizedTarget || !input.revisionText.trim() ||
    target.reviewAssignmentId !== input.item.reviewAssignmentId ||
    target.revealAccessId !== input.item.revealAccessId ||
    target.reviewAssignmentId !== authorizedTarget.reviewAssignmentId ||
    target.revealAccessId !== authorizedTarget.revealAccessId ||
    target.feedbackFamily !== authorizedTarget.feedbackFamily ||
    target.allowedOutputKind !== authorizedTarget.allowedOutputKind ||
    target.allowedCommentPurpose !== authorizedTarget.allowedCommentPurpose
  ) {
    return { ok: false, error: "This feedback target is no longer available." };
  }

  const response = await fetch(
    `/api/v2/coach/confident-moment-bundles/${encodeURIComponent(
      context.bundleId,
    )}/attachments/${encodeURIComponent(target.bundleAttachmentId)}/feedback-language`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        review_batch_id: input.item.reviewBatchId,
        reveal_grant_id: input.item.revealGrantId,
        reveal_access_id: target.revealAccessId,
        review_assignment_id: target.reviewAssignmentId,
        output_kind: target.allowedOutputKind,
        comment_purpose: target.allowedCommentPurpose,
        revision_text: input.revisionText,
        expected_current_revision_id: target.expectedCurrentRevisionId,
        expected_current_delivery_id: target.expectedCurrentDeliveryId,
        idempotency_key: input.idempotencyKey,
      }),
    },
  ).catch(() => null);
  if (!response) {
    return { ok: false, error: "We couldn't save this feedback. Try again." };
  }
  const payload = await response.json().catch(() => null) as
    Record<string, unknown> | null;
  if (!response.ok || !payload) {
    return {
      ok: false,
      error: typeof payload?.code === "string"
        ? payload.code
        : "We couldn't save this feedback. Try again.",
    };
  }
  const mapped = mapCoachFeedbackLanguageResult(payload, {
    bundleId: context.bundleId,
    bundleAttachmentId: target.bundleAttachmentId,
  });
  if (!mapped) {
    return { ok: false, error: "The saved feedback receipt was invalid." };
  }
  return { ok: true, value: mapped };
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
  idempotencyKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = new FormData();
  const { item } = input;
  Object.entries({
    review_batch_id: item.reviewBatchId,
    reveal_grant_id: item.revealGrantId,
    reveal_access_id: item.revealAccessId,
    review_assignment_id: item.reviewAssignmentId,
    feedback_membership_id: item.feedbackMembershipId ?? "",
    feedback_candidate_id: item.feedbackCandidateId ?? "",
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
    headers: { "Idempotency-Key": input.idempotencyKey },
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

export async function submitCoachInlineExerciseDraft(input: {
  item: CoachGuidanceItem;
  title: string;
  instructionText: string;
  video: File;
  languageCode: string;
  idempotencyKey: string;
  supportedConfidencePatterns: Array<
    "low_confidence_rushing_dominant" | "near_confident" | "confident"
  >;
}): Promise<
  | { ok: true; draftId: string; playbackRef: string }
  | { ok: false; error: string }
> {
  const { item } = input;
  if (
    !COACH_INLINE_AUTHORING_UI_ENABLED ||
    !item.exerciseEligible ||
    item.exerciseVersionId !== null ||
    !item.feedbackMembershipId ||
    !item.feedbackCandidateId ||
    !item.exerciseOfferId ||
    !item.needContractId ||
    !item.authorizationSnapshotId ||
    item.sourceRole !== "source_before_exercise"
  ) {
    return { ok: false, error: "This exercise draft is not available." };
  }
  const body = new FormData();
  Object.entries({
    reveal_access_id: item.revealAccessId,
    feedback_membership_id: item.feedbackMembershipId,
    feedback_candidate_id: item.feedbackCandidateId,
    authorization_snapshot_id: item.authorizationSnapshotId,
    exercise_offer_id: item.exerciseOfferId,
    need_contract_id: item.needContractId,
    title: input.title.trim(),
    instruction_text: input.instructionText.trim(),
    language_code: input.languageCode,
  }).forEach(([key, value]) => body.append(key, value));
  input.supportedConfidencePatterns.forEach((pattern) => {
    body.append("supported_confidence_patterns", pattern);
  });
  body.append("video", input.video);
  const response = await fetch("/api/v2/coach/guidance/exercise-drafts", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body,
  });
  const payload = await response.json().catch(() => ({})) as Record<
    string, unknown
  >;
  if (
    response.ok &&
    typeof payload.draft_id === "string" &&
    typeof payload.playback_ref === "string"
  ) {
    return {
      ok: true,
      draftId: payload.draft_id,
      playbackRef: payload.playback_ref,
    };
  }
  return {
    ok: false,
    error: typeof payload.code === "string"
      ? payload.code
      : "We couldn't save this exercise draft. Try again.",
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
