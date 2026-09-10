import { getAuthToken } from "@/lib/api/auth-client";

export const mlc3FirstClientPresentationEnabled =
  process.env.NEXT_PUBLIC_MLC3_SERVICE_UI_ENABLED === "true";

export type FiveStateConfidence =
  | "confident_yes"
  | "confident_in_between"
  | "confident_no"
  | "confident_not_sure"
  | "confident_audio_unclear";

export interface ServiceFeedbackIdentity {
  projectId: string;
  takeId: string;
  membershipId: string;
  candidateId: string;
  feedbackExposureId: string;
  contentIdentitySha256: string;
  n1CandidateSetId: string;
  authorizationCheckId: string;
  sourceAcquisitionReceiptId: string;
}

export interface ServiceExerciseOffer {
  id: string;
  outcome: "service_matched" | "coach_exercise_requested";
  selectedExerciseVersionId: string | null;
  candidateCount: number;
  eligibleCount: number;
  exercise: null | {
    versionId: string;
    instructionText: string;
    contentIdentitySha256: string;
    mediaUrl: string;
    mediaContentType: string;
  };
}

export interface ServicePracticeSession {
  id: string;
  exactPassage: string;
  sourceOfferId: string;
  exerciseVersionId: string;
  contentIdentitySha256: string;
  state: string;
}

export interface ServicePracticeAttempt {
  attemptId: string;
  attemptIndex: number;
  audioRef: string;
  durationMs: number;
  transcriptState: string;
  validity: "valid" | "invalid" | "pending";
  reasonCodes: string[];
  selectionState: string;
  selectedAttemptId: string | null;
  speakerConfirmationRequired: boolean;
  ownerPair: null | {
    pairRevisionId: string;
    pairAssignmentId: string;
    leftClip: "before" | "after";
    rightClip: "before" | "after";
  };
}

export interface ServiceSpeakerTarget {
  assertionId: string;
  speakerId: string;
  targetBindingId: string;
  replayed: boolean;
  meaning: "identity_routing_only";
  datasetEligible: false;
}

export interface ServiceCoachGuidance {
  attachmentVersionId: string;
  feedbackCandidateId: string;
  attachmentClass: "general_product_guidance" | "mlc3_exercise";
  writtenNote: string | null;
  mediaUrl: string | null;
  mediaContentType: string | null;
  versionSha256: string;
}

type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string | null };

async function headers(idempotencyKey: string, json = true) {
  const token = await getAuthToken();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Idempotency-Key": idempotencyKey,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function request<T>(
  path: string,
  init: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`/api/v2/user/mlc3/${path}`, {
      ...init,
      cache: "no-store",
    });
    const data = await response.json().catch(() => null) as T & {
      error?: unknown;
    } | null;
    if (response.ok && data) return { ok: true, value: data };
    return {
      ok: false,
      error: typeof data?.error === "string" ? data.error : null,
    };
  } catch {
    return { ok: false, error: null };
  }
}

function mapOffer(raw: Record<string, unknown>): ServiceExerciseOffer | null {
  const outcome = raw.outcome;
  if (
    typeof raw.id !== "string" ||
    (outcome !== "service_matched" && outcome !== "coach_exercise_requested") ||
    typeof raw.candidate_count !== "number" ||
    typeof raw.eligible_count !== "number"
  ) return null;
  const exerciseRaw = raw.exercise;
  let exercise: ServiceExerciseOffer["exercise"] = null;
  if (exerciseRaw && typeof exerciseRaw === "object") {
    const item = exerciseRaw as Record<string, unknown>;
    if (
      typeof item.version_id !== "string" ||
      typeof item.instruction_text !== "string" ||
      typeof item.content_identity_sha256 !== "string" ||
      typeof item.media_url !== "string" ||
      typeof item.media_content_type !== "string"
    ) return null;
    exercise = {
      versionId: item.version_id,
      instructionText: item.instruction_text,
      contentIdentitySha256: item.content_identity_sha256,
      mediaUrl: item.media_url,
      mediaContentType: item.media_content_type,
    };
  }
  return {
    id: raw.id,
    outcome,
    selectedExerciseVersionId:
      typeof raw.selected_exercise_version_id === "string"
        ? raw.selected_exercise_version_id
        : null,
    candidateCount: raw.candidate_count,
    eligibleCount: raw.eligible_count,
    exercise,
  };
}

