import { getAuthToken } from "@/lib/api/auth-client";

export const CONFIDENT_MOMENT_CONTRACT =
  "confident-moment-coaching-bundle-v2" as const;
export const CONFIDENT_MOMENT_SUMMARY_CONTRACT =
  "confident-moment-core-summary-v1" as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export type FeedbackFamily =
  | "confident_voice"
  | "rewrite_clarity"
  | "great_formulation";

const FAMILY_RESPONSES: Record<FeedbackFamily, readonly string[]> = {
  confident_voice: ["yes", "in_between", "no", "not_sure", "audio_unclear"],
  rewrite_clarity: ["apply_suggestion", "keep_wording"],
  great_formulation: ["useful", "not_useful", "not_sure"],
};

function isFamilyResponse(family: FeedbackFamily, response: unknown): response is string {
  return typeof response === "string" && FAMILY_RESPONSES[family].includes(response);
}

export interface ConfidentMomentSummaryItem {
  bundleId: string;
  paragraphId: string;
  slideIndex: number;
  blockKey: number;
  markerPresent: true;
  isOrange: boolean;
  isLocked: boolean;
  hasCoachUpdate: boolean;
  hasUnreadCoachUpdate: boolean;
  stateRevision: number;
}

export interface ConfidentMomentSummary {
  contractVersion: typeof CONFIDENT_MOMENT_SUMMARY_CONTRACT;
  documentSnapshotId: string;
  items: ConfidentMomentSummaryItem[];
  summarySha256: string;
}

export interface ConfidentMomentOwnerEdit {
  text: string | null;
  sourceDocumentVersion: number | null;
  userTextRevision: string | null;
  userTextSha256: string | null;
  parts: Array<{
    id: string;
    position: number;
    text: string;
    currentPartRevisionId: string | null;
    locked: boolean;
  }>;
  currentBundleTextUpdateBinding: {
    bindingId: string;
    bundleId: string;
    attachmentId: string;
    sourceDocumentVersion: number;
    resultUserTextRevision: string;
    resultUserTextSha256: string;
    resultPartRevisionId: string;
  } | null;
}

export interface FeedbackLanguageItem {
  bundleAttachmentId: string;
  attachedCandidateId: string;
  feedbackFamily: FeedbackFamily;
  canonicalFeedbackExposureId: string;
  canonicalPosition: number;
  resolutionState: "coach_revision" | "machine_fallback" | "excluded";
  exclusionReason: "delivery_explicitly_invalidated" | "machine_output_invalid" | null;
  sourcePassage: { evidenceSpanId: string; text: string; textSha256: string };
  updateTextAvailable: boolean;
  coachAuthoringExclusionReason: "source_audio_unavailable" | null;
  output: {
    outputKind: "comment" | "rephrase";
    commentPurpose:
      | "confidence_explanation"
      | "actionable_observation"
      | "positive_praise"
      | null;
    text: string;
    origin: "machine" | "coach";
  } | null;
  coachUpdate: {
    currentRevisionId: string;
    revisionSha256: string;
    revisionDeliveryId: string;
    deliverySubjectSha256: string;
    presentationId: string;
    renderedExposureId: string | null;
    unread: boolean;
  } | null;
  ownerDecision: {
    feedbackFamily: FeedbackFamily;
    response: string;
    decisionId: string;
    ownerResponseId: string | null;
    responseBindingId: string | null;
  } | null;
}

export interface ConfidentMomentBundle {
  bundleId: string;
  bundleSubjectKind: "confidence_anchor" | "no_anchor_paragraph_trigger";
  slideIndex: number;
  blockKey: number;
  paragraphId: string;
  subject: {
    candidateId: string;
    evidenceSpanId: string;
    canonicalFeedbackPresentationId: string;
  };
  confidenceAnchor: {
    candidateId: string;
    evidenceSpanId: string;
    playbackReferenceId: string;
  } | null;
  feedbackLanguageItems: FeedbackLanguageItem[];
  exercise: null;
  root: {
    activeRootActionId: string | null;
    interactionStateRevision: string;
    isOrange: boolean;
    isLocked: boolean;
    canRestorePrevious: boolean;
    restoreProductActionId: string | null;
  };
  stateRevision: number;
}

export interface ConfidentMomentProjection {
  contractVersion: typeof CONFIDENT_MOMENT_CONTRACT;
  feedbackLanguageShapeVersion: "feedback-language-items-v2";
  projectId: string;
  takeId: string;
  documentSnapshotId: string;
  feedbackMembershipId: string;
  bundles: ConfidentMomentBundle[];
  coverage: {
    targetSlideCount: number;
    achievedSlideCount: number;
    targetMet: boolean;
  };
  responseSha256: string;
}

