"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VIEWS } from "@/lib/life/copy";
import { dayLabel, LIFE_GOALS_COPY as LG } from "@/lib/willab/lifeGoals";
import { archiveStrength, getStrengths, type Strength, type Strengths } from "@/services/api/lifeStrengths";
import { Eyebrow, PanelLede, Resource, usePanelResource } from "@/components/life/primitives";
import { STRENGTH_COPY } from "@/components/willab/LoungeStrengths";

/* -------------------------------------------------------------------------- */
/*  Strengths (Linear WIL-112; backend N241 N1, N3, N5, signed N258; rules     */
/*  docs/flows/principles.md §1 N): its own pill, right after Principles.      */
/*  Each strength with every note that shows it, newest first, and its days;   */
/*  no count, no rank (Never 1). Only the person archives one: it moves under  */
/*  Archived with its date and keeps its notes.                                */
/* -------------------------------------------------------------------------- */

const PAGE = {
  fromNotes: STRENGTH_COPY.fromNotes,
  archive: "Archive",
  confirm: "Archive this strength? It stays in your history.",
  archived: "Archived",
  archivedOn: (date: string) => `Archived on ${date}`,
} as const;

function Detail({ strength, onBack, onArchive }: { strength: Strength; onBack: () => void; onArchive: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="self-start text-[15px] text-muted-foreground">
        ‹ {VIEWS.strengths.title}
      </button>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {STRENGTH_COPY.mark} {strength.title}
      </h2>
      <Eyebrow>{PAGE.fromNotes}</Eyebrow>
      <ul className="flex flex-col gap-2">
        {strength.notes.map((note) => (
          <li key={`${note.on}${note.body}`} className="rounded-2xl bg-muted px-3.5 py-2.5 text-[15px] leading-[1.45]">
            “{note.body}”
            <span className="mt-1 block text-xs text-muted-foreground">{note.label ? `${note.label} · ${note.on_label}` : note.on_label}</span>
          </li>
        ))}
      </ul>
      {strength.archived_on ? (
        <p className="text-sm text-muted-foreground">{PAGE.archivedOn(dayLabel(strength.archived_on))}</p>
      ) : asking ? (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-foreground">{PAGE.confirm}</p>
          <button type="button" onClick={onArchive} className="h-12 rounded-full bg-foreground text-[15px] font-semibold text-background">
            {PAGE.archive}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="h-10 text-[15px] text-muted-foreground">
            {LG.back}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="h-12 rounded-full border-[1.5px] border-foreground text-[15px] font-semibold text-foreground">
          {PAGE.archive}
        </button>
      )}
    </div>
  );
}

function List({ items, onOpen }: { items: Strength[]; onOpen: (id: string) => void }) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {items.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onOpen(s.id)} className="relative block w-full px-4 py-3.5 pr-10 text-left hover:bg-muted/50">
            <span className="block text-[15px] font-medium text-foreground">
              {STRENGTH_COPY.mark} {s.title}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {s.archived_on ? PAGE.archivedOn(dayLabel(s.archived_on)) : s.notes[0] ? `“${s.notes[0].body}”` : ""}
            </span>
            <span aria-hidden className="absolute right-4 top-1/2 -translate-y-1/2 text-[20px] text-muted-foreground">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Shown({ data, onArchived }: { data: Strengths; onArchived: () => void }) {
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(params?.get("open") ?? null);
  const shown = open ? [...data.kept, ...data.archived].find((s) => s.id === open) : null;
  if (shown) {
    return (
      <Detail
        strength={shown}
        onBack={() => setOpen(null)}
        onArchive={() => {
          void archiveStrength(shown.id).then(() => {
            setOpen(null);
            onArchived();
          });
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {data.kept.length ? <List items={data.kept} onOpen={setOpen} /> : null}
      {data.archived.length ? (
        <>
          <Eyebrow>{PAGE.archived}</Eyebrow>
          <List items={data.archived} onOpen={setOpen} />
        </>
      ) : null}
    </div>
  );
}

export default function StrengthsPage() {
  const load = useCallback(() => getStrengths(), []);
  const resource = usePanelResource("strengths", load);
  return (
    <>
      <PanelLede lede={VIEWS.strengths.lede} />
      <Resource resource={resource}>{(data) => <Shown data={data} onArchived={resource.reload} />}</Resource>
    </>
  );
}
