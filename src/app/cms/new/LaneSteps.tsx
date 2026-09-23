"use client";

import type { ReactNode } from "react";
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

/** One tick and its sentence. `locked` draws it on and unpressable — the
 *  exercise itself is not a choice, and a disabled checkbox that still looks
 *  clickable is the kind of control people fight with. */
function Tick({ on, locked, title, note, onToggle }: {
  on: boolean; locked?: boolean; title: string; note: string;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-disabled={locked || undefined}
      disabled={locked}
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-[10px] border p-3.5 text-left ${
        on ? "border-foreground/40 bg-foreground/[0.04]" : "border-border bg-background"
      } ${locked ? "cursor-default opacity-70" : ""}`}
    >
      <span
        aria-hidden
        className={`mt-[2px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[5px] border-2 text-[12px] font-bold ${
          on
            ? "border-foreground bg-foreground text-background"
            : "border-muted-foreground"
        }`}
      >
        {on ? "✓" : ""}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {note}
        </span>
      </span>
    </button>
  );
}

/** Where the recording goes — the screen that decides the shape of the lane.
 *
 *  It sits at position two, straight after the camera, because the write-up
 *  answer removes four later screens. Asking at the end would mean walking a
 *  cover picker for a post the author had already declined. */
export function WhereStep({ draft, patch }: { draft: LaneDraft; patch: Patch }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Tick
        on
        locked
        title="An exercise"
        note="Always. It is the thing you just recorded."
      />
      <Tick
        on={draft.publishPost}
        title="Also a journal post"
        note={
          draft.publishPost
            ? "You will write it up, give it a cover and an address."
            : "Skipped — the exercise goes out on its video and instruction alone."
        }
        onToggle={() => patch({ publishPost: !draft.publishPost })}
      />
      <Tick
        on={draft.avatarEligible}
        title="Usable for a future avatar"
        note="Same shirt, same angle, same light as the others in its setup."
        onToggle={() => patch({ avatarEligible: !draft.avatarEligible })}
      />
      {draft.avatarEligible ? (
        <div className="pt-1">
          <LaneField label="Which setup?">
            <input
              value={draft.avatarSetupLabel}
              onChange={(event) => patch({ avatarSetupLabel: event.target.value })}
              placeholder="desk-white-shirt-sept"
              maxLength={120}
              className={LANE_INPUT}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </LaneField>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            The same label on every clip shot this way. A tick on its own says
            this one was careful; the label is what says two of them match.
          </p>
        </div>
      ) : null}
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

export function CoverStep({ draft, patch, onUpload, busy, draw }: {
  draft: LaneDraft; patch: Patch; onUpload: (file: File) => void; busy: boolean;
  /** The drawing box. A slot rather than a prop bundle, so this file keeps
   *  knowing nothing about the password or about saving. */
  draw?: ReactNode;
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
      {/* Image only: the generator makes an image, and attaching one to a
          video post would break the cover its media_url belongs to. */}
      {draft.coverKind === "image" ? draw : null}
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