export type ConfidentMomentFetchResult =
  | { kind: "ready"; projection: ConfidentMomentProjection }
  | { kind: "disabled" | "retry" | "error" };

export type ConfidentMomentMutationResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "disabled" | "retry" | "error" };

export function confidentMomentBundleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED === "true";
}

export function rootingCoverageEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ROOTING_COVERAGE_V1_ENABLED === "true";
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function sha(value: unknown): string | null {
  return typeof value === "string" && SHA256.test(value) ? value : null;
}

function integer(value: unknown, minimum = 0): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum
    ? value
    : null;
}

function bigint(value: unknown): string | null {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

const SUMMARY_KEYS = [
  "contract_version", "document_snapshot_id", "items", "summary_sha256",
] as const;

export function mapConfidentMomentSummary(raw: unknown): ConfidentMomentSummary | null {
  const value = object(raw);
  if (!value || !exactKeys(value, SUMMARY_KEYS) || value.contract_version !== CONFIDENT_MOMENT_SUMMARY_CONTRACT) return null;
  const documentSnapshotId = uuid(value.document_snapshot_id);
  const summarySha256 = sha(value.summary_sha256);
  if (!documentSnapshotId || !summarySha256 || !Array.isArray(value.items)) return null;
  const items: ConfidentMomentSummaryItem[] = [];
  const seen = new Set<string>();
  for (const rawItem of value.items) {
    const item = object(rawItem);
    if (!item || !exactKeys(item, [
      "bundle_id", "paragraph_id", "slide_index", "block_key", "marker_present",
      "is_orange", "is_locked", "has_coach_update", "has_unread_coach_update", "state_revision",
    ])) return null;
    const bundleId = uuid(item.bundle_id);
    const paragraphId = uuid(item.paragraph_id);
    const slideIndex = integer(item.slide_index);
    const blockKey = integer(item.block_key);
    const stateRevision = integer(item.state_revision, 1);
    if (!bundleId || !paragraphId || slideIndex === null || blockKey === null || stateRevision === null || seen.has(bundleId)) return null;
    if (item.marker_present !== true || typeof item.is_orange !== "boolean" || typeof item.is_locked !== "boolean" || typeof item.has_coach_update !== "boolean" || typeof item.has_unread_coach_update !== "boolean") return null;
    if (item.is_locked && !item.is_orange) return null;
    if (item.has_unread_coach_update && !item.has_coach_update) return null;
    seen.add(bundleId);
    items.push({
      bundleId, paragraphId, slideIndex, blockKey, markerPresent: true,
      isOrange: item.is_orange, isLocked: item.is_locked,
      hasCoachUpdate: item.has_coach_update,
      hasUnreadCoachUpdate: item.has_unread_coach_update,
      stateRevision,
    });
  }
  return { contractVersion: CONFIDENT_MOMENT_SUMMARY_CONTRACT, documentSnapshotId, items, summarySha256 };
}

function mapFeedbackItem(raw: unknown): FeedbackLanguageItem | null {
  const value = object(raw);
  if (!value || !exactKeys(value, [
    "bundle_attachment_id", "attached_candidate_id", "feedback_family", "canonical_feedback_exposure_id",
    "canonical_position", "resolution_state", "exclusion_reason", "source_passage", "update_text_available",
    "coach_authoring_exclusion_reason", "output", "coach_update", "owner_decision",
  ])) return null;
  const bundleAttachmentId = uuid(value.bundle_attachment_id);
  const attachedCandidateId = uuid(value.attached_candidate_id);
  const canonicalFeedbackExposureId = uuid(value.canonical_feedback_exposure_id);
  const canonicalPosition = integer(value.canonical_position, 1);
  const family = value.feedback_family;
  const resolution = value.resolution_state;
  const source = object(value.source_passage);
  if (!bundleAttachmentId || !attachedCandidateId || !canonicalFeedbackExposureId || canonicalPosition === null || !["confident_voice", "rewrite_clarity", "great_formulation"].includes(String(family)) || !["coach_revision", "machine_fallback", "excluded"].includes(String(resolution)) || !source || !exactKeys(source, ["evidence_span_id", "text", "text_sha256"])) return null;
  const evidenceSpanId = uuid(source.evidence_span_id);
  const sourceText = text(source.text);
  const textSha256 = sha(source.text_sha256);
  if (!evidenceSpanId || !sourceText || !textSha256 || typeof value.update_text_available !== "boolean") return null;
  if (value.coach_authoring_exclusion_reason !== null && value.coach_authoring_exclusion_reason !== "source_audio_unavailable") return null;
  const outputRaw = value.output === null ? null : object(value.output);
  const coachRaw = value.coach_update === null ? null : object(value.coach_update);
  const decisionRaw = value.owner_decision === null ? null : object(value.owner_decision);
  let output: FeedbackLanguageItem["output"] = null;
  let coachUpdate: FeedbackLanguageItem["coachUpdate"] = null;
  let ownerDecision: FeedbackLanguageItem["ownerDecision"] = null;
  if (resolution === "excluded") {
    // Output invalidation and owner-response currentness are independent
    // provenance axes. The canonical projection may exclude the current
    // wording while retaining the exact immutable owner decision for this
    // attachment; only output/coach-update payloads must disappear.
    if (outputRaw || coachRaw || !["delivery_explicitly_invalidated", "machine_output_invalid"].includes(String(value.exclusion_reason))) return null;
  } else {
    if (value.exclusion_reason !== null || !outputRaw || !exactKeys(outputRaw, ["output_kind", "comment_purpose", "text", "origin"])) return null;
    if (!["comment", "rephrase"].includes(String(outputRaw.output_kind)) || !["machine", "coach"].includes(String(outputRaw.origin)) || !text(outputRaw.text)) return null;
    const purpose = outputRaw.comment_purpose;
    if (purpose !== null && !["confidence_explanation", "actionable_observation", "positive_praise"].includes(String(purpose))) return null;
    output = { outputKind: outputRaw.output_kind as "comment" | "rephrase", commentPurpose: purpose as "confidence_explanation" | "actionable_observation" | "positive_praise" | null, text: outputRaw.text as string, origin: outputRaw.origin as "machine" | "coach" };
    if (
      (output.outputKind === "rephrase" && output.commentPurpose !== null) ||
      (output.outputKind === "comment" && output.commentPurpose === null) ||
      (family === "confident_voice" && (output.outputKind !== "comment" || output.commentPurpose !== "confidence_explanation")) ||
      (family === "great_formulation" && (output.outputKind !== "comment" || output.commentPurpose !== "positive_praise")) ||
      (family === "rewrite_clarity" && !(
        (output.outputKind === "rephrase" && output.commentPurpose === null) ||
        (output.outputKind === "comment" && output.commentPurpose === "actionable_observation")
      ))
    ) return null;
    if (resolution === "machine_fallback") {
      if (coachRaw || output.origin !== "machine") return null;
    } else {
      if (!coachRaw || output.origin !== "coach" || !exactKeys(coachRaw, ["current_revision_id", "revision_sha256", "revision_delivery_id", "delivery_subject_sha256", "presentation_id", "rendered_exposure_id", "unread"])) return null;
      const currentRevisionId = uuid(coachRaw.current_revision_id);
      const revisionSha256 = sha(coachRaw.revision_sha256);
      const revisionDeliveryId = uuid(coachRaw.revision_delivery_id);
      const deliverySubjectSha256 = sha(coachRaw.delivery_subject_sha256);
      const presentationId = uuid(coachRaw.presentation_id);
      const renderedExposureId = coachRaw.rendered_exposure_id === null ? null : uuid(coachRaw.rendered_exposure_id);
      if (!currentRevisionId || !revisionSha256 || !revisionDeliveryId || !deliverySubjectSha256 || !presentationId || (coachRaw.rendered_exposure_id !== null && !renderedExposureId) || typeof coachRaw.unread !== "boolean" || coachRaw.unread !== (renderedExposureId === null)) return null;
      coachUpdate = { currentRevisionId, revisionSha256, revisionDeliveryId, deliverySubjectSha256, presentationId, renderedExposureId, unread: coachRaw.unread };
    }
  }
  if (decisionRaw) {
    if (!exactKeys(decisionRaw, ["feedback_family", "response", "decision_id", "owner_response_id", "response_binding_id"]) || decisionRaw.feedback_family !== family) return null;
    const decisionId = uuid(decisionRaw.decision_id);
    const ownerResponseId = decisionRaw.owner_response_id === null ? null : uuid(decisionRaw.owner_response_id);
    const responseBindingId = decisionRaw.response_binding_id === null ? null : uuid(decisionRaw.response_binding_id);
    if (!isFamilyResponse(family as FeedbackFamily, decisionRaw.response) || !decisionId || (decisionRaw.owner_response_id !== null && !ownerResponseId) || (decisionRaw.response_binding_id !== null && !responseBindingId)) return null;
    if (family === "confident_voice" ? (!ownerResponseId || !responseBindingId) : (ownerResponseId !== null || responseBindingId !== null)) return null;
    ownerDecision = { feedbackFamily: family as FeedbackFamily, response: decisionRaw.response as string, decisionId, ownerResponseId, responseBindingId };
  }
  return {
    bundleAttachmentId, attachedCandidateId, feedbackFamily: family as FeedbackFamily,
    canonicalFeedbackExposureId, canonicalPosition,
    resolutionState: resolution as FeedbackLanguageItem["resolutionState"],
    exclusionReason: value.exclusion_reason as FeedbackLanguageItem["exclusionReason"],
    sourcePassage: { evidenceSpanId, text: sourceText, textSha256 },
    updateTextAvailable: value.update_text_available,
    coachAuthoringExclusionReason: value.coach_authoring_exclusion_reason as "source_audio_unavailable" | null,
    output, coachUpdate, ownerDecision,
  };
}

export type ConfidentMomentSourcePlaybackResult =
  | { kind: "ready"; blob: Blob }
  | { kind: "cancelled" | "retry" | "terminal" | "policy_invalid" | "disabled" };

export async function fetchConfidentMomentSourcePlayback(args: {
  bundleId: string;
  bundleAttachmentId: string;
  signal: AbortSignal;
}): Promise<ConfidentMomentSourcePlaybackResult> {
  if (!confidentMomentBundleEnabled()) return { kind: "disabled" };
  const path = `/api/v2/user/confident-moment-bundles/${encodeURIComponent(args.bundleId)}/attachments/${encodeURIComponent(args.bundleAttachmentId)}/source-playback`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await request(path, { method: "GET", signal: args.signal });
      if (args.signal.aborted) return { kind: "cancelled" };
      if (!response) return { kind: "terminal" };
      if (response.status === 422) {
        const payload = object(await response.json().catch(() => null));
        return payload?.code === "CONFIDENT_MOMENT_SOURCE_MEDIA_POLICY_INVALID"
          ? { kind: "policy_invalid" }
          : { kind: "terminal" };
      }
      if (response.status === 409) {
        if (attempt === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 60));
          continue;
        }
        return { kind: "retry" };
      }
      if (!response.ok) return { kind: "terminal" };
      const blob = await response.blob();
      return blob.size > 0 ? { kind: "ready", blob } : { kind: "terminal" };
    } catch {
      return args.signal.aborted ? { kind: "cancelled" } : { kind: "terminal" };
    }
  }
  return { kind: "retry" };
}

