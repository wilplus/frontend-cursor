"use client";

import { Lock } from "lucide-react";
import type { AdminSpeakingError } from "@/services/api/journalAdmin";
import type { LaneDraft } from "./laneDraft";
import { slugify } from "./laneDraft";
import { LANE_INPUT, LaneField } from "./LaneShell";

/* -------------------------------------------------------------------------- */
/*  One screen per decision. Each takes the draft and a patcher; none of them  */
/*  knows about navigation, saving, or which lane it is in.                    */
/* -------------------------------------------------------------------------- */

export type Patch = (next: Partial<LaneDraft>) => void;

const CATEGORIES = ["voice", "science", "others"] as const;

export function TitleStep({ draft, patch, idKeep }: {
  draft: LaneDraft; patch: Patch; idKeep: "-" | "_";
}) {
  return (
    <input
      value={draft.title}
      onChange={(event) => {
        const title = event.target.value;
        // The slug and the exercise id follow the title until the author edits
        // one directly. Matching is exact string comparison on the server, so a
        // hand-typed capital routes nothing and reports nothing.
        const trackingSlug = draft.slug === slugify(draft.title);
        const trackingId = draft.exerciseId === slugify(draft.title, idKeep);
        patch({
          title,
          ...(trackingSlug || !draft.slug ? { slug: slugify(title) } : {}),
          ...(trackingId || !draft.exerciseId
            ? { exerciseId: slugify(title, idKeep) }
            : {}),
        });
      }}
      placeholder="Land the ending"
      className={LANE_INPUT}
      autoFocus
    />
  );
}

export function NameStep({ draft, patch }: { draft: LaneDraft; patch: Patch }) {
  return (
    <div className="flex flex-col gap-4">
      <TitleStep draft={draft} patch={patch} idKeep="-" />
      <p className="font-mono text-[13px] text-muted-foreground">
        {draft.exerciseId || "…"}
      </p>
    </div>
  );
}

