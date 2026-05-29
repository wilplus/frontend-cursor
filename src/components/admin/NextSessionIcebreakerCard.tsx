"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getAuthToken } from "@/lib/api/auth-client";
import { wordDiffCount } from "@/lib/admin/wordDiff";

/* -------------------------------------------------------------------------- */
/*  Task 10 — "Next session opener" card (admin Tab 1, below KPI narrative)    */
/*                                                                            */
/*  Self-contained: owns its own GET / PUT / regenerate lifecycle so it       */
/*  doesn't thread state through the 4k-line user-detail page. Clones the      */
/*  coaching-rationale split-sink UX (immutable AI draft + editable current    */
/*  + edited badge) and adds a destructive Regenerate lever.                  */
/*                                                                            */
/*  Reconciled to the SHIPPED BE contract (claude/consent-endpoint c07ee07):  */
/*    - Generation is SYNCHRONOUS at finalize (no async "generating" window), */
/*      so there's nothing to poll. A session with no draft yet simply hasn't */
/*      finalized — the admin refreshes after finalizing.                     */
/*    - There is NO 409. `queue_status:'not_yet_generated'` covers BOTH       */
/*      pre-finalize AND LLM-failure; `generation_error` is the discriminator.*/
/*    - Pre-migration the GET returns SESSION_NOT_FOUND (404) → render empty. */
/*                                                                            */
/*  Contract:                                                                 */
/*    GET   → { ai_draft, current, queue_status, generation_error, … }        */
/*    PUT   { question } — "" clears (→ skipped); else 5–280 chars + '?'       */
/*    POST  /regenerate — replaces draft + current; 429 rate-limited; 502     */
/* -------------------------------------------------------------------------- */

type QueueStatus =
  | "not_yet_generated"
  | "pending_next_session"
  | "queued"
  | "delivered"
  | "skipped";

interface IcebreakerPayload {
  session_id: string;
  ai_draft: string | null;
  ai_draft_generated_at: string | null;
  current: string | null;
  edited_by_admin: boolean;
  edited_at: string | null;
  queue_status: QueueStatus;
  next_session_id: string | null;
  generation_error: string | null;
}

const MIN_LEN = 5;
const MAX_LEN = 280;

interface Props {
  sessionId: string;
}

