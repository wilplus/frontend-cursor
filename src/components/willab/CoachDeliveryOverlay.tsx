"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import LoadingState from "./LoadingState";
import OverlayCloseButton from "./OverlayCloseButton";
import { CoachEyebrow, CoachErrorLine } from "./coachChrome";
import { useBackDismiss } from "./useBackDismiss";
import { publishArc } from "@/services/api/arcBatch";
import { saveCoachFeedback } from "@/services/api/saveCoachFeedback";
import {
  fetchCoachReviewState,
  type CoachPublishPayload,
  type CoachReviewState,
} from "@/services/api/coachReviewState";

/* -------------------------------------------------------------------------- */
/*  CoachDeliveryOverlay — everything between "I have judged this arc" and     */
/*  "the student has it" (founder 2026-09-18).                                 */
/*                                                                            */
/*  ONE ACTION PER SCREEN. The coach walks:                                    */
/*                                                                            */
/*    wrap up  →  ideal text (the panel, opened by the host)  →  message       */
/*             →  review and send  →  delivered                                */
/*                                                                            */
/*  and the wrap-up's quiet link skips straight to review-and-send for a coach */
/*  who does not want the ideal text. That skip is the point: the ideal text   */
/*  is an OPTIONAL step, not a gate. Checked on both sides before this was     */
/*  built — the FE's own blocker parser accepts only NO_TAKES                  */
/*  (coachReviewState.pickBlocker) and the BE's publish path                   */
/*  (routes/v2/coach.py v2_coach_publish_analysis → publish_complete_reviews)  */
/*  never reads the approval at all; IDEAL_TEXT_NOT_APPROVED is emitted as an  */
/*  ADVISORY by the review-state read and asserted as a non-blocker by         */
/*  test_eager_ideal_text.py. The old gate lived only in the wrap-up's UI,     */
/*  which HID the publish button until approval — so a coach could not tell    */
/*  whether the button was missing, broken, or somewhere else.                 */
/*                                                                            */
/*  ARC-LEVEL, not per take. The student receives ONE analysis for the whole   */
/*  arc, so there is one message, one review, one publish — regardless of how  */
/*  many takes were judged. The per-take review overlay keeps its own tail for */
/*  per-take work (re-cut, the take's feelings); delivery is not its job.      */
/*                                                                            */
/*  Coach-facing copy; founder-specified in docs/coach-review-flow/SPEC.md.    */
/* -------------------------------------------------------------------------- */

type Screen = "wrapup" | "message" | "send" | "delivered";

/** The take the arc-level message rides on. There is ONE message now, and the
 *  publish payload carries it per take, so it goes on the earliest spoken take
 *  rather than being duplicated onto every bubble the student receives. */
function primaryTake(state: CoachReviewState | null): string | null {
  if (!state || state.takes.length === 0) return null;
  const ordered = [...state.takes].sort(
    (a, b) => (a.takeIndex ?? 0) - (b.takeIndex ?? 0),
  );
  return ordered[0]?.sessionId ?? null;
}

function Shell({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-foreground">
            {title}
          </span>
          {sub ? <CoachEyebrow>{sub}</CoachEyebrow> : null}
        </span>
        <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
      </div>
      {children}
    </div>
  );
}

/** The one forward action every screen ends on: full width, black, never the
 *  orange primary (which now marks accents only). */