export type ConfidentMomentExerciseCorrelation =
  | {
      status: "available";
      bundleId: string;
      bundleAttachmentId: string;
      offerId: string;
      feedbackResponseBindingId: string;
      n1CandidateSetId: string;
      authorizationCheckId: string;
      sourceAcquisitionReceiptId: string;
      sourceTargetSpeakerBindingId: string;
      correlationSha256: string;
    }
  | {
      status: "not_supplied";
      bundleId: string;
      bundleAttachmentId: string;
      offerId: null;
      correlationSha256: string;
    };

function mapExerciseCorrelation(raw: unknown, bundleId: string, attachmentId: string): ConfidentMomentExerciseCorrelation | null {
  const row = object(raw);
  if (!row || hasForbiddenKey(row) || row.contract_version !== "confident-moment-exercise-correlation-v2" || row.bundle_id !== bundleId || row.bundle_attachment_id !== attachmentId || row.dataset_eligible !== false || !sha(row.correlation_sha256)) return null;
  if (row.status === "not_supplied") {
    if (!exactKeys(row, ["contract_version", "status", "bundle_id", "bundle_attachment_id", "offer_id", "correlation_sha256", "dataset_eligible"]) || row.offer_id !== null) return null;
    return { status: "not_supplied", bundleId, bundleAttachmentId: attachmentId, offerId: null, correlationSha256: row.correlation_sha256 as string };
  }
  if (row.status !== "available" || !exactKeys(row, ["contract_version", "status", "bundle_id", "bundle_attachment_id", "offer_id", "feedback_response_binding_id", "n1_candidate_set_id", "authorization_check_id", "source_acquisition_receipt_id", "source_target_speaker_binding_id", "correlation_sha256", "dataset_eligible"])) return null;
  const offerId = uuid(row.offer_id), feedbackResponseBindingId = uuid(row.feedback_response_binding_id), n1CandidateSetId = uuid(row.n1_candidate_set_id), authorizationCheckId = uuid(row.authorization_check_id), sourceAcquisitionReceiptId = uuid(row.source_acquisition_receipt_id), sourceTargetSpeakerBindingId = uuid(row.source_target_speaker_binding_id);
  return offerId && feedbackResponseBindingId && n1CandidateSetId && authorizationCheckId && sourceAcquisitionReceiptId && sourceTargetSpeakerBindingId
    ? { status: "available", bundleId, bundleAttachmentId: attachmentId, offerId, feedbackResponseBindingId, n1CandidateSetId, authorizationCheckId, sourceAcquisitionReceiptId, sourceTargetSpeakerBindingId, correlationSha256: row.correlation_sha256 as string }
    : null;
}