export async function confirmFeedbackRender(
  identity: ServiceFeedbackIdentity,
  renderInstanceId: string,
  clientVersion: string,
  idempotencyKey: string,
): Promise<ApiResult<{ render_receipt_id: string }>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  return request("feedback/render", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      membership_id: identity.membershipId,
      candidate_id: identity.candidateId,
      feedback_exposure_id: identity.feedbackExposureId,
      render_instance_id: renderInstanceId,
      content_identity_sha256: identity.contentIdentitySha256,
      rendered_at: new Date().toISOString(),
      client_version: clientVersion,
    }),
  });
}

export async function answerServiceFeedback(
  identity: ServiceFeedbackIdentity,
  renderReceiptId: string,
  response: FiveStateConfidence,
  idempotencyKey: string,
): Promise<ApiResult<{
  response_binding_id: string;
  response: FiveStateConfidence;
  exercise_offer_allowed: boolean;
}>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  return request("feedback/respond", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      project_id: identity.projectId,
      take_id: identity.takeId,
      membership_id: identity.membershipId,
      candidate_id: identity.candidateId,
      feedback_exposure_id: identity.feedbackExposureId,
      render_receipt_id: renderReceiptId,
      response,
    }),
  });
}

function mapSpeakerTarget(value: unknown): ServiceSpeakerTarget | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.assertion_id !== "string" ||
    typeof row.speaker_id !== "string" ||
    typeof row.target_binding_id !== "string" ||
    typeof row.replayed !== "boolean" ||
    row.meaning !== "identity_routing_only" ||
    row.dataset_eligible !== false
  ) return null;
  return {
    assertionId: row.assertion_id,
    speakerId: row.speaker_id,
    targetBindingId: row.target_binding_id,
    replayed: row.replayed,
    meaning: row.meaning,
    datasetEligible: false,
  };
}

export async function confirmSourceSelfSpeaker(
  identity: ServiceFeedbackIdentity,
  idempotencyKey: string,
): Promise<ApiResult<ServiceSpeakerTarget>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  const result = await request<Record<string, unknown>>("feedback/speaker", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      membership_id: identity.membershipId,
      candidate_id: identity.candidateId,
      assertion: "this_is_my_voice",
    }),
  });
  if (!result.ok) return result;
  const target = mapSpeakerTarget(result.value);
  return target ? { ok: true, value: target } : { ok: false, error: null };
}

export async function createServiceExerciseOffer(
  identity: ServiceFeedbackIdentity,
  feedbackResponseBindingId: string,
  idempotencyKey: string,
): Promise<ApiResult<ServiceExerciseOffer>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  const result = await request<Record<string, unknown>>("exercise-offers", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      feedback_response_binding_id: feedbackResponseBindingId,
      n1_candidate_set_id: identity.n1CandidateSetId,
      authorization_check_id: identity.authorizationCheckId,
    }),
  });
  if (!result.ok) return result;
  const offer = mapOffer(result.value);
  return offer ? { ok: true, value: offer } : { ok: false, error: null };
}

export async function fetchServiceCoachGuidance(
  membershipId: string,
  idempotencyKey: string,
): Promise<ApiResult<ServiceCoachGuidance[]>> {
  const auth = await headers(idempotencyKey, false);
  if (!auth) return { ok: false, error: null };
  const result = await request<Record<string, unknown>>(
    `guidance/${encodeURIComponent(membershipId)}`,
    { method: "GET", headers: auth },
  );
  if (!result.ok) return result;
  if (!Array.isArray(result.value.attachments)) {
    return { ok: false, error: null };
  }
  const attachments: ServiceCoachGuidance[] = [];
  for (const raw of result.value.attachments) {
    if (!raw || typeof raw !== "object") return { ok: false, error: null };
    const row = raw as Record<string, unknown>;
    if (
      typeof row.attachment_version_id !== "string" ||
      typeof row.feedback_candidate_id !== "string" ||
      (row.attachment_class !== "general_product_guidance" &&
       row.attachment_class !== "mlc3_exercise") ||
      (row.written_note !== null && typeof row.written_note !== "string") ||
      (row.media_url !== null && typeof row.media_url !== "string") ||
      (row.media_content_type !== null &&
       typeof row.media_content_type !== "string") ||
      typeof row.version_sha256 !== "string" || row.serves_user !== true ||
      row.dataset_eligible !== false
    ) return { ok: false, error: null };
    attachments.push({
      attachmentVersionId: row.attachment_version_id,
      feedbackCandidateId: row.feedback_candidate_id,
      attachmentClass: row.attachment_class,
      writtenNote: row.written_note as string | null,
      mediaUrl: row.media_url as string | null,
      mediaContentType: row.media_content_type as string | null,
      versionSha256: row.version_sha256,
    });
  }
  return { ok: true, value: attachments };
}

