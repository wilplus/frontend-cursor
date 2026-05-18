"use client";

import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  clearDirectivesQueue,
  getDirectivesQueue,
  saveDirectivesQueue,
  suggestDirectivesQueue,
} from "@/services/api/directivesQueue";
import {
  canSave,
  emptyRows,
  hasBackendArc,
  isDirty,
  patchRow,
  rowsForSave,
  rowsFromBackend,
  rowsFromSuggestions,
  type PanelRow,
} from "@/components/admin/directivesQueueHelpers";

/* -------------------------------------------------------------------------- */
/*  DirectivesQueuePanel — replaces the legacy OverrideCard                  */
/*                                                                            */
/*  Lives below the chat transcript on the admin user-detail page's          */
/*  "Chat Transcript & Override" tab. Owns the 5-step coaching arc:          */
/*  hydrate from backend on mount, accept admin edits, optionally seed       */
/*  five rows from the AI suggestion endpoint, save / clear via the          */
/*  directives-queue API. Backend pops one row per chat or interview turn    */
/*  in position order; rows the backend has already used arrive with        */
/*  `exhausted: true` and render dimmed + strikethrough.                    */
/* -------------------------------------------------------------------------- */

export function DirectivesQueuePanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<PanelRow[]>(emptyRows);
  const [baseline, setBaseline] = useState<PanelRow[]>(emptyRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Abort flag for the on-mount fetch — keeps us from stomping local
  // edits if the user starts typing before the GET resolves.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const dirty = useMemo(() => isDirty(rows, baseline), [rows, baseline]);
  const submittable = canSave(rows) && !saving && !suggesting && !clearing;
  const baselineHasArc = hasBackendArc(baseline);

  useEffect(() => {
    setLoading(true);
    getDirectivesQueue(userId)
      .then((payload) => {
        if (!mountedRef.current) return;
        const hydrated = rowsFromBackend(payload.rows);
        setRows(hydrated);
        setBaseline(hydrated);
      })
      .catch(() => {
        // Backend BE-3 not deployed yet → endpoint 4xx. Render the
        // empty form rather than blocking the admin. The toast below
        // is silent on initial hydrate to avoid scaring admins on a
        // fresh page load before the backend ships.
        if (!mountedRef.current) return;
        setRows(emptyRows());
        setBaseline(emptyRows());
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [userId]);

  const onRowText = useCallback((idx: number, question: string) => {
    setRows((prev) => patchRow(prev, idx, { question }));
  }, []);

  const onRowTag = useCallback((idx: number, intent_tag: string) => {
    setRows((prev) => patchRow(prev, idx, { intent_tag }));
  }, []);

  const onSuggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const { rows: suggested } = await suggestDirectivesQueue(userId);
      if (!mountedRef.current) return;
      setRows(rowsFromSuggestions(suggested ?? []));
      toast.success("AI suggestions filled — edit before queueing");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't fetch AI suggestions"
      );
    } finally {
      if (mountedRef.current) setSuggesting(false);
    }
  }, [userId]);

  const onSave = useCallback(async () => {
    const toSave = rowsForSave(rows);
    if (toSave.length === 0) return;
    setSaving(true);
    try {
      const payload = await saveDirectivesQueue(userId, toSave);
      if (!mountedRef.current) return;
      const refreshed = rowsFromBackend(payload.rows);
      setRows(refreshed);
      setBaseline(refreshed);
      toast.success(
        `Arc queued — next ${toSave.length} AI question${
          toSave.length === 1 ? "" : "s"
        } will use these`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the arc");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [rows, userId]);

  const onClear = useCallback(async () => {
    // Local-only clear when there's nothing on the backend yet —
    // saves a needless DELETE round-trip.
    if (!baselineHasArc) {
      setRows(emptyRows());
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Clear the queued 5-step arc? Subsequent AI turns will fall back to LLM-generated questions."
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await clearDirectivesQueue(userId);
      if (!mountedRef.current) return;
      const empty = emptyRows();
      setRows(empty);
      setBaseline(empty);
      toast.success("Arc cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't clear the arc");
    } finally {
      if (mountedRef.current) setClearing(false);
    }
  }, [baselineHasArc, userId]);

  return (
    <Card className="rounded-2xl border-border p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">5-Step Coaching Arc</h3>
          <p className="text-xs text-muted-foreground">
            Backend pops one row per AI turn in position order. Empty rows
            are dropped at save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onSuggest()}
            disabled={loading || suggesting || saving || clearing}
            className="gap-1.5 rounded-full"
          >
            {suggesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            Generate AI Suggestions
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void onClear()}
            disabled={loading || saving || suggesting || clearing}
            className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10"
          >
            {clearing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Clear
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading current arc…
        </p>
      ) : (
        <>
          {!baselineHasArc && !dirty && (
            <p className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              No arc queued — next AI turn will be LLM-generated. Fill row 1
              (at minimum) and click Queue to override.
            </p>
          )}

          <div className="space-y-2">
            {rows.map((row, idx) => (
              <DirectiveRowEditor
                key={`row-${idx}`}
                index={idx}
                row={row}
                onChangeText={(v) => onRowText(idx, v)}
                onChangeTag={(v) => onRowTag(idx, v)}
                disabled={saving || suggesting || clearing}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {dirty
                ? "Unsaved changes — click Queue to commit."
                : baselineHasArc
                ? "Arc in sync with backend."
                : ""}
            </p>
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={!submittable}
              className="gap-1.5 rounded-full"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Queue 5-Step Arc
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

interface DirectiveRowEditorProps {
  index: number;
  row: PanelRow;
  onChangeText: (value: string) => void;
  onChangeTag: (value: string) => void;
  disabled: boolean;
}

function DirectiveRowEditor({
  index,
  row,
  onChangeText,
  onChangeTag,
  disabled,
}: DirectiveRowEditorProps) {
  const position = index + 1;
  // Exhausted rows are server-history — admin can't edit them in
  // place. To change a row that's been popped, the admin must
  // Clear + queue a new arc. Visually dimmed + strikethrough so the
  // distinction is obvious.
  const locked = row.exhausted;
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 transition-colors",
        locked
          ? "border-border/60 bg-muted/30 opacity-60"
          : "border-border bg-background"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground"
          aria-label={`Position ${position}`}
        >
          {position}
        </span>
        <input
          type="text"
          value={row.intent_tag}
          onChange={(e) => onChangeTag(e.target.value)}
          placeholder="intent tag"
          aria-label={`Intent tag for question ${position}`}
          disabled={disabled || locked}
          maxLength={24}
          className="h-7 min-w-[5.5rem] flex-shrink rounded-full border border-border bg-background px-3 text-[11px] font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:cursor-not-allowed"
        />
        {locked && (
          <span
            className="ml-auto inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            title="This row has already been used by an AI turn. Clear the arc and queue a new one to change it."
          >
            Used
          </span>
        )}
      </div>
      <Textarea
        value={row.question}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={
          position === 1
            ? "Question 1 — opens the next AI turn…"
            : `Question ${position} — builds on step ${position - 1}`
        }
        disabled={disabled || locked}
        maxLength={500}
        className={cn(
          "mt-2 min-h-[56px] text-sm transition-colors",
          locked && "line-through decoration-muted-foreground/50",
          "bg-background"
        )}
        aria-label={`Question for position ${position}`}
      />
    </div>
  );
}
