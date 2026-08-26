"use client";

import {
  Check,
  ChevronRight,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  artifactDraft,
  linearMlEdges,
  newCeoRowId,
  type CeoArchitectureContent,
  type CeoArtifactContent,
  type CeoMlContent,
  type CeoTextRow,
  type CeoVisionContent,
} from "@/lib/ceo/overview";
import type {
  CeoArtifact,
  CeoArtifactComment,
  CeoBootstrap,
  CeoLens,
  CeoTimelineEvent,
} from "@/lib/ceo/domain";

type MutationStatus = "idle" | "saving" | "saved";

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mutationError(body: Record<string, unknown>, fallback: string): string {
  return typeof body.error === "string" ? body.error : fallback;
}

export default function CeoArtifactEditor({
  artifact,
  lens,
  timeline,
  comments,
  analysisBlocked,
  onBootstrap,
}: {
  artifact: CeoArtifact | null;
  lens: CeoLens;
  timeline: CeoTimelineEvent[];
  comments: CeoArtifactComment[];
  analysisBlocked: boolean;
  onBootstrap: (bootstrap: CeoBootstrap) => void;
}) {
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const reevaluationBlocked = analysisBlocked || comments.some(
    (item) =>
      item.reevaluation_status === "pending" ||
      item.reevaluation_status === "processing"
  );

  if (!artifact) {
    return (
      <div className="mt-5 rounded-2xl border border-border p-6 text-sm text-muted-foreground">
        This CEO artifact is unavailable. Reload the page; if it remains absent,
        apply the latest CEO database migration.
      </div>
    );
  }

  const content = artifactDraft(lens, artifact.revision?.content);

  async function save(next: CeoArtifactContent) {
    if (!artifact || status === "saving") return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(
        `/api/v2/admin/ceo/artifacts/${encodeURIComponent(artifact.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expected_version: artifact.revision?.version ?? 0,
            content: next,
          }),
        }
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(mutationError(body, "The artifact could not be saved."));
      }
      const bootstrap = body.bootstrap as CeoBootstrap | undefined;
      if (!bootstrap) throw new Error("The saved CEO state was not returned.");
      onBootstrap(bootstrap);
      setStatus("saved");
    } catch (caught) {
      setStatus("idle");
      setError(caught instanceof Error ? caught.message : "The artifact could not be saved.");
    }
  }

  async function requestReevaluation() {
    const clean = comment.trim();
    if (!artifact || !clean || commenting) return;
    setCommenting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v2/admin/ceo/artifacts/${encodeURIComponent(artifact.id)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: clean }),
        }
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(mutationError(body, "The comment could not be queued."));
      }
      const bootstrap = body.bootstrap as CeoBootstrap | undefined;
      if (!bootstrap) throw new Error("The updated CEO state was not returned.");
      setComment("");
      onBootstrap(bootstrap);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The comment could not be queued.");
    } finally {
      setCommenting(false);
    }
  }

  return (
    <div className="pt-5">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border px-2 py-1">
          {artifact.revision?.ownership === "manual" ? "Manual" : "Generated"}
        </span>
        <span>
          {artifact.revision ? `Version ${artifact.revision.version}` : "No revision"}
        </span>
        <span>Official</span>
        {status === "saved" ? (
          <span className="ml-auto inline-flex items-center gap-1 text-foreground">
            <Check className="h-3.5 w-3.5" aria-hidden /> Saved
          </span>
        ) : null}
      </div>

      {lens === "architecture" ? (
        <ArchitectureEditor
          initial={content as CeoArchitectureContent}
          saving={status === "saving"}
          onSave={save}
        />
      ) : null}
      {lens === "ml" ? (
        <MlEditor
          initial={content as CeoMlContent}
          saving={status === "saving"}
          onSave={save}
        />
      ) : null}
      {lens === "vision" ? (
        <VisionEditor
          initial={content as CeoVisionContent}
          saving={status === "saving"}
          onSave={save}
        />
      ) : null}

      <History events={timeline} />

      <section className="mt-5 rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Comment & re-evaluate</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Add guidance for the next model evaluation. This queues analysis; it
          does not modify the application or deploy code.
        </p>
        {reevaluationBlocked ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Review the open proposal before requesting another evaluation.
          </p>
        ) : null}
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={10_000}
          placeholder="What should be reconsidered?"
          className="mt-4 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void requestReevaluation()}
            disabled={!comment.trim() || commenting || reevaluationBlocked}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            {commenting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Queue re-evaluation
          </button>
        </div>
        {comments.length ? (
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            {comments.map((item) => (
              <div key={item.id} className="flex gap-3 text-sm">
                <span className="min-w-20 text-xs capitalize text-muted-foreground">
                  {item.reevaluation_status}
                </span>
                <div>
                  <p>{item.text}</p>
                  <time className="mt-1 block text-xs text-muted-foreground">
                    {formatDate(item.created_at)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ArchitectureEditor({
  initial,
  saving,
  onSave,
}: {
  initial: CeoArchitectureContent;
  saving: boolean;
  onSave: (content: CeoArchitectureContent) => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 bg-muted px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>Input</span><span>Measurement</span><span>Output</span><span />
        </div>
        {draft.flows.length ? (
          <div className="divide-y divide-border">
            {draft.flows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 p-3">
                {(["input", "measurement", "output"] as const).map((field) => (
                  <input
                    key={field}
                    value={row[field]}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      flows: current.flows.map((item) =>
                        item.id === row.id ? { ...item, [field]: event.target.value } : item
                      ),
                    }))}
                    placeholder={field === "input" ? "Voice sample" : field === "measurement" ? "F0 variance" : "Intervention"}
                    className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                  />
                ))}
                <IconButton label="Remove flow" onClick={() => setDraft((current) => ({
                  ...current,
                  flows: current.flows.filter((item) => item.id !== row.id),
                }))} />
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Add the first input → measurement → output flow.
          </p>
        )}
        <button
          type="button"
          onClick={() => setDraft((current) => ({
            ...current,
            flows: [...current.flows, { id: newCeoRowId(), input: "", measurement: "", output: "" }],
          }))}
          className="flex w-full items-center justify-center gap-2 border-t border-border px-4 py-3 text-sm font-medium hover:bg-muted/50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add flow
        </button>
      </section>
      <TextList
        title="Blind spots, tech debt & risks"
        rows={draft.risks}
        onChange={(risks) => setDraft((current) => ({ ...current, risks }))}
      />
      <TextList
        title="Next steps"
        rows={draft.next_steps}
        onChange={(next_steps) => setDraft((current) => ({ ...current, next_steps }))}
      />
      <SaveButton saving={saving} onClick={() => onSave(draft)} />
    </div>
  );
}

function MlEditor({
  initial,
  saving,
  onSave,
}: {
  initial: CeoMlContent;
  saving: boolean;
  onSave: (content: CeoMlContent) => void;
}) {
  const [draft, setDraft] = useState(initial);

  function setNodes(nodes: CeoMlContent["nodes"]) {
    setDraft((current) => ({ ...current, nodes, edges: linearMlEdges(nodes) }));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border p-5">
        <div className="flex min-w-0 items-stretch gap-3 overflow-x-auto pb-2">
          {draft.nodes.map((node, index) => (
            <div key={node.id} className="contents">
              <div className="relative min-w-48 flex-1 rounded-xl border border-border bg-muted/30 p-3">
                <input
                  value={node.label}
                  onChange={(event) => setNodes(draft.nodes.map((item) =>
                    item.id === node.id ? { ...item, label: event.target.value } : item
                  ))}
                  aria-label={`Stage ${index + 1} name`}
                  placeholder="Stage name"
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
                <textarea
                  value={node.detail}
                  onChange={(event) => setNodes(draft.nodes.map((item) =>
                    item.id === node.id ? { ...item, detail: event.target.value } : item
                  ))}
                  aria-label={`Stage ${index + 1} detail`}
                  placeholder="Data, training, transformation…"
                  rows={3}
                  className="mt-2 w-full resize-none bg-transparent text-xs text-muted-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNodes(draft.nodes.filter((item) => item.id !== node.id))}
                  aria-label={`Remove ${node.label || `stage ${index + 1}`}`}
                  className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {index < draft.nodes.length - 1 ? (
                <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNodes([...draft.nodes, {
            id: newCeoRowId(), label: "New stage", detail: "",
          }])}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add stage
        </button>
      </section>
      <TextList
        title="Blind spots, tech debt & risks"
        rows={draft.risks}
        onChange={(risks) => setDraft((current) => ({ ...current, risks }))}
      />
      <TextList
        title="Next steps towards autonomy"
        rows={draft.next_steps}
        onChange={(next_steps) => setDraft((current) => ({ ...current, next_steps }))}
      />
      <SaveButton saving={saving} onClick={() => onSave(draft)} />
    </div>
  );
}

function VisionEditor({
  initial,
  saving,
  onSave,
}: {
  initial: CeoVisionContent;
  saving: boolean;
  onSave: (content: CeoVisionContent) => void;
}) {
  const [document, setDocument] = useState(initial.document);
  return (
    <div>
      <textarea
        value={document}
        onChange={(event) => setDocument(event.target.value)}
        maxLength={200_000}
        rows={20}
        placeholder="Describe the intended experience, scientific value, and guardrails for Architecture and ML…"
        className="min-h-[28rem] w-full resize-y rounded-2xl border border-border bg-background px-6 py-6 text-sm leading-7 outline-none transition focus:border-foreground sm:px-8"
      />
      <SaveButton saving={saving} onClick={() => onSave({ document })} />
    </div>
  );
}

function TextList({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: CeoTextRow[];
  onChange: (rows: CeoTextRow[]) => void;
}) {
  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...rows, { id: newCeoRowId(), text: "" }])}
          aria-label={`Add to ${title}`}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {rows.length ? (
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex gap-2">
              <input
                value={row.text}
                onChange={(event) => onChange(rows.map((item) =>
                  item.id === row.id ? { ...item, text: event.target.value } : item
                ))}
                aria-label={title}
                placeholder="Add a concise observation"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              <IconButton label={`Remove from ${title}`} onClick={() => onChange(
                rows.filter((item) => item.id !== row.id)
              )} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
      )}
    </section>
  );
}

function History({ events }: { events: CeoTimelineEvent[] }) {
  return (
    <section className="mt-5 rounded-2xl border border-border p-5">
      <h3 className="text-sm font-semibold">History</h3>
      {events.length ? (
        <div className="mt-4 space-y-3">
          {events.slice(0, 20).map((event) => (
            <div key={event.id} className="flex items-baseline justify-between gap-4 text-sm">
              <span>{event.summary || event.event_type.replaceAll("_", " ")}</span>
              <time className="shrink-0 text-xs text-muted-foreground">
                {formatDate(event.created_at)}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No changes recorded yet.</p>
      )}
    </section>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {saving ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Save className="h-4 w-4" aria-hidden />
        )}
        Save new version
      </button>
    </div>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