export function TagStep({ draft, patch, errors }: {
  draft: LaneDraft; patch: Patch; errors: AdminSpeakingError[];
}) {
  const detected = errors.filter((e) => e.detected);
  const named = errors.filter((e) => !e.detected);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {detected.map((item) => {
          const on = draft.tags.includes(item.errorId);
          return (
            <button
              key={item.errorId}
              type="button"
              aria-pressed={on}
              onClick={() =>
                patch({
                  tags: on
                    ? draft.tags.filter((t) => t !== item.errorId)
                    : [...draft.tags, item.errorId],
                })
              }
              className={`rounded-full border px-4 py-3 text-[14px] ${
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        {detected.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            Nothing detectable in the library yet.
          </span>
        ) : null}
      </div>
      {named.length ? (
        <div className="mt-5">
          <p className="mb-2 text-[13px] text-muted-foreground">
            Named only — no detector yet
          </p>
          <div className="flex flex-wrap gap-2">
            {named.map((item) => (
              <span
                key={item.errorId}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-3 text-[14px] text-muted-foreground opacity-50"
              >
                <Lock className="h-3 w-3" aria-hidden />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WordsStep({ draft, patch }: { draft: LaneDraft; patch: Patch }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <LaneField label="What they see first">
        <textarea
          rows={3}
          value={draft.opening}
          onChange={(event) => patch({ opening: event.target.value })}
          className={`${LANE_INPUT} resize-none leading-relaxed`}
        />
      </LaneField>
      <LaneField label="What they do">
        <textarea
          rows={3}
          value={draft.instruction}
          onChange={(event) => patch({ instruction: event.target.value })}
          className={`${LANE_INPUT} resize-none leading-relaxed`}
        />
      </LaneField>
    </div>
  );
}

export function BodyStep({ draft, patch, hint }: {
  draft: LaneDraft; patch: Patch; hint?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <textarea
        value={draft.body}
        onChange={(event) => patch({ body: event.target.value })}
        placeholder="Separate paragraphs with a blank line."
        className={`${LANE_INPUT} min-h-[240px] flex-1 resize-none leading-relaxed`}
      />
      {hint ? (
        <p className="pt-2 text-[13px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ExcerptStep({ draft, patch }: { draft: LaneDraft; patch: Patch }) {
  return (
    <textarea
      rows={4}
      value={draft.excerpt}
      onChange={(event) => patch({ excerpt: event.target.value })}
      className={`${LANE_INPUT} resize-none leading-relaxed`}
    />
  );
}

export function CoverStep({ draft, patch, onUpload, busy }: {
  draft: LaneDraft; patch: Patch; onUpload: (file: File) => void; busy: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex gap-2">
        {(["image", "video", "audio"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => patch({ coverKind: kind })}
            className={`flex-1 rounded-[10px] border px-2 py-2.5 text-[14px] capitalize ${
              draft.coverKind === kind
                ? "border-foreground bg-foreground font-medium text-background"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            {kind}
          </button>
        ))}
      </div>
      {draft.coverUrl ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.coverUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30">
          <span className="text-[13px] text-muted-foreground">
            {busy ? "Uploading…" : "Choose a file"}
          </span>
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </label>
      )}
      <LaneField label="Or paste a URL">
        <input
          value={draft.coverUrl}
          onChange={(event) => patch({ coverUrl: event.target.value })}
          placeholder="https://…"
          className={LANE_INPUT}
        />
      </LaneField>
      <LaneField label="Alt text">
        <input
          value={draft.coverAlt}
          onChange={(event) => patch({ coverAlt: event.target.value })}
          className={LANE_INPUT}
        />
      </LaneField>
    </div>
  );
}

export function DetailsStep({ draft, patch }: { draft: LaneDraft; patch: Patch }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex gap-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => patch({ category })}
            className={`flex-1 rounded-[10px] border px-2 py-2.5 text-[14px] capitalize ${
              draft.category === category
                ? "border-foreground bg-foreground font-medium text-background"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      <LaneField label="Address">
        <input
          value={draft.slug}
          onChange={(event) => patch({ slug: event.target.value })}
          className={`${LANE_INPUT} font-mono text-[14px]`}
        />
      </LaneField>
      <LaneField label="Author">
        <input
          value={draft.author}
          onChange={(event) => patch({ author: event.target.value })}
          className={LANE_INPUT}
        />
      </LaneField>
      <div className="flex gap-3">
        <div className="flex-1">
          <LaneField label="Date">
            <input
              type="date"
              value={draft.publishedAt}
              onChange={(event) => patch({ publishedAt: event.target.value })}
              className={LANE_INPUT}
            />
          </LaneField>
        </div>
        <div className="w-28">
          <LaneField label="Read (min)">
            <input
              inputMode="numeric"
              value={draft.readMinutes}
              onChange={(event) => patch({ readMinutes: event.target.value })}
              className={LANE_INPUT}
            />
          </LaneField>
        </div>
      </div>
    </div>
  );
}

export function ReviewStep({ draft }: { draft: LaneDraft }) {
  const rows: [string, string][] =
    draft.lane === "exercise"
      ? [
          ["Video", draft.videoSeconds ? `${draft.videoSeconds}s` : "added"],
          ["Fixes", draft.tags.join(", ") || "—"],
          ["Post", draft.title || "—"],
          ["Address", `/blog/${draft.slug}`],
        ]
      : [
          ["Title", draft.title || "—"],
          ["Category", draft.category],
          ["Author", draft.author],
          ["Address", `/blog/${draft.slug}`],
        ];
  return (
    <div className="flex flex-col">
      {rows.map(([key, value]) => (
        <div
          key={key}
          className="flex items-center justify-between gap-4 border-b border-border/60 py-[15px] last:border-b-0"
        >
          <span className="shrink-0 text-[14px] text-muted-foreground">{key}</span>
          <span className="truncate text-right text-[14px]">{value}</span>
        </div>
      ))}
    </div>
  );
}