function Action({
  label,
  onClick,
  busy = false,
  className = "",
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`mt-auto flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-foreground text-[16px] font-semibold text-background disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-none flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-4 px-4 py-4">
        {children}
      </div>
    </div>
  );
}

/** A flat field: label, then the control. No card around a single input. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13.5px] font-semibold text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function CoachDeliveryOverlay({
  arcId,
  onClose,
  onOpenArcIdeal,
  onPublished,
}: {
  arcId: string;
  onClose: () => void;
  /** Opens the ideal-text panel, which the host stacks above this overlay. */
  onOpenArcIdeal: (arcId: string) => void;
  /** Fires once the arc is delivered, with every published session id, so the
   *  host can mark the WHOLE arc done rather than one take (markDone takes a
   *  single session; one delivery covers them all). */
  onPublished: (sessionIds: string[]) => void;
}) {
  useBackDismiss(onClose);
  const [screen, setScreen] = useState<Screen>("wrapup");
  const [state, setState] = useState<CoachReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = primaryTake(state);
  const approved = state?.ideal.approved === true;

  const refresh = useCallback(async () => {
    const next = await fetchCoachReviewState(arcId);
    if (next) setState(next);
    setLoading(false);
    return next;
  }, [arcId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Seed the message from whatever the primary take already carries, once.
  useEffect(() => {
    if (!state || message) return;
    const take = state.takes.find((t) => t.sessionId === sessionId);
    const existing = take?.publishPayload?.overallMessage;
    if (existing) setMessage(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Returning from the ideal-text panel: re-read, and if the coach approved it
  // while they were there, carry them on to the message rather than dropping
  // them back on a screen whose one action they have already taken.
  useEffect(() => {
    if (screen !== "wrapup") return;
    const id = setInterval(() => {
      void refresh().then((next) => {
        if (next?.ideal.approved) setScreen("message");
      });
    }, 2500);
    return () => clearInterval(id);
  }, [screen, refresh]);

  const payloads = useMemo<CoachPublishPayload[]>(
    () =>
      (state?.takes ?? [])
        .map((t) => t.publishPayload)
        .filter((p): p is CoachPublishPayload => p !== null),
    [state],
  );

  /** Persist the arc-level message onto the take that carries it, then re-read
   *  so the publish payloads come back from the server rather than being
   *  assembled here. */
  async function saveMessage(): Promise<boolean> {
    if (!sessionId) return true;
    const result = await saveCoachFeedback({
      sessionId,
      overallMessage: message.trim() || null,
      snippets: [],
    });
    if (!result.ok) {
      setError(result.message ?? "Couldn't save your message. Try again.");
      return false;
    }
    await refresh();
    return true;
  }

  async function handlePublish() {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (payloads.length === 0) {
      setBusy(false);
      setError("There is no saved take to publish yet.");
      return;
    }
    const result = await publishArc(arcId, payloads);
    setBusy(false);
    if (result.kind !== "ok") {
      setError(result.message);
      void refresh();
      return;
    }
    onPublished(payloads.map((p) => p.sessionId));
    setScreen("delivered");
  }

  // Delivered is a confirmation, not a destination: it hands the coach back to
  // the student, where the take now reads Done.
  useEffect(() => {
    if (screen !== "delivered") return;
    const id = setTimeout(onClose, 1500);
    return () => clearTimeout(id);
  }, [screen, onClose]);

  if (loading) {
    return (
      <Shell title="Wrap up" onClose={onClose}>
        <LoadingState placement="surface" />
      </Shell>
    );
  }

  if (screen === "delivered") {
    return (
      <div
        className="fixed inset-0 z-40 flex cursor-pointer flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close, analysis delivered"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
      >
        <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
        <p className="text-[20px] font-semibold text-foreground">Delivered</p>
      </div>
    );
  }

  if (screen === "wrapup") {
    return (
      <Shell title="Wrap up" sub="Coach only" onClose={onClose}>
        <div className="scrollbar-none flex flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-4">
            <div className="my-auto flex justify-center">
              <button
                type="button"
                onClick={() =>
                  approved ? setScreen("message") : onOpenArcIdeal(arcId)
                }
                className="h-11 min-w-[220px] shrink-0 rounded-full bg-foreground px-6 text-[15px] font-semibold text-background"
              >
                {approved ? "Ideal text · approved" : "Open the ideal text"}
              </button>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setScreen("send")}
            className="mx-auto block text-[12px] text-muted-foreground underline underline-offset-2"
          >
            Skip it and send what you have
          </button>
        </div>
      </Shell>
    );
  }

  if (screen === "message") {
    return (
      <Shell title="Message to the user" sub="Shown to user" onClose={onClose}>
        <Body>
          <Field label="Your message">
            <textarea
              id="coach-arc-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="min-h-[9.5rem] w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-primary"
            />
          </Field>
          {/* NO VIDEO HERE ANY MORE (founder 2026-09-24: "I only want to
              exercise videos, not the coach video at the end"). The take-level
              coach video is retired as a product surface: an exercise's own
              demonstration video is the one that reaches the speaker, from the
              practice screen and the CMS lane. This screen carries the written
              message only. */}
          {error ? <CoachErrorLine>{error}</CoachErrorLine> : null}
          <Action
            label="Review and send"
            busy={busy}
            onClick={() => {
              setBusy(true);
              void saveMessage().then((ok) => {
                setBusy(false);
                if (ok) setScreen("send");
              });
            }}
          />
        </Body>
      </Shell>
    );
  }

  const rows: [string, string, boolean][] = [
    [
      "Notes and labels",
      state && state.takesSaved !== null
        ? `${state.takesSaved} of ${state.takesTotal ?? state.takes.length} takes saved`
        : "Saved",
      (state?.takesSaved ?? 0) > 0,
    ],
    ["Ideal text", approved ? "Approved" : "Not approved", approved],
    ["Message from you", message.trim() ? "Written" : "None", !!message.trim()],
  ];

  return (
    <Shell
      title="Review and send"
      sub="Coach only"
      /* THE ✕ LEAVES (founder 2026-09-24: "make it go out"). It used to step
         back a screen, which made one glyph do two jobs — every other Shell
         in this flow closes the overlay, so the last screen was the only
         place ✕ meant something else. No back control replaces it because
         no other screen here has one either; the way back in is the
         Feedbacks review, which reopens this flow where it left off. */
      onClose={onClose}
    >
      <Body>
        <div className="flex flex-col gap-3">
          {rows.map(([label, value, on]) => (
            <div key={label} className="flex items-baseline gap-3">
              <span className="flex-1 text-[15px] text-foreground">{label}</span>
              <span
                className={`text-[13px] ${on ? "text-success" : "text-muted-foreground"}`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        {error ? <CoachErrorLine>{error}</CoachErrorLine> : null}
        <Action
          label="Publish the full analysis"
          busy={busy}
          onClick={() => void handlePublish()}
        />
      </Body>
    </Shell>
  );
}