export async function recordServiceCoachGuidanceEvent(
  attachmentVersionId: string,
  eventKind: "rendered" | "played",
  renderInstanceId: string | null,
  idempotencyKey: string,
): Promise<ApiResult<{ event_id: string; event_kind: string }>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  return request(
    `guidance/${encodeURIComponent(attachmentVersionId)}/events`,
    {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        event_kind: eventKind,
        render_instance_id: eventKind === "rendered" ? renderInstanceId : null,
        event_payload: {},
      }),
    },
  );
}

export async function fetchServiceExerciseOffer(
  offerId: string,
  idempotencyKey: string,
): Promise<ApiResult<ServiceExerciseOffer>> {
  const auth = await headers(idempotencyKey, false);
  if (!auth) return { ok: false, error: null };
  const result = await request<Record<string, unknown>>(
    `exercise-offers/${encodeURIComponent(offerId)}`,
    { headers: auth },
  );
  if (!result.ok) return result;
  const offer = mapOffer(result.value);
  return offer ? { ok: true, value: offer } : { ok: false, error: null };
}

export async function recordServiceEvent(
  scope: "offer" | "practice",
  id: string,
  eventKind: "render_confirmed" | "playback_started" | "playback_completed",
  renderInstanceId: string,
  contentIdentitySha256: string,
  idempotencyKey: string,
): Promise<ApiResult<{ event_id: string; event_kind: string }>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  const path = scope === "offer"
    ? `exercise-offers/${encodeURIComponent(id)}/events`
    : `practice-sessions/${encodeURIComponent(id)}/events`;
  return request(path, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      event_kind: eventKind,
      render_instance_id: renderInstanceId,
      content_identity_sha256: contentIdentitySha256,
      event_payload: {},
      occurred_at: new Date().toISOString(),
    }),
  });
}

export async function createServicePracticeSession(
  offerId: string,
  identity: ServiceFeedbackIdentity,
  idempotencyKey: string,
): Promise<ApiResult<{ practice_session_id: string }>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  return request(`exercise-offers/${encodeURIComponent(offerId)}/practice-sessions`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      source_acquisition_receipt_id: identity.sourceAcquisitionReceiptId,
    }),
  });
}

export async function fetchServicePracticeSession(
  sessionId: string,
  idempotencyKey: string,
): Promise<ApiResult<ServicePracticeSession>> {
  const auth = await headers(idempotencyKey, false);
  if (!auth) return { ok: false, error: null };
  const result = await request<Record<string, unknown>>(
    `practice-sessions/${encodeURIComponent(sessionId)}`,
    { headers: auth },
  );
  if (!result.ok) return result;
  const row = result.value;
  if (
    typeof row.id !== "string" ||
    typeof row.exact_passage !== "string" ||
    typeof row.source_offer_id !== "string" ||
    typeof row.exercise_version_id !== "string" ||
    typeof row.content_identity_sha256 !== "string" ||
    typeof row.state !== "string"
  ) return { ok: false, error: null };
  return {
    ok: true,
    value: {
      id: row.id,
      exactPassage: row.exact_passage,
      sourceOfferId: row.source_offer_id,
      exerciseVersionId: row.exercise_version_id,
      contentIdentitySha256: row.content_identity_sha256,
      state: row.state,
    },
  };
}