export async function fetchConfidentMomentExerciseCorrelation(bundleId: string, attachmentId: string): Promise<ConfidentMomentMutationResult<ConfidentMomentExerciseCorrelation>> {
  if (!confidentMomentBundleEnabled()) return { kind: "disabled" };
  const response = await request(`/api/v2/user/mlc3/confident-moment-exercise/${encodeURIComponent(bundleId)}/${encodeURIComponent(attachmentId)}`, { method: "GET" });
  if (!response) return { kind: "error" };
  if (response.status === 409) return { kind: "retry" };
  if (!response.ok) return { kind: "error" };
  const value = mapExerciseCorrelation(await response.json().catch(() => null), bundleId, attachmentId);
  return value ? { kind: "ok", value } : { kind: "error" };
}

export function mapConfidentMomentProjection(raw: unknown): ConfidentMomentProjection | null {
  const value = object(raw);
  if (!value || !exactKeys(value, ["contract_version", "feedback_language_shape_version", "project_id", "take_id", "document_snapshot_id", "feedback_membership_id", "bundles", "coverage", "response_sha256"]) || value.contract_version !== CONFIDENT_MOMENT_CONTRACT || value.feedback_language_shape_version !== "feedback-language-items-v2") return null;
  const projectId = uuid(value.project_id), takeId = uuid(value.take_id), documentSnapshotId = uuid(value.document_snapshot_id), feedbackMembershipId = uuid(value.feedback_membership_id), responseSha256 = sha(value.response_sha256);
  const coverage = object(value.coverage);
  if (!projectId || !takeId || !documentSnapshotId || !feedbackMembershipId || !responseSha256 || !Array.isArray(value.bundles) || !coverage || !exactKeys(coverage, ["target_slide_count", "achieved_slide_count", "target_met"])) return null;
  const targetSlideCount = integer(coverage.target_slide_count), achievedSlideCount = integer(coverage.achieved_slide_count);
  if (targetSlideCount === null || achievedSlideCount === null || typeof coverage.target_met !== "boolean" || coverage.target_met !== (targetSlideCount > 0 && achievedSlideCount >= targetSlideCount)) return null;
  const bundles: ConfidentMomentBundle[] = [];
  const seenBundles = new Set<string>();
  const seenAttachments = new Set<string>();
  for (const rawBundle of value.bundles) {
    const bundle = object(rawBundle);
    if (!bundle || !exactKeys(bundle, ["bundle_id", "bundle_subject_kind", "slide_index", "block_key", "paragraph_id", "subject", "confidence_anchor", "feedback_language_items", "exercise", "root", "state_revision"]) || bundle.exercise !== null) return null;
    const bundleId = uuid(bundle.bundle_id), paragraphId = uuid(bundle.paragraph_id), slideIndex = integer(bundle.slide_index), blockKey = integer(bundle.block_key), stateRevision = integer(bundle.state_revision, 1);
    const subject = object(bundle.subject), root = object(bundle.root);
    if (!bundleId || seenBundles.has(bundleId) || !paragraphId || slideIndex === null || blockKey === null || stateRevision === null || !subject || !root || !Array.isArray(bundle.feedback_language_items)) return null;
    seenBundles.add(bundleId);
    const candidateId = uuid(subject.candidate_id), evidenceSpanId = uuid(subject.evidence_span_id), presentationId = uuid(subject.canonical_feedback_presentation_id);
    if (!candidateId || candidateId !== bundleId || !evidenceSpanId || !presentationId || !bigint(root.interaction_state_revision) || typeof root.is_orange !== "boolean" || typeof root.is_locked !== "boolean" || typeof root.can_restore_previous !== "boolean") return null;
    const attachments = bundle.feedback_language_items.map(mapFeedbackItem);
    if (attachments.some((item) => item === null)) return null;
    for (const attachment of attachments as FeedbackLanguageItem[]) {
      if (seenAttachments.has(attachment.bundleAttachmentId)) return null;
      seenAttachments.add(attachment.bundleAttachmentId);
    }
    const anchorRaw = bundle.confidence_anchor === null ? null : object(bundle.confidence_anchor);
    const kind = bundle.bundle_subject_kind;
    let confidenceAnchor: ConfidentMomentBundle["confidenceAnchor"] = null;
    if (kind === "confidence_anchor") {
      if (!anchorRaw) return null;
      const anchorCandidateId = uuid(anchorRaw.candidate_id), anchorEvidenceSpanId = uuid(anchorRaw.evidence_span_id), playbackReferenceId = text(anchorRaw.playback_reference_id);
      if (anchorCandidateId !== bundleId || anchorEvidenceSpanId !== evidenceSpanId || !playbackReferenceId) return null;
      confidenceAnchor = { candidateId: anchorCandidateId, evidenceSpanId: anchorEvidenceSpanId, playbackReferenceId };
    } else if (kind !== "no_anchor_paragraph_trigger" || anchorRaw) return null;
    const activeRootActionId = root.active_root_action_id === null ? null : uuid(root.active_root_action_id);
    const restoreProductActionId = root.restore_product_action_id === null ? null : uuid(root.restore_product_action_id);
    if ((root.active_root_action_id !== null && !activeRootActionId) || (root.restore_product_action_id !== null && !restoreProductActionId) || root.can_restore_previous !== (restoreProductActionId !== null)) return null;
    if (root.is_locked && !root.is_orange) return null;
    if (kind === "no_anchor_paragraph_trigger" && (root.is_orange || root.is_locked || root.can_restore_previous)) return null;
    bundles.push({
      bundleId, bundleSubjectKind: kind, slideIndex, blockKey, paragraphId,
      subject: { candidateId, evidenceSpanId, canonicalFeedbackPresentationId: presentationId },
      confidenceAnchor, feedbackLanguageItems: attachments as FeedbackLanguageItem[], exercise: null,
      root: {
        activeRootActionId,
        interactionStateRevision: root.interaction_state_revision as string,
        isOrange: root.is_orange, isLocked: root.is_locked,
        canRestorePrevious: root.can_restore_previous,
        restoreProductActionId,
      }, stateRevision,
    });
  }
  return { contractVersion: CONFIDENT_MOMENT_CONTRACT, feedbackLanguageShapeVersion: "feedback-language-items-v2", projectId, takeId, documentSnapshotId, feedbackMembershipId, bundles, coverage: { targetSlideCount, achievedSlideCount, targetMet: coverage.target_met }, responseSha256 };
}

