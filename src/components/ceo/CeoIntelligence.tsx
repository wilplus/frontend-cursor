"use client";

import {
  BookOpen,
  Check,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  CeoAnalysisRun,
  CeoArtifact,
  CeoBootstrap,
  CeoFeature,
  CeoLens,
  CeoSourceSnapshot,
} from "@/lib/ceo/domain";
import {
  artifactDraft,
  type CeoArchitectureContent,
  type CeoMlContent,
} from "@/lib/ceo/overview";

const PILOT_SLUG = "confident-voice-practice";

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function responseError(body: Record<string, unknown>, fallback: string): string {
  return typeof body.error === "string" ? body.error : fallback;
}

export default function CeoIntelligence({
  data,
  feature,
  artifact,
  lens,
  onBootstrap,
}: {
  data: CeoBootstrap;
  feature: CeoFeature | null;
  artifact: CeoArtifact | null;
  lens: CeoLens;
  onBootstrap: (bootstrap: CeoBootstrap) => void;
}) {
  const [requesting, setRequesting] = useState(false);
  const [reviewing, setReviewing] = useState<"approve" | "reject" | null>(null);
  const [addingSource, setAddingSource] = useState(false);
  const [sourceType, setSourceType] = useState<"research_paper" | "manual_note">(
    "research_paper"
  );
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latestRun = useMemo(
    () =>
      (data.analysis_runs ?? []).find((run) => run.artifact_id === artifact?.id) ??
      null,
    [artifact?.id, data.analysis_runs]
  );
  const staleRun = isStaleRun(latestRun);
  const processing =
    !staleRun &&
    (latestRun?.status === "queued" || latestRun?.status === "running");
  const proposal = latestRun?.status === "preview_ready" ? latestRun : null;
  const featureSources = useMemo(
    () =>
      (data.source_snapshots ?? []).filter(
        (source) => source.feature_id === feature?.id
      ),
    [data.source_snapshots, feature?.id]
  );

  useEffect(() => {
    if (!requesting && !processing) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/v2/admin/ceo/bootstrap", {
          cache: "no-store",
        });
        const body = await responseBody(response);
        if (!response.ok || cancelled) return;
        const bootstrap = body as unknown as CeoBootstrap;
        onBootstrap(bootstrap);
        const run = (bootstrap.analysis_runs ?? []).find(
          (item) => item.artifact_id === artifact?.id
        );
        if (run && run.status !== "queued" && run.status !== "running") {
          setRequesting(false);
        }
      } catch {
        // Polling is best effort. The durable run remains visible after reload.
      }
    };
    const first = window.setTimeout(() => void poll(), 900);
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [artifact?.id, onBootstrap, processing, requesting]);

  if (
    !feature ||
    feature.slug !== PILOT_SLUG ||
    !artifact ||
    (lens !== "architecture" && lens !== "ml")
  ) {
    return null;
  }

  async function refreshBootstrap() {
    const response = await fetch("/api/v2/admin/ceo/bootstrap", {
      cache: "no-store",
    });
    const body = await responseBody(response);
    if (!response.ok) {
      throw new Error(responseError(body, "CEO could not be refreshed."));
    }
    onBootstrap(body as unknown as CeoBootstrap);
  }

  async function requestAnalysis() {
    if (!artifact || requesting || processing || proposal) return;
    setRequesting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/v2/admin/ceo/artifacts/${encodeURIComponent(artifact.id)}/analysis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Sync current code, documentation, CEO history, and Vision.",
          }),
        }
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(responseError(body, "The source sync could not be queued."));
      }
      setNotice("Source sync queued. This page will update when the proposal is ready.");
      await refreshBootstrap();
    } catch (caught) {
      setRequesting(false);
      setError(
        caught instanceof Error ? caught.message : "The source sync could not be queued."
      );
    }
  }

  async function review(decision: "approve" | "reject") {
    if (!proposal || reviewing) return;
    setReviewing(decision);
    setError(null);
    try {
      const response = await fetch(
        `/api/v2/admin/ceo/analysis-runs/${encodeURIComponent(proposal.id)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(responseError(body, "The proposal could not be reviewed."));
      }
      const bootstrap = body.bootstrap as CeoBootstrap | undefined;
      if (!bootstrap) throw new Error("The reviewed CEO state was not returned.");
      onBootstrap(bootstrap);
      setNotice(decision === "approve" ? "Proposal approved." : "Proposal rejected.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The proposal could not be reviewed."
      );
    } finally {
      setReviewing(null);
    }
  }

  async function addSource() {
    if (
      !feature ||
      !sourceTitle.trim() ||
      !sourceRef.trim() ||
      !sourceContent.trim() ||
      savingSource
    ) {
      return;
    }
    setSavingSource(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v2/admin/ceo/features/${encodeURIComponent(feature.id)}/sources`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: sourceType,
            title: sourceTitle.trim(),
            source_ref: sourceRef.trim(),
            content: sourceContent.trim(),
          }),
        }
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(responseError(body, "The source could not be saved."));
      }
      setSourceTitle("");
      setSourceRef("");
      setSourceContent("");
      setAddingSource(false);
      setNotice("Source saved. Run source sync when it should inform a proposal.");
      await refreshBootstrap();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The source could not be saved.");
    } finally {
      setSavingSource(false);
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-border bg-muted/20 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h3 className="text-sm font-semibold">CEO Intelligence</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Read current code, documentation, CEO history, manual sources, and
            Vision. Generated work remains a proposal until you approve it.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAddingSource((current) => !current)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add source
          </button>
          <button
            type="button"
            onClick={() => void requestAnalysis()}
            disabled={requesting || processing || Boolean(proposal)}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            {requesting || processing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {processing
              ? "Analysing"
              : staleRun
                ? "Retry source sync"
                : "Sync current sources"}
          </button>
        </div>
      </div>

      {addingSource ? (
        <div className="mt-5 rounded-xl border border-border bg-background p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={sourceType}
              onChange={(event) =>
                setSourceType(event.target.value as "research_paper" | "manual_note")
              }
              aria-label="Source type"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            >
              <option value="research_paper">Research paper</option>
              <option value="manual_note">Manual note</option>
            </select>
            <input
              value={sourceTitle}
              onChange={(event) => setSourceTitle(event.target.value)}
              maxLength={300}
              placeholder="Source title"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
          <input
            value={sourceRef}
            onChange={(event) => setSourceRef(event.target.value)}
            maxLength={1000}
            placeholder="DOI, URL, document name, or physical-paper citation"
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <textarea
            value={sourceContent}
            onChange={(event) => setSourceContent(event.target.value)}
            maxLength={100_000}
            rows={7}
            placeholder="Paste the relevant text or your notes here."
            className="mt-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void addSource()}
              disabled={
                savingSource ||
                !sourceTitle.trim() ||
                !sourceRef.trim() ||
                !sourceContent.trim()
              }
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
            >
              {savingSource ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Save source
            </button>
          </div>
        </div>
      ) : null}

      {latestRun?.status === "failed" ? (
        <p className="mt-4 text-sm text-red-600">
          Analysis failed: {latestRun.error_message || "No proposal was created."}
        </p>
      ) : null}
      {notice ? <p className="mt-4 text-sm text-muted-foreground">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}

      {proposal ? (
        <ProposalReview
          run={proposal}
          lens={lens}
          sources={featureSources}
          reviewing={reviewing}
          onReview={review}
        />
      ) : null}

      {featureSources.length ? (
        <details className="mt-5 border-t border-border pt-4">
          <summary className="cursor-pointer text-sm font-medium">
            Evidence snapshots ({featureSources.length})
          </summary>
          <div className="mt-3 space-y-2">
            {featureSources.slice(0, 12).map((source) => (
              <SourceLine key={source.id} source={source} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function ProposalReview({
  run,
  lens,
  sources,
  reviewing,
  onReview,
}: {
  run: CeoAnalysisRun;
  lens: "architecture" | "ml";
  sources: CeoSourceSnapshot[];
  reviewing: "approve" | "reject" | null;
  onReview: (decision: "approve" | "reject") => void;
}) {
  const content = artifactDraft(
    lens,
    run.proposal_revision?.content
  ) as CeoArchitectureContent | CeoMlContent;
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const citations = content.citations;
  return (
    <div className="mt-5 rounded-xl border border-foreground/20 bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">
            Proposal — not official
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.model || "Model"} · {formatNumber(run.total_tokens)} tokens · based
            on {run.source_snapshot_ids.length} snapshots
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReview("reject")}
            disabled={Boolean(reviewing)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            {reviewing === "reject" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <X className="h-4 w-4" aria-hidden />
            )}
            Reject
          </button>
          <button
            type="button"
            onClick={() => onReview("approve")}
            disabled={Boolean(reviewing)}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            {reviewing === "approve" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            Approve as official
          </button>
        </div>
      </div>

      {lens === "architecture" ? (
        <ArchitecturePreview content={content as CeoArchitectureContent} />
      ) : (
        <MlPreview content={content as CeoMlContent} />
      )}

      {citations.length ? (
        <div className="mt-5 border-t border-border pt-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
            Evidence
          </h4>
          <div className="mt-3 space-y-2 text-sm">
            {citations.map((citation) => {
              const source = sourceById.get(citation.source_id);
              return (
                <div key={citation.id} className="rounded-lg bg-muted/50 p-3">
                  <p>{citation.claim}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {source?.title || citation.source_id}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ArchitecturePreview({ content }: { content: CeoArchitectureContent }) {
  const gridStyle = {
    gridTemplateColumns: `repeat(${content.columns.length}, minmax(10rem, 1fr))`,
  };
  const gridWidth = Math.max(560, content.columns.length * 176);
  return (
    <div className="mt-5 space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border">
        <div style={{ minWidth: gridWidth }}>
          <div
            className="grid gap-3 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            style={gridStyle}
          >
            {content.columns.map((column) => (
              <span key={column.id}>{column.label}</span>
            ))}
          </div>
          {content.rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-3 border-t border-border px-3 py-3 text-sm"
              style={gridStyle}
            >
              {content.columns.map((column) => (
                <span key={column.id}>
                  {row.cells.find((cell) => cell.column_id === column.id)?.value ?? ""}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <PreviewList title="Blind spots, tech debt & risks" rows={content.risks} />
      <PreviewList title="Next steps" rows={content.next_steps} />
    </div>
  );
}

function MlPreview({ content }: { content: CeoMlContent }) {
  const gridWidth = Math.max(520, content.columns.length * 192);
  return (
    <div className="mt-5 space-y-4">
      <div className="overflow-x-auto pb-2">
        <div className="space-y-3" style={{ minWidth: gridWidth }}>
          <div className="flex items-center gap-3 border-b border-border pb-2">
            {content.columns.map((column, columnIndex) => (
              <div key={column.id} className="contents">
                <span className="min-w-44 flex-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {column.label}
                </span>
                {columnIndex < content.columns.length - 1 ? (
                  <span className="h-4 w-4 shrink-0" aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
          {content.rows.map((row) => (
            <div key={row.id} className="flex items-stretch gap-3">
              {content.columns.map((column, columnIndex) => {
                const node = content.nodes.find((item) =>
                  item.row_id === row.id && item.column_id === column.id
                );
                return (
                  <div key={column.id} className="contents">
                    <div className="min-w-44 flex-1 rounded-xl border border-border p-3">
                      {node ? (
                        <>
                          <p className="text-sm font-semibold">{node.label}</p>
                          {node.detail ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {node.detail}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Empty stage</p>
                      )}
                    </div>
                    {columnIndex < content.columns.length - 1 ? (
                      <span className="self-center text-muted-foreground" aria-hidden>
                        →
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <PreviewList title="Blind spots, tech debt & risks" rows={content.risks} />
      <PreviewList title="Next steps towards autonomy" rows={content.next_steps} />
    </div>
  );
}

function PreviewList({ title, rows }: { title: string; rows: { id: string; text: string }[] }) {
  if (!rows.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {rows.map((row) => <li key={row.id}>{row.text}</li>)}
      </ul>
    </div>
  );
}

function SourceLine({ source }: { source: CeoSourceSnapshot }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="min-w-0">
        <p className="truncate">{source.title}</p>
        <p className="truncate text-xs text-muted-foreground">{source.source_ref}</p>
      </div>
      <span className="shrink-0 text-xs capitalize text-muted-foreground">
        {source.source_type.replaceAll("_", " ")}
      </span>
    </div>
  );
}

function formatNumber(value: number | null): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

function isStaleRun(run: CeoAnalysisRun | null): boolean {
  if (!run || (run.status !== "queued" && run.status !== "running")) return false;
  const started = new Date(run.started_at || run.created_at).getTime();
  return Number.isFinite(started) && Date.now() - started > 35 * 60 * 1000;
}