export default function NextSessionIcebreakerCard({ sessionId }: Props) {
  const [data, setData] = useState<IcebreakerPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  /** 404 SESSION_NOT_FOUND — the pre-migration window (columns missing) or a
   *  non-owned session. Render nothing so the card stays invisible until the
   *  BE columns exist, per the BE handoff ("FE card just renders empty"). */
  const [hidden, setHidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  /** Bumped by the manual "Refresh" button to re-run the load effect. */
  const [reloadNonce, setReloadNonce] = useState(0);

  const endpoint = `/api/v2/admin/sessions/${encodeURIComponent(
    sessionId
  )}/next-session-icebreaker`;

  /** Single GET. `syncDraft` re-seeds the textarea from server `current`
   *  (load / refresh / after writes). */
  const fetchData = useCallback(
    async (syncDraft: boolean): Promise<IcebreakerPayload | null> => {
      setHidden(false);
      setLoadError(null);
      const token = await getAuthToken();
      if (!token) {
        setLoadError("Not authenticated.");
        return null;
      }
      let res: Response;
      try {
        res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
      } catch {
        setLoadError("Couldn't reach the opener service.");
        return null;
      }
      // SESSION_NOT_FOUND (incl. pre-migration "columns missing") and any
      // owner-scoped 404 → hide the card rather than show an error.
      if (res.status === 404) {
        setHidden(true);
        setData(null);
        return null;
      }
      if (!res.ok) {
        setLoadError(`Couldn't load the opener (HTTP ${res.status}).`);
        return null;
      }
      const d = (await res.json().catch(() => null)) as IcebreakerPayload | null;
      if (!d) {
        setLoadError("Unexpected response from the opener service.");
        return null;
      }
      setData(d);
      if (syncDraft) setDraft(d.current ?? "");
      return d;
    },
    [endpoint]
  );

  // Single fetch on mount / session change / manual refresh. Generation is
  // synchronous at finalize on the BE, so there's no transient "generating"
  // state to poll — the admin refreshes after a session finalizes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchData(true);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadNonce, fetchData]);

  const refresh = useCallback(() => setReloadNonce((n) => n + 1), []);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    const valid =
      trimmed === "" ||
      (trimmed.length >= MIN_LEN &&
        trimmed.length <= MAX_LEN &&
        trimmed.endsWith("?"));
    if (!valid || saving) return; // button is disabled; this is a backstop
    setSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated.");
        return;
      }
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
      });
      if (res.status === 422) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "That opener isn't valid.");
        return;
      }
      if (!res.ok) {
        toast.error(`Save failed (HTTP ${res.status}).`);
        return;
      }
      const d = (await res.json()) as IcebreakerPayload;
      setData(d);
      setDraft(d.current ?? "");
      toast.success(
        trimmed === ""
          ? "Opener cleared — next session uses its default."
          : "Opener saved."
      );
    } catch (err) {
      console.warn("icebreaker save failed:", err);
      toast.error("Couldn't save the opener.");
    } finally {
      setSaving(false);
    }
  }, [draft, saving, endpoint]);

  const handleRegenerate = useCallback(async () => {
    if (regenerating) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Regenerate the AI opener?\n\nThis replaces both the AI draft and any edits you've made — there's no undo."
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated.");
        return;
      }
      const res = await fetch(`${endpoint}/regenerate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (res.status === 429) {
        const err = (await res.json().catch(() => ({}))) as {
          retry_after_seconds?: number;
        };
        toast.error(
          err.retry_after_seconds
            ? `Slow down — try again in ${err.retry_after_seconds}s.`
            : "Regenerating too fast — try again shortly."
        );
        return;
      }
      if (res.status === 502) {
        toast.error("The AI is unavailable right now — try again in a moment.");
        return;
      }
      if (!res.ok) {
        toast.error(`Regenerate failed (HTTP ${res.status}).`);
        return;
      }
      const d = (await res.json()) as IcebreakerPayload;
      setData(d);
      setDraft(d.current ?? "");
      toast.success("Generated a fresh opener.");
    } catch (err) {
      console.warn("icebreaker regenerate failed:", err);
      toast.error("Couldn't regenerate the opener.");
    } finally {
      setRegenerating(false);
    }
  }, [regenerating, endpoint]);

  /* ----------------------------- render ---------------------------------- */

  const Header = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        Next session opener
      </h3>
      {data?.edited_by_admin && (
        <Badge
          variant="outline"
          className="border-primary/30 bg-primary/5 text-primary"
          title={
            data.edited_at
              ? `Edited ${formatTs(data.edited_at)}`
              : "Edited by admin"
          }
        >
          Edited
        </Badge>
      )}
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <Card className="rounded-2xl border-border p-5">
      {Header}
      {children}
    </Card>
  );

  if (loading) {
    return shell(
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pre-migration / 404 — stay invisible.
  if (hidden) return null;

  if (loadError) {
    return shell(
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {loadError}
      </p>
    );
  }

  if (!data) return null;

  const status = data.queue_status;

  // LLM failed — both columns stayed null, error tag set. Offer a retry.
  if (status === "not_yet_generated" && data.generation_error) {
    return shell(
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Couldn&apos;t generate an opener ({reasonText(data.generation_error)}
            ). Regenerate to try again.
          </span>
        </div>
        <RegenerateButton
          onClick={() => void handleRegenerate()}
          busy={regenerating}
          label="Generate opener"
        />
      </div>
    );
  }

  // No draft yet, no error → the session simply hasn't finalized. Generation
  // runs at finalize, so this is a calm "check back" state, not a spinner.
  if (status === "not_yet_generated") {
    return shell(
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-5 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          The opener is generated automatically once this session is finalized.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          className="gap-1.5 rounded-full"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </Button>
      </div>
    );
  }

  // Locked — n+1 already scheduled; admin can no longer change it.
  if (status === "queued") {
    return shell(
      <div className="space-y-2">
        <Blockquote>{data.current}</Blockquote>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          Locked — the user&apos;s next session is already scheduled.
        </p>
      </div>
    );
  }

  // Delivered — read-only record of what was actually asked.
  if (status === "delivered") {
    return shell(
      <div className="space-y-2">
        <Blockquote>{data.current}</Blockquote>
        <p className="text-[11px] text-muted-foreground">
          Asked at the start of the user&apos;s next session.
        </p>
      </div>
    );
  }

  /* --------- editable: pending_next_session | skipped --------------------- */

  const aiDraft = (data.ai_draft ?? "").trim();
  const trimmed = draft.trim();
  const isEmpty = trimmed === "";
  const validNonEmpty =
    trimmed.length >= MIN_LEN &&
    trimmed.length <= MAX_LEN &&
    trimmed.endsWith("?");
  const valid = isEmpty || validNonEmpty;
  const changed = trimmed !== (data.current ?? "").trim();
  const saveDisabled = saving || !valid || !changed;
  const diffFromAi =
    aiDraft && trimmed && trimmed !== aiDraft ? wordDiffCount(aiDraft, trimmed) : 0;

  return shell(
    <div className="space-y-3">
      {/* Immutable AI baseline — shown whenever one exists. */}
      {aiDraft && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI draft
            {data.ai_draft_generated_at && (
              <span className="font-normal normal-case">
                · {formatTs(data.ai_draft_generated_at)}
              </span>
            )}
          </p>
          <p className="text-sm italic leading-relaxed text-muted-foreground">
            {aiDraft}
          </p>
        </div>
      )}

      {/* Editable current value. */}
      <div className="space-y-1.5">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write the first question of the next session…"
          className="bg-background text-[15px] leading-relaxed"
          aria-label="Next session opener"
        />
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-muted-foreground">
            {isEmpty ? (
              "Empty = skip. The next session uses its default first question."
            ) : !validNonEmpty ? (
              <span className="text-amber-600">
                Must be {MIN_LEN}–{MAX_LEN} characters and end with “?”.
              </span>
            ) : diffFromAi > 0 ? (
              <span className="text-muted-foreground">
                ≈{diffFromAi} word{diffFromAi === 1 ? "" : "s"} changed from the
                AI draft.
              </span>
            ) : (
              "Matches the AI draft."
            )}
          </span>
          <span
            className={`tabular-nums ${
              draft.length > MAX_LEN ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {draft.length} / {MAX_LEN}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={saveDisabled}
          onClick={() => void handleSave()}
          className="rounded-full px-4"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <RegenerateButton
          onClick={() => void handleRegenerate()}
          busy={regenerating}
          label="Regenerate"
          variant="outline"
        />
      </div>

      <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
        {status === "skipped"
          ? "No opener set — the next session uses its default. Write one above or regenerate."
          : "Becomes the first question of the user’s next session."}
      </p>
    </div>
  );
}

/* ------------------------------- helpers ---------------------------------- */

function RegenerateButton({
  onClick,
  busy,
  label,
  variant = "outline",
}: {
  onClick: () => void;
  busy: boolean;
  label: string;
  variant?: "outline" | "default";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={busy}
      onClick={onClick}
      className="gap-1.5 rounded-full"
      title="Re-runs the AI. Replaces the draft and your edits — destructive."
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </Button>
  );
}

function Blockquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="rounded-xl border-l-4 border-primary/50 bg-primary/5 px-5 py-4">
      <p className="text-[15px] italic leading-relaxed text-foreground">
        {children}
      </p>
    </blockquote>
  );
}

/** Map BE generation_error tag strings to admin-readable copy. Unknown tags
 *  fall through to a generic line, so new BE tags degrade gracefully. */
function reasonText(code: string): string {
  switch (code) {
    case "llm_timeout":
      return "the AI timed out";
    case "transcript_too_short":
      return "the session was too short";
    case "llm_unavailable":
      return "the AI was unavailable";
    default:
      return "an unexpected error";
  }
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