async function request(path: string, init?: RequestInit): Promise<Response | null> {
  const token = await getAuthToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  try {
    return await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  } catch {
    return null;
  }
}

export async function fetchConfidentMomentBundles(projectId: string, takeId: string): Promise<ConfidentMomentFetchResult> {
  if (!confidentMomentBundleEnabled()) return { kind: "disabled" };
  const response = await request(`/api/v2/explore/arcs/${encodeURIComponent(projectId)}/confident-moment-bundles?take_id=${encodeURIComponent(takeId)}`);
  if (!response) return { kind: "error" };
  if (response.status === 404) return { kind: "disabled" };
  if (response.status === 409) return { kind: "retry" };
  if (!response.ok) return { kind: "error" };
  const projection = mapConfidentMomentProjection(await response.json().catch(() => null));
  return projection ? { kind: "ready", projection } : { kind: "error" };
}

const FORBIDDEN_KEYS = new Set([
  "score", "rank", "verdict", "ratio", "qualification", "qualification_state",
  "coach_judgment", "reviewer_id", "reviewer_principal_id", "model_prediction",
  "confidence_score",
]);

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  const row = object(value);
  return row
    ? Object.entries(row).some(([key, child]) => FORBIDDEN_KEYS.has(key) || hasForbiddenKey(child))
    : false;
}

