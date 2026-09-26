"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import {
  acknowledgeBundleItemRender,
  acknowledgeCoachUpdateRender,
  applyBundleTextUpdate,
  fetchConfidentMomentSourcePlayback,
  newConfidentMomentIdentity,
  recordBundleFamilyResponse,
  recordBundleRootAction,
  rootingCoverageEnabled,
  type ConfidentMomentBundle,
  type ConfidentMomentOwnerEdit,
  type FeedbackLanguageItem,
} from "@/services/api/confidentMomentBundles";
import ConfidentMomentExercisePanel from "./ConfidentMomentExercisePanel";
import ConfidenceLabelChips from "./ConfidenceLabelChips";
import { FeedbackPagerBar, type Pager } from "./feedbackPager";
import { ParagraphHistoryBlock, type HistoryTarget } from "./ParagraphSheet";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import AiGeneratedNote from "./AiGeneratedNote";
import { aiGeneratedAttrs } from "@/lib/willab/aiGeneratedMark";

type PersistentRenderAttempt = {
  renderInstanceId: string;
  idempotencyKey: string;
  receiptId: string | null;
};

const bundleRenderAttempts = new Map<string, PersistentRenderAttempt>();
const coachRenderAttempts = new Map<string, PersistentRenderAttempt>();
const nonRenderIdempotencyKeys = new Map<string, string>();

function stableIdempotencyKey(identity: string, prefix: string): string {
  const existing = nonRenderIdempotencyKeys.get(identity);
  if (existing) return existing;
  const created = `${prefix}:${newConfidentMomentIdentity()}`;
  nonRenderIdempotencyKeys.set(identity, created);
  return created;
}

function renderAttempt(
  store: Map<string, PersistentRenderAttempt>,
  key: string,
  prefix: string,
): PersistentRenderAttempt {
  const existing = store.get(key);
  if (existing) return existing;
  const renderInstanceId = newConfidentMomentIdentity();
  const created = {
    renderInstanceId,
    idempotencyKey: `${prefix}:${renderInstanceId}`,
    receiptId: null,
  };
  store.set(key, created);
  return created;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ConfidentMomentVisibleRenderAck({
  identity,
  onVisible,
}: {
  identity: string;
  onVisible: (renderInstanceId: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || fired.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (fired.current || !entries.some((entry) => entry.isIntersecting)) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!element.isConnected || fired.current) return;
        fired.current = true;
        onVisible(newConfidentMomentIdentity());
      }));
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [identity, onVisible]);
  return <div ref={ref} data-confident-moment-visible={identity} />;
}

function titleFor(item: FeedbackLanguageItem): string {
  if (item.feedbackFamily === "confident_voice") return "Confident voice";
  if (item.output?.outputKind === "rephrase") return "A clearer version";
  return "A note for this moment";
}