export async function uploadServicePracticeAttempt(
  session: ServicePracticeSession,
  audio: Blob,
  renderInstanceId: string,
  captureStartedAt: string,
  captureCompletedAt: string,
  idempotencyKey: string,
): Promise<ApiResult<ServicePracticeAttempt>> {
  const auth = await headers(idempotencyKey, false);
  if (!auth) return { ok: false, error: null };
  const form = new FormData();
  form.append("audio", audio, "practice.webm");
  form.append("render_instance_id", renderInstanceId);
  form.append("content_identity_sha256", session.contentIdentitySha256);
  form.append("capture_started_at", captureStartedAt);
  form.append("capture_completed_at", captureCompletedAt);
  form.append("recording_conditions", JSON.stringify({ source: "web_microphone" }));
  form.append("client_version", "mlc3-first-client-web-v1");
  const result = await request<Record<string, unknown>>(
    `practice-sessions/${encodeURIComponent(session.id)}/attempts`, {
    method: "POST",
    headers: auth,
    body: form,
  });
  if (!result.ok) return result;
  const row = result.value;
  const pair = row.owner_pair;
  let ownerPair: ServicePracticeAttempt["ownerPair"] = null;
  if (pair && typeof pair === "object") {
    const value = pair as Record<string, unknown>;
    if (
      typeof value.pair_revision_id !== "string" ||
      typeof value.pair_assignment_id !== "string" ||
      (value.left_clip !== "before" && value.left_clip !== "after") ||
      (value.right_clip !== "before" && value.right_clip !== "after")
    ) return { ok: false, error: null };
    ownerPair = {
      pairRevisionId: value.pair_revision_id,
      pairAssignmentId: value.pair_assignment_id,
      leftClip: value.left_clip,
      rightClip: value.right_clip,
    };
  }
  if (
    typeof row.attempt_id !== "string" ||
    typeof row.attempt_index !== "number" ||
    typeof row.audio_ref !== "string" ||
    typeof row.duration_ms !== "number" ||
    typeof row.transcript_state !== "string" ||
    (row.validity !== "valid" && row.validity !== "invalid" &&
      row.validity !== "pending") ||
    !Array.isArray(row.reason_codes) ||
    typeof row.selection_state !== "string"
  ) return { ok: false, error: null };
  return {
    ok: true,
    value: {
      attemptId: row.attempt_id,
      attemptIndex: row.attempt_index,
      audioRef: row.audio_ref,
      durationMs: row.duration_ms,
      transcriptState: row.transcript_state,
      validity: row.validity,
      reasonCodes: row.reason_codes.filter(
        (item): item is string => typeof item === "string",
      ),
      selectionState: row.selection_state,
      selectedAttemptId:
        typeof row.selected_attempt_id === "string"
          ? row.selected_attempt_id
          : null,
      speakerConfirmationRequired: row.speaker_confirmation_required === true,
      ownerPair,
    },
  };
}

export async function confirmPracticeSelfSpeaker(
  attemptId: string,
  idempotencyKey: string,
): Promise<ApiResult<{
  speakerTarget: ServiceSpeakerTarget;
  eligibilityResult: "same_speaker_eligible";
  ownerPair: NonNullable<ServicePracticeAttempt["ownerPair"]>;
}>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  const result = await request<Record<string, unknown>>(
    `practice-attempts/${encodeURIComponent(attemptId)}/speaker`,
    {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ assertion: "this_is_my_voice" }),
    },
  );
  if (!result.ok) return result;
  const speakerTarget = mapSpeakerTarget(result.value.speaker_target);
  const pair = result.value.owner_pair;
  if (
    !speakerTarget ||
    result.value.eligibility_result !== "same_speaker_eligible" ||
    !pair || typeof pair !== "object"
  ) return { ok: false, error: null };
  const ownerPair = pair as Record<string, unknown>;
  if (
    typeof ownerPair.pair_revision_id !== "string" ||
    typeof ownerPair.pair_assignment_id !== "string" ||
    (ownerPair.left_clip !== "before" && ownerPair.left_clip !== "after") ||
    (ownerPair.right_clip !== "before" && ownerPair.right_clip !== "after")
  ) return { ok: false, error: null };
  return {
    ok: true,
    value: {
      speakerTarget,
      eligibilityResult: "same_speaker_eligible",
      ownerPair: {
        pairRevisionId: ownerPair.pair_revision_id,
        pairAssignmentId: ownerPair.pair_assignment_id,
        leftClip: ownerPair.left_clip,
        rightClip: ownerPair.right_clip,
      },
    },
  };
}

export async function answerServicePracticePreference(
  sessionId: string,
  pairAssignmentId: string,
  answer: "prefer_left" | "prefer_right" | "same" | "not_sure" |
    "audio_unusable",
  idempotencyKey: string,
): Promise<ApiResult<{ judgment_id: string; answer: string }>> {
  const auth = await headers(idempotencyKey);
  if (!auth) return { ok: false, error: null };
  return request(`practice-sessions/${encodeURIComponent(sessionId)}/preference`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ pair_assignment_id: pairAssignmentId, answer }),
  });
}