async function mutate(path: string, body: Record<string, unknown>): Promise<ConfidentMomentMutationResult<Record<string, unknown>>> {
  if (!confidentMomentBundleEnabled()) return { kind: "disabled" };
  const response = await request(path, { method: "POST", body: JSON.stringify(body) });
  if (!response) return { kind: "error" };
  if (response.status === 409) return { kind: "retry" };
  if (!response.ok) return { kind: "error" };
  const value = await response.json().catch(() => null);
  const row = object(value);
  return row && !hasForbiddenKey(row)
    ? { kind: "ok", value: row }
    : { kind: "error" };
}

export interface BundleItemRenderReceipt {
  renderReceiptId: string;
}

export async function acknowledgeBundleItemRender(args: {
  bundleId: string; bundleAttachmentId: string; feedbackExposureId: string;
  renderInstanceId: string; idempotencyKey: string;
}): Promise<ConfidentMomentMutationResult<BundleItemRenderReceipt>> {
  const result = await mutate(
    `/api/v2/user/confident-moment-bundles/${encodeURIComponent(args.bundleId)}/render`,
    {
      bundle_attachment_id: args.bundleAttachmentId,
      feedback_exposure_id: args.feedbackExposureId,
      render_instance_id: args.renderInstanceId,
      idempotency_key: args.idempotencyKey,
    },
  );
  if (result.kind !== "ok") return result;
  const row = result.value;
  if (!exactKeys(row, ["render_contract_version", "bundle_id", "bundle_attachment_id", "feedback_exposure_id", "render_instance_id", "render_receipt_id", "dataset_eligible"]) || row.render_contract_version !== "confident-moment-bundle-item-render-v3" || row.bundle_id !== args.bundleId || row.bundle_attachment_id !== args.bundleAttachmentId || row.feedback_exposure_id !== args.feedbackExposureId || row.render_instance_id !== args.renderInstanceId || row.dataset_eligible !== false) return { kind: "error" };
  const renderReceiptId = uuid(row.render_receipt_id);
  return renderReceiptId ? { kind: "ok", value: { renderReceiptId } } : { kind: "error" };
}