export default function ConfidentMomentCoachingBundle({
  bundle,
  documentSnapshotId,
  ownerEdit,
  onChanged,
  onClose,
  pager = null,
  history = null,
}: {
  bundle: ConfidentMomentBundle;
  documentSnapshotId: string;
  ownerEdit: ConfidentMomentOwnerEdit | null;
  onChanged: () => void;
  onClose: () => void;
  /** Back / Next across the Take's bookmarks (founder 2026-09-25). */
  pager?: Pager | null;
  /** The paragraph's own history, shown under the coach's work once the
   *  moment is answered: a done bookmark shows its history (founder
   *  2026-09-25). */
  history?: HistoryTarget | null;
}) {
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [responses, setResponses] = useState<Record<string, { decisionId: string; ownerResponseId: string | null; responseBindingId: string | null }>>(() =>
    Object.fromEntries(bundle.feedbackLanguageItems.flatMap((item) => item.ownerDecision
      ? [[item.bundleAttachmentId, {
          decisionId: item.ownerDecision.decisionId,
          ownerResponseId: item.ownerDecision.ownerResponseId,
          responseBindingId: item.ownerDecision.responseBindingId,
        }]]
      : [])),
  );
  const [sourcePlayback, setSourcePlayback] = useState<Record<string, "idle" | "loading" | "ready" | "completed" | "failed" | "terminal">>({});
  const [sourceAudioUrls, setSourceAudioUrls] = useState<Record<string, string>>({});
  const sourcePlaybackAbort = useRef(new Map<string, AbortController>());
  const [textRootSource, setTextRootSource] = useState<{
    attachmentId: string;
    bindingId: string;
    partRevisionId: string;
  } | null>(null);
  const [practiceRootSource, setPracticeRootSource] = useState<{
    attachmentId: string;
    practiceAttemptId: string;
    sourceTargetSpeakerBindingId: string;
    practiceTargetSpeakerBindingId: string;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const items = useMemo(
    () => bundle.feedbackLanguageItems.filter((item) => item.resolutionState !== "excluded"),
    [bundle.feedbackLanguageItems],
  );
  const confidenceItem = items.find((item) => item.feedbackFamily === "confident_voice") ?? null;
  const confidenceAnswered = confidenceItem
    ? Boolean(responses[confidenceItem.bundleAttachmentId])
    : true;
  const visibleItems = confidenceAnswered || !confidenceItem ? items : [confidenceItem];

  useEffect(() => () => {
    for (const controller of sourcePlaybackAbort.current.values()) controller.abort();
    for (const url of Object.values(sourceAudioUrls)) URL.revokeObjectURL(url);
  }, [sourceAudioUrls]);

  const loadSourcePlayback = useCallback(async (item: FeedbackLanguageItem) => {
    const existing = sourcePlaybackAbort.current.get(item.bundleAttachmentId);
    existing?.abort();
    const controller = new AbortController();
    sourcePlaybackAbort.current.set(item.bundleAttachmentId, controller);
    setSourcePlayback((state) => ({ ...state, [item.bundleAttachmentId]: "loading" }));
    const result = await fetchConfidentMomentSourcePlayback({
      bundleId: bundle.bundleId,
      bundleAttachmentId: item.bundleAttachmentId,
      signal: controller.signal,
    });
    if (sourcePlaybackAbort.current.get(item.bundleAttachmentId) !== controller) return;
    sourcePlaybackAbort.current.delete(item.bundleAttachmentId);
    if (result.kind === "cancelled") {
      setSourcePlayback((state) => ({ ...state, [item.bundleAttachmentId]: "idle" }));
      return;
    }
    if (result.kind === "policy_invalid" || result.kind === "terminal") {
      setSourcePlayback((state) => ({ ...state, [item.bundleAttachmentId]: "terminal" }));
      return;
    }
    if (result.kind !== "ready") {
      setSourcePlayback((state) => ({ ...state, [item.bundleAttachmentId]: "failed" }));
      return;
    }
    const url = URL.createObjectURL(result.blob);
    setSourceAudioUrls((state) => {
      if (state[item.bundleAttachmentId]) URL.revokeObjectURL(state[item.bundleAttachmentId]);
      return { ...state, [item.bundleAttachmentId]: url };
    });
    setSourcePlayback((state) => ({ ...state, [item.bundleAttachmentId]: "ready" }));
  }, [bundle.bundleId]);

  const cancelSourcePlayback = useCallback((attachmentId: string) => {
    sourcePlaybackAbort.current.get(attachmentId)?.abort();
  }, []);

  const acknowledge = useCallback(async (item: FeedbackLanguageItem) => {
    const key = `${bundle.bundleId}:${item.bundleAttachmentId}:${item.canonicalFeedbackExposureId}`;
    const attempt = renderAttempt(bundleRenderAttempts, key, "bundle-render");
    if (!attempt.receiptId) {
      // One bounded exact retry. Remounts reuse the same attempt identity too.
      for (let retry = 0; retry < 2 && !attempt.receiptId; retry += 1) {
        const result = await acknowledgeBundleItemRender({
          bundleId: bundle.bundleId,
          bundleAttachmentId: item.bundleAttachmentId,
          feedbackExposureId: item.canonicalFeedbackExposureId,
          renderInstanceId: attempt.renderInstanceId,
          idempotencyKey: attempt.idempotencyKey,
        });
        if (result.kind === "ok") attempt.receiptId = result.value.renderReceiptId;
        if (result.kind === "disabled") break;
      }
    }
    if (attempt.receiptId) {
      setReceipts((current) => ({ ...current, [item.bundleAttachmentId]: attempt.receiptId! }));
    }
    if (item.coachUpdate?.unread) {
      const coachKey = `${bundle.bundleId}:${item.bundleAttachmentId}:${item.coachUpdate.currentRevisionId}:${item.coachUpdate.presentationId}`;
      const coachAttempt = renderAttempt(coachRenderAttempts, coachKey, "coach-update-render");
      if (!coachAttempt.receiptId) {
        const result = await acknowledgeCoachUpdateRender({
          bundleId: bundle.bundleId,
          bundleAttachmentId: item.bundleAttachmentId,
          revisionId: item.coachUpdate.currentRevisionId,
          revisionDeliveryId: item.coachUpdate.revisionDeliveryId,
          presentationId: item.coachUpdate.presentationId,
          renderInstanceId: coachAttempt.renderInstanceId,
          idempotencyKey: coachAttempt.idempotencyKey,
        });
        if (result.kind === "ok") coachAttempt.receiptId = result.value.renderedExposureId;
      }
      if (coachAttempt.receiptId) onChanged();
    }
  }, [bundle.bundleId, onChanged]);

  const respond = useCallback(async (item: FeedbackLanguageItem, response: string) => {
    const receipt = receipts[item.bundleAttachmentId];
    if (!receipt || busy) return;
    setBusy(item.bundleAttachmentId);
    const responseIdentity = `${bundle.bundleId}:${item.bundleAttachmentId}:${item.canonicalFeedbackExposureId}:${receipt}:${response}`;
    const result = await recordBundleFamilyResponse({
      bundleId: bundle.bundleId,
      bundleAttachmentId: item.bundleAttachmentId,
      feedbackExposureId: item.canonicalFeedbackExposureId,
      feedbackFamily: item.feedbackFamily,
      renderReceiptId: receipt,
      response,
      idempotencyKey: stableIdempotencyKey(responseIdentity, "bundle-response"),
    });
    setBusy(null);
    if (result.kind === "ok") {
      setResponses((current) => ({
        ...current,
        [item.bundleAttachmentId]: {
          decisionId: result.value.decisionId,
          ownerResponseId: result.value.ownerResponseId,
          responseBindingId: result.value.responseBindingId,
        },
      }));
      onChanged();
    }
  }, [bundle.bundleId, busy, onChanged, receipts]);

  const updateText = useCallback(async (item: FeedbackLanguageItem) => {
    const receipt = receipts[item.bundleAttachmentId];
    if (
      !receipt || !ownerEdit || ownerEdit.text === null ||
      ownerEdit.sourceDocumentVersion === null ||
      ownerEdit.userTextRevision === null || ownerEdit.userTextSha256 === null || busy
    ) return;
    setBusy(item.bundleAttachmentId);
    const persistedDecision = responses[item.bundleAttachmentId]?.decisionId ?? (
      item.ownerDecision?.response === "apply_suggestion" ? item.ownerDecision.decisionId : null
    );
    const responseIdentity = `${bundle.bundleId}:${item.bundleAttachmentId}:${item.canonicalFeedbackExposureId}:${receipt}:apply_suggestion`;
    const decision = persistedDecision ? null : await recordBundleFamilyResponse({
        bundleId: bundle.bundleId,
        bundleAttachmentId: item.bundleAttachmentId,
        feedbackExposureId: item.canonicalFeedbackExposureId,
        feedbackFamily: item.feedbackFamily,
        renderReceiptId: receipt,
        response: "apply_suggestion",
        idempotencyKey: stableIdempotencyKey(responseIdentity, "bundle-response"),
      });
    const correctionDecisionId = persistedDecision ?? (decision?.kind === "ok" ? decision.value.decisionId : null);
    if (decision?.kind === "ok") {
      setResponses((current) => ({ ...current, [item.bundleAttachmentId]: {
        decisionId: decision.value.decisionId,
        ownerResponseId: decision.value.ownerResponseId,
        responseBindingId: decision.value.responseBindingId,
      } }));
    }
    const inventory = await Promise.all(ownerEdit.parts.map(async (part) => ({
      position: part.position,
      part_id: part.id,
      text_sha256: await sha256(part.text),
      current_part_revision_id: part.currentPartRevisionId,
      locked: part.locked,
    })));
    const result = correctionDecisionId
      ? await applyBundleTextUpdate({
          bundleId: bundle.bundleId,
          bundleAttachmentId: item.bundleAttachmentId,
          targetPartId: bundle.paragraphId,
          body: {
            correction_decision_id: correctionDecisionId,
            feedback_exposure_id: item.canonicalFeedbackExposureId,
            render_receipt_id: receipt,
            source_document_snapshot_id: documentSnapshotId,
            source_document_version: ownerEdit.sourceDocumentVersion,
            expected_current_part_revision_id:
              ownerEdit.parts.find((part) => part.id === bundle.paragraphId)?.currentPartRevisionId ?? null,
            expected_user_text_revision: ownerEdit.userTextRevision,
            expected_user_text_sha256: ownerEdit.userTextSha256,
            expected_part_inventory: inventory,
            idempotency_key: stableIdempotencyKey(
              `${bundle.bundleId}:${item.bundleAttachmentId}:${correctionDecisionId}:${documentSnapshotId}:${ownerEdit.sourceDocumentVersion}:${ownerEdit.userTextRevision}:${ownerEdit.userTextSha256}:${bundle.paragraphId}`,
              "bundle-text",
            ),
          },
        })
      : null;
    setBusy(null);
    if (result?.kind === "ok") {
      setTextRootSource({
        attachmentId: item.bundleAttachmentId,
        bindingId: result.value.bindingId,
        partRevisionId: result.value.resultPartRevisionId,
      });
      onChanged();
    }
  }, [bundle.bundleId, bundle.paragraphId, busy, documentSnapshotId, onChanged, ownerEdit, receipts, responses]);

  const rootSource = useMemo(() => {
    if (practiceRootSource) {
      const confidence = items.find((item) =>
        item.bundleAttachmentId === practiceRootSource.attachmentId &&
        item.feedbackFamily === "confident_voice",
      );
      if (confidence) return {
        attachmentId: practiceRootSource.attachmentId,
        feedbackExposureId: responses[confidence.bundleAttachmentId]
          ? confidence.canonicalFeedbackExposureId
          : null,
        ownerResponseId: responses[confidence.bundleAttachmentId]?.ownerResponseId ?? null,
        idealTextRevisionId: null,
        textUpdateBindingId: null,
        practiceAttemptId: practiceRootSource.practiceAttemptId,
        sourceTargetSpeakerBindingId: practiceRootSource.sourceTargetSpeakerBindingId,
        practiceTargetSpeakerBindingId: practiceRootSource.practiceTargetSpeakerBindingId,
      };
    }
    if (textRootSource) return {
      attachmentId: textRootSource.attachmentId,
      feedbackExposureId: null,
      ownerResponseId: null,
      idealTextRevisionId: textRootSource.partRevisionId,
      textUpdateBindingId: textRootSource.bindingId,
      practiceAttemptId: null,
      sourceTargetSpeakerBindingId: null,
      practiceTargetSpeakerBindingId: null,
    };
    const persistedText = ownerEdit?.currentBundleTextUpdateBinding;
    if (
      persistedText?.bundleId === bundle.bundleId &&
      items.some((item) => item.bundleAttachmentId === persistedText.attachmentId)
    ) return {
      attachmentId: persistedText.attachmentId,
      feedbackExposureId: null,
      ownerResponseId: null,
      idealTextRevisionId: persistedText.resultPartRevisionId,
      textUpdateBindingId: persistedText.bindingId,
      practiceAttemptId: null,
      sourceTargetSpeakerBindingId: null,
      practiceTargetSpeakerBindingId: null,
    };
    const confidence = items.find((item) =>
      item.feedbackFamily === "confident_voice" &&
      responses[item.bundleAttachmentId]?.ownerResponseId,
    );
    return confidence ? {
      attachmentId: confidence.bundleAttachmentId,
      feedbackExposureId: confidence.canonicalFeedbackExposureId,
      ownerResponseId: responses[confidence.bundleAttachmentId].ownerResponseId,
      idealTextRevisionId: null,
      textUpdateBindingId: null,
      practiceAttemptId: null,
      sourceTargetSpeakerBindingId: null,
      practiceTargetSpeakerBindingId: null,
    } : null;
  }, [bundle.bundleId, items, ownerEdit?.currentBundleTextUpdateBinding, practiceRootSource, responses, textRootSource]);

  // Save only: Unlock and Restore are gone (founder 2026-09-25, Q6 A).
  const rootAction = useCallback(async (action: "save_owner_selected_root") => {
    if (!rootingCoverageEnabled() || busy) return;
    const attachmentId = rootSource?.attachmentId ?? items[0]?.bundleAttachmentId;
    if (!attachmentId || !rootSource) return;
    setBusy(attachmentId);
    const rootBody = {
      action,
      expected_block_head_action_id: bundle.root.activeRootActionId,
      source_feedback_exposure_id: rootSource?.feedbackExposureId ?? null,
      source_owner_response_id: rootSource?.ownerResponseId ?? null,
      source_practice_attempt_id: rootSource?.practiceAttemptId ?? null,
      source_ideal_text_revision_id: rootSource?.idealTextRevisionId ?? null,
      source_text_update_binding_id: rootSource?.textUpdateBindingId ?? null,
      source_target_speaker_binding_id: rootSource?.sourceTargetSpeakerBindingId ?? null,
      practice_target_speaker_binding_id: rootSource?.practiceTargetSpeakerBindingId ?? null,
      restore_product_action_id: null,
      policy_version: "rooting-coverage-30-80-100-v1",
    };
    const result = await recordBundleRootAction({
      bundleId: bundle.bundleId,
      bundleAttachmentId: attachmentId,
      body: { ...rootBody, idempotency_key: stableIdempotencyKey(
        `${bundle.bundleId}:${attachmentId}:${JSON.stringify(rootBody)}`,
        "bundle-root",
      ) },
    });
    setBusy(null);
    if (result.kind === "ok") onChanged();
  }, [bundle.bundleId, bundle.root.activeRootActionId, busy, items, onChanged, rootSource]);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Confident moment coaching">
      <section className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-background p-6 shadow-2xl">
        <OverlayCloseButton onClick={onClose} />
        {/* The walk's header at the top, as on every sheet (founder
            2026-09-26): ‹ Slide 2 · moment 1 of 4 ›. */}
        {pager ? (
          <div className="-mx-3 -mt-3 mb-3 pr-10">
            <FeedbackPagerBar pager={pager} />
          </div>
        ) : null}
        <div className="space-y-6 pr-8">
          {visibleItems.map((item) => (
            <article key={item.bundleAttachmentId} className="space-y-3 rounded-2xl border border-border p-4">
              <ConfidentMomentVisibleRenderAck
                identity={item.bundleAttachmentId}
                onVisible={() => void acknowledge(item)}
              />
              <h2 className="text-lg font-semibold">{titleFor(item)}</h2>
              {item.feedbackFamily === "confident_voice" ? (
                <div className="space-y-3">
                  {!responses[item.bundleAttachmentId] ? (
                    sourcePlayback[item.bundleAttachmentId] === "loading" ? (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Loading your recording…</span>
                        <Button variant="ghost" onClick={() => cancelSourcePlayback(item.bundleAttachmentId)}>Cancel</Button>
                      </div>
                    ) : sourcePlayback[item.bundleAttachmentId] === "terminal" ? (
                      <p className="text-sm text-muted-foreground">Playback is unavailable for this recording.</p>
                    ) : sourceAudioUrls[item.bundleAttachmentId] ? (
                      <audio
                        src={sourceAudioUrls[item.bundleAttachmentId]}
                        controls
                        preload="metadata"
                        className="w-full"
                        onEnded={() => setSourcePlayback((state) => ({ ...state, [item.bundleAttachmentId]: "completed" }))}
                        onError={() => {
                          setSourceAudioUrls((state) => {
                            const next = { ...state };
                            if (next[item.bundleAttachmentId]) URL.revokeObjectURL(next[item.bundleAttachmentId]);
                            delete next[item.bundleAttachmentId];
                            return next;
                          });
                          setSourcePlayback((state) => ({ ...state, [item.bundleAttachmentId]: "failed" }));
                        }}
                      />
                    ) : (
                      <Button variant="outline" onClick={() => void loadSourcePlayback(item)}>
                        {sourcePlayback[item.bundleAttachmentId] === "failed" ? "Try playback again" : "Play this moment"}
                      </Button>
                    )
                  ) : null}
                  {/* THE SAME FIVE ANSWERS AS EVERYWHERE ELSE (founder
                      2026-09-25, Q36 A): the owner wording of the one
                      judgement instrument, not a second set of labels. */}
                  {!responses[item.bundleAttachmentId] ? (
                    <ConfidenceLabelChips
                      question={COPY.confidenceQuestion}
                      value={null}
                      disabled={sourcePlayback[item.bundleAttachmentId] !== "completed" || !receipts[item.bundleAttachmentId] || busy !== null}
                      saving={busy !== null}
                      ownerWording
                      onPick={(value) => void respond(item, value)}
                    />
                  ) : null}
                </div>
              ) : null}
              {item.feedbackFamily !== "confident_voice" || responses[item.bundleAttachmentId] ? (
                <>
                  <blockquote className="border-l-2 border-primary/50 pl-3 text-sm text-muted-foreground">
                    {item.sourcePassage.text}
                  </blockquote>
                  {/* Article 50(2) marks the MACHINE's text and only that.
                      `origin: "coach"` is a person's own writing, and marking
                      it as artificially generated would be a false claim — the
                      same provenance wall L3 keeps everywhere else, read here
                      from the field that already carries it. */}
                  {item.output ? (
                    <div className="flex flex-col gap-1">
                      <p
                        className="leading-relaxed"
                        {...(item.output.origin === "machine"
                          ? aiGeneratedAttrs("manager-feedback")
                          : {})}
                      >
                        {item.output.text}
                      </p>
                      {item.output.origin === "machine" ? (
                        <AiGeneratedNote kind="manager-feedback" />
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              {item.output?.outputKind === "rephrase" && item.updateTextAvailable ? (
                <div className="flex gap-2">
                  <Button disabled={!receipts[item.bundleAttachmentId] || !ownerEdit || busy !== null} onClick={() => void updateText(item)}>Update the text</Button>
                  <Button variant="ghost" onClick={onClose}>Cancel</Button>
                </div>
              ) : null}
            </article>
          ))}
          {confidenceItem && confidenceAnswered ? (
            <ConfidentMomentExercisePanel
              bundleId={bundle.bundleId}
              attachmentId={confidenceItem.bundleAttachmentId}
              sourceAudioUrl={sourceAudioUrls[confidenceItem.bundleAttachmentId] ?? null}
              sourcePlaybackState={sourcePlayback[confidenceItem.bundleAttachmentId] ?? "idle"}
              onLoadSourcePlayback={() => void loadSourcePlayback(confidenceItem)}
              onCancelSourcePlayback={() => cancelSourcePlayback(confidenceItem.bundleAttachmentId)}
              onPracticeSourceReady={setPracticeRootSource}
            />
          ) : null}
          {/* NO UNLOCK, NO RESTORE (founder 2026-09-25, Q6 A): new words
              replace the old ones; there is no inverse of the lock. */}
          {rootingCoverageEnabled() && items.length > 0 && (bundle.root.isOrange || rootSource) && !bundle.root.isLocked ? (
            <div className="flex flex-wrap gap-2" data-root-controls-for={bundle.bundleId}>
              <Button disabled={busy !== null || !rootSource} onClick={() => void rootAction("save_owner_selected_root")}>Save the text</Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          ) : null}
          {history && (confidenceAnswered || !confidenceItem) ? (
            <ParagraphHistoryBlock {...history} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
