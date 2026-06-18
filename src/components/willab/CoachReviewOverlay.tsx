"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoachReview } from "./useCoachReview";
import CoachSnippetReviewCard from "./CoachSnippetReviewCard";
import CoachVideoSlot from "./CoachVideoSlot";
import { useBackDismiss } from "./useBackDismiss";
import SnippetScreenShell from "./SnippetScreenShell";
import { recutSession } from "@/services/api/recutSession";
import type { CoachSnippetState, SessionFeeling } from "@/services/api/coachReview";
import {
  publishWillabSession,
  type PublishLabel,
  type PublishNote,
} from "@/services/api/publishWillabSession";

const FEELING_EMOJI: Record<string, string> = {
  nervous: "😬",
  excited: "🔥",
  calm: "😌",
  unsure: "🤔",
};

function FeelingBadge({ feeling }: { feeling: SessionFeeling }) {
  const emoji = FEELING_EMOJI[feeling.feeling] ?? "";
  const label =
    feeling.feeling.charAt(0).toUpperCase() + feeling.feeling.slice(1);
  const takeLabel = feeling.takeIndex != null ? ` · Take ${feeling.takeIndex}` : "";
  return (
    <span>
      {emoji} {label}
      {takeLabel}
    </span>
  );
}

export default function CoachReviewOverlay({
  sessionId,
  onClose,
  onPublished,
}: {
  sessionId: string;
  onClose: () => void;
  onPublished?: (sessionId: string) => void;
}) {
  useBackDismiss(onClose);
  const { status, session, refresh } = useCoachReview(sessionId);

  const [localState, setLocalState] = useState<Record<string, CoachSnippetState>>({});
  const [videoRef, setVideoRef] = useState<string | null>(null);
  const [overallMessage, setOverallMessage] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [recutting, setRecutting] = useState(false);
  const [recutError, setRecutError] = useState<string | null>(null);
  const [recutConfirm, setRecutConfirm] = useState<{
    labels: number;
    drafts: number;
  } | null>(null);

  async function handleRecut(force: boolean) {
    if (!session || recutting) return;
    setRecutting(true);
    setRecutError(null);
    const result = await recutSession(session.sessionId, { force });
    if (result.status === "ok") {
      setRecutConfirm(null);
      setCursor(0);
      await refresh();
    } else if (result.status === "needs_confirm") {
      setRecutConfirm({ labels: result.labels, drafts: result.drafts });
    } else {
      setRecutError(result.message);
    }
    setRecutting(false);
  }

  useEffect(() => {
    if (!session) return;
    setVideoRef(session.videoRef);
    setOverallMessage(session.overallMessage);
    setNotifyClient(session.state !== "done");
  }, [session]);

  function onSnippetSaved(snippetId: string, next: CoachSnippetState) {
    setLocalState((prev) => ({ ...prev, [snippetId]: next }));
  }

  const floorMet = session
    ? session.snippets.some((s) => {
        const cs = localState[s.id] ?? s.coachState;
        return cs.surfaced && cs.note.trim() !== "" && cs.tag !== null;
      })
    : false;

  async function handlePublish() {
    if (!session || !floorMet || publishing) return;
    setPublishing(true);
    setPublishError(null);

    const notes: PublishNote[] = [];
    const labels: PublishLabel[] = [];
    for (const s of session.snippets) {
      const cs = localState[s.id] ?? s.coachState;
      if (cs.surfaced && cs.note.trim() && cs.tag) {
        notes.push({ snippet_id: s.id, note: cs.note, tag: cs.tag });
      }
      if (cs.directionLabel) {
        labels.push({ snippet_id: s.id, value: cs.directionLabel });
      }
    }

    const result = await publishWillabSession({
      sessionId: session.sessionId,
      overallMessage: overallMessage.trim() || null,
      notes,
      labels,
      notifyClient,
    });

    setPublishing(false);
    if (result.ok) {
      setPublished(true);
      onPublished?.(session.sessionId);
    } else {
      setPublishError(result.message);
    }
  }

  if (published) {
    return (
      <div
        className="fixed inset-0 z-40 flex cursor-pointer flex-col items-center justify-center gap-4 bg-background p-6 text-center"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close — insights published"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
      >
        <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
        <p className="text-[20px] font-semibold text-foreground">
          Insights published
        </p>
        <p className="text-[14px] text-muted-foreground">Tap anywhere to close</p>
      </div>
    );
  }

  // Pre-shell states (loading / error / no snippets yet).
  if (status === "loading" || !session) {
    return (
      <PreShellOverlay onClose={onClose}>
        {status === "loading" ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[15px] text-muted-foreground">
              Couldn&apos;t load this session.
            </p>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
              Back to Lounge
            </Button>
          </div>
        )}
      </PreShellOverlay>
    );
  }

  if (session.snippets.length === 0) {
    return (
      <PreShellOverlay onClose={onClose}>
        <p className="text-[15px] text-muted-foreground">
          No analyzable snippets in this session.
        </p>
      </PreShellOverlay>
    );
  }

  const total = session.snippets.length + 1; // last page = wrap-up
  const isAtWrapup = cursor === session.snippets.length;

  return (
    <SnippetScreenShell
      onClose={onClose}
      index={cursor}
      total={total}
      onPrev={() => setCursor((c) => Math.max(c - 1, 0))}
      onNext={
        isAtWrapup ? () => void handlePublish() : () => setCursor((c) => c + 1)
      }
      nextLabel={isAtWrapup ? (publishing ? "Publishing..." : "Publish to user") : undefined}
      nextTone={isAtWrapup ? "terminal" : "primary"}
      nextDisabled={isAtWrapup ? !floorMet || publishing : false}
      managed={false}
    >
      {/* Snippet pages — all stay mounted for draft preservation. */}
      {session.snippets.map((s, i) => (
        <div key={s.id} className={i === cursor ? "flex flex-col gap-4 px-4 py-4" : "hidden"}>
          <CoachSnippetReviewCard
            sessionId={session.sessionId}
            snippet={s}
            index={i}
            total={session.snippets.length}
            presentationRef={session.presentationRef}
            onStateChange={onSnippetSaved}
          />
        </div>
      ))}

      {/* Wrap-up page */}
      <div className={isAtWrapup ? "flex flex-col gap-4 px-4 py-4" : "hidden"}>
        <h2 className="text-[20px] font-semibold text-foreground">Wrap up</h2>

        {session.feelings.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">
              Pre-recording state
              <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                Coach only
              </span>
            </p>
            <ul className="flex flex-wrap gap-2">
              {session.feelings.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[13px] text-foreground"
                >
                  <FeelingBadge feeling={f} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">
            Overall message
            <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
              Shown to user · optional
            </span>
          </p>
          <textarea
            value={overallMessage}
            onChange={(e) => setOverallMessage(e.target.value)}
            rows={3}
            placeholder="A warm opener tying these snippets together…"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary"
          />
        </div>

        <CoachVideoSlot
          sessionId={session.sessionId}
          videoRef={videoRef}
          onUploaded={(nextRef) => setVideoRef(nextRef)}
        />

        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Re-cut snippets</p>
              <p className="text-[12px] text-muted-foreground">
                Re-run segmentation on the stored audio.
              </p>
            </div>
            {recutConfirm ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRecutConfirm(null)}
                  disabled={recutting}
                  className="rounded-full disabled:opacity-50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleRecut(true)}
                  disabled={recutting}
                  className="rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {recutting ? "Re-cutting…" : "Re-cut anyway"}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRecut(false)}
                disabled={recutting}
                className="shrink-0 rounded-full disabled:opacity-50"
              >
                {recutting ? "Re-cutting…" : "Re-cut"}
              </Button>
            )}
          </div>
          {recutConfirm ? (
            <p className="mt-2 text-[12px] text-red-600">
              This re-cuts the audio into new snippets and discards{" "}
              {recutConfirm.labels > 0 || recutConfirm.drafts > 0
                ? `${recutConfirm.labels} label${recutConfirm.labels === 1 ? "" : "s"} and ${recutConfirm.drafts} draft${recutConfirm.drafts === 1 ? "" : "s"}`
                : "the notes and labels you've added"}{" "}
              on this session.
            </p>
          ) : null}
          {recutError ? (
            <p className="mt-2 text-[12px] text-red-600">{recutError}</p>
          ) : null}
        </div>

        {/* Floor hint and notify toggle live just above the Publish button in
            the shell's navbar. Scroll here to see them before publishing. */}
        {!floorMet ? (
          <p className="text-center text-[12px] text-muted-foreground">
            Add at least one surfaced snippet with note + tag to publish.
          </p>
        ) : null}

        {publishError ? (
          <p className="text-center text-[13px] text-destructive">{publishError}</p>
        ) : null}

        <label className="flex cursor-pointer items-center justify-center gap-2 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={notifyClient}
            onChange={(e) => setNotifyClient(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-border text-primary accent-primary"
          />
          <span>Notify the client about this update</span>
        </label>
      </div>
    </SnippetScreenShell>
  );
}

/* ── minimal fixed overlay for pre-shell states ── */

function PreShellOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 justify-end px-3 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-[17px] w-[17px]" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        {children}
      </div>
    </div>
  );
}

function prettifyDomain(domain: string): string {
  switch (domain) {
    case "public_speaking":
      return "Public speaking";
    case "sales":
      return "Sales";
    case "executive_presence":
      return "Executive presence";
    case "customer_service":
      return "Customer service";
    case "interview_prep":
      return "Interview prep";
    default:
      return domain;
  }
}