export async function acknowledgeCoachUpdateRender(args: {
  bundleId: string; bundleAttachmentId: string; revisionId: string;
  revisionDeliveryId: string; presentationId: string; renderInstanceId: string;
  idempotencyKey: string;
}): Promise<ConfidentMomentMutationResult<{ renderedExposureId: string }>> {
  const result = await mutate(
    `/api/v2/user/confident-moment-bundles/${encodeURIComponent(args.bundleId)}/coach-updates/${encodeURIComponent(args.revisionId)}/render`,
    {
      bundle_attachment_id: args.bundleAttachmentId,
      revision_delivery_id: args.revisionDeliveryId,
      presentation_id: args.presentationId,
      render_instance_id: args.renderInstanceId,
      idempotency_key: args.idempotencyKey,
    },
  );
  if (result.kind !== "ok") return result;
  const row = result.value;
  if (!exactKeys(row, ["render_contract_version", "bundle_id", "bundle_attachment_id", "current_revision_id", "revision_delivery_id", "presentation_id", "render_instance_id", "rendered_exposure_id", "dataset_eligible"]) || row.render_contract_version !== "feedback-language-revision-render-v3" || row.bundle_id !== args.bundleId || row.bundle_attachment_id !== args.bundleAttachmentId || row.current_revision_id !== args.revisionId || row.revision_delivery_id !== args.revisionDeliveryId || row.presentation_id !== args.presentationId || row.render_instance_id !== args.renderInstanceId || row.dataset_eligible !== false) return { kind: "error" };
  const renderedExposureId = uuid(row.rendered_exposure_id);
  return renderedExposureId ? { kind: "ok", value: { renderedExposureId } } : { kind: "error" };
}

export interface FamilyResponseReceipt {
  decisionId: string;
  ownerResponseId: string | null;
  responseBindingId: string | null;
}

export async function recordBundleFamilyResponse(args: {
  bundleId: string; bundleAttachmentId: string; feedbackExposureId: string;
  feedbackFamily: FeedbackFamily; renderReceiptId: string; response: string;
  idempotencyKey: string;
}): Promise<ConfidentMomentMutationResult<FamilyResponseReceipt>> {
  if (!isFamilyResponse(args.feedbackFamily, args.response)) {
    return { kind: "error" };
  }
  const result = await mutate(
    `/api/v2/user/confident-moment-bundles/${encodeURIComponent(args.bundleId)}/attachments/${encodeURIComponent(args.bundleAttachmentId)}/response`,
    {
      feedback_exposure_id: args.feedbackExposureId,
      render_receipt_id: args.renderReceiptId,
      response: args.response,
      idempotency_key: args.idempotencyKey,
    },
  );
  if (result.kind !== "ok") return result;
  const row = result.value;
  if (!exactKeys(row, ["family_response_contract_version", "bundle_id", "bundle_attachment_id", "feedback_family", "response", "decision_id", "owner_response_id", "response_binding_id", "dataset_eligible"]) || row.family_response_contract_version !== "confident-moment-family-response-v1" || row.bundle_id !== args.bundleId || row.bundle_attachment_id !== args.bundleAttachmentId || row.feedback_family !== args.feedbackFamily || row.response !== args.response || row.dataset_eligible !== false) return { kind: "error" };
  const decisionId = uuid(row.decision_id);
  const ownerResponseId = row.owner_response_id === null ? null : uuid(row.owner_response_id);
  const responseBindingId = row.response_binding_id === null ? null : uuid(row.response_binding_id);
  if (!decisionId || (row.owner_response_id !== null && !ownerResponseId) || (row.response_binding_id !== null && !responseBindingId)) return { kind: "error" };
  if (args.feedbackFamily === "confident_voice") {
    if (!ownerResponseId || !responseBindingId) return { kind: "error" };
  } else if (ownerResponseId !== null || responseBindingId !== null) return { kind: "error" };
  return { kind: "ok", value: { decisionId, ownerResponseId, responseBindingId } };
}

export interface BundleTextUpdateReceipt {
  bindingId: string;
  resultPartRevisionId: string;
}

export async function applyBundleTextUpdate(args: {
  bundleId: string; bundleAttachmentId: string; targetPartId: string;
  body: Record<string, unknown>;
}): Promise<ConfidentMomentMutationResult<BundleTextUpdateReceipt>> {
  const result = await mutate(
    `/api/v2/user/confident-moment-bundles/${encodeURIComponent(args.bundleId)}/attachments/${encodeURIComponent(args.bundleAttachmentId)}/update-text`,
    args.body,
  );
  if (result.kind !== "ok") return result;
  const row = result.value;
  if (!exactKeys(row, ["bundle_text_update_contract_version", "binding_id", "source_document_snapshot_id", "source_document_version", "previous_user_text_revision", "result_user_text_revision", "previous_user_text_sha256", "result_user_text_sha256", "target_part_id", "result_part_revision_id", "dataset_eligible"]) || row.bundle_text_update_contract_version !== "bundle-text-update-v1" || row.source_document_snapshot_id !== args.body.source_document_snapshot_id || row.source_document_version !== args.body.source_document_version || row.previous_user_text_revision !== args.body.expected_user_text_revision || row.previous_user_text_sha256 !== args.body.expected_user_text_sha256 || row.target_part_id !== args.targetPartId || row.dataset_eligible !== false) return { kind: "error" };
  const bindingId = uuid(row.binding_id);
  const resultUserTextRevision = bigint(row.result_user_text_revision);
  const resultPartRevisionId = bigint(row.result_part_revision_id);
  const resultUserTextSha256 = sha(row.result_user_text_sha256);
  if (row.previous_user_text_revision === null ? row.previous_user_text_sha256 !== null : !bigint(row.previous_user_text_revision) || !sha(row.previous_user_text_sha256)) return { kind: "error" };
  return bindingId && resultUserTextRevision && resultPartRevisionId && resultUserTextSha256
    ? { kind: "ok", value: { bindingId, resultPartRevisionId } }
    : { kind: "error" };
}

export async function recordBundleRootAction(args: {
  bundleId: string; bundleAttachmentId: string; body: Record<string, unknown>;
}): Promise<ConfidentMomentMutationResult<{ productActionId: string }>> {
  const result = await mutate(
    `/api/v2/user/confident-moment-bundles/${encodeURIComponent(args.bundleId)}/root-actions`,
    { ...args.body, bundle_attachment_id: args.bundleAttachmentId },
  );
  if (result.kind !== "ok") return result;
  const row = result.value;
  if (!exactKeys(row, ["root_action_contract_version", "bundle_id", "bundle_attachment_id", "product_action_id", "active_root_action_id", "interaction_state_revision", "is_orange", "is_locked", "can_restore_previous", "restore_product_action_id", "dataset_eligible"]) || row.root_action_contract_version !== "confident-moment-root-action-v1" || row.bundle_id !== args.bundleId || row.bundle_attachment_id !== args.bundleAttachmentId || row.dataset_eligible !== false) return { kind: "error" };
  const productActionId = uuid(row.product_action_id);
  const activeRootActionId = row.active_root_action_id === null ? null : uuid(row.active_root_action_id);
  const restoreProductActionId = row.restore_product_action_id === null ? null : uuid(row.restore_product_action_id);
  if (!productActionId || !bigint(row.interaction_state_revision) || typeof row.is_orange !== "boolean" || typeof row.is_locked !== "boolean" || typeof row.can_restore_previous !== "boolean" || (row.active_root_action_id !== null && !activeRootActionId) || (row.restore_product_action_id !== null && !restoreProductActionId) || row.is_locked && !row.is_orange || row.can_restore_previous !== (restoreProductActionId !== null)) return { kind: "error" };
  return { kind: "ok", value: { productActionId } };
}

export function newConfidentMomentIdentity(): string {
  return crypto.randomUUID();
}
