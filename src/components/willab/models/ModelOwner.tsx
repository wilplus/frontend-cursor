"use client";

import type { OwnerPanel } from "@/services/api/models";
import { Mini } from "./ModelBits";
import { Checklist, Muted, Rows } from "./SetupParts";

/* -------------------------------------------------------------------------- */
/*  The owner's part of a model's page (backend N566 item 6, MOD-36, MOD-37;  */
/*  services/model_setup.owner_panel; the locked prototype's s:18): "Needs    */
/*  you now" on top where the teachers disagree, how far it is with an honest */
/*  range and the slowest jar, what is left to set up, how often the         */
/*  teachers agree, and the folds. Totals only, never a person (N526 item 3). */
/*  Every word is the backend's.                                             */
/* -------------------------------------------------------------------------- */

/** "Needs you now", with "Make those two clearer" opening the step it names. */
export function NeedsYou({ panel, onFix }: { panel: OwnerPanel; onFix: (step: string) => void }) {
  const needs = panel.needs_you;
  if (!needs) return null;
  return (
    <div data-model-needs className="flex flex-col gap-1 rounded-2xl border-[1.5px] border-[#F26B21] bg-[#FFF1E7] px-3.5 py-3 text-[14.5px]">
      <b className="text-[#C2410C]">{needs.title}</b>
      <span>{needs.line}</span>
      <div className="pt-1">
        <Mini label={needs.actions[0]} onClick={() => onFix(needs.step)} />
      </div>
    </div>
  );
}

function Fold({ fold }: { fold: OwnerPanel["folds"][number] }) {
  return (
    <details data-model-fold className="rounded-2xl bg-muted px-3.5 py-2.5 text-[14.5px]">
      <summary className="flex cursor-pointer list-none justify-between font-bold">
        {fold.title}
        <span aria-hidden className="rotate-90 text-muted-foreground">›</span>
      </summary>
      {fold.rows ? (
        <div className="mt-1.5">
          <Rows rows={fold.rows} />
        </div>
      ) : null}
      {(fold.lines ?? []).map((line) => (
        <span key={line} className="mt-1.5 block">{line}</span>
      ))}
      {fold.then ? (
        <>
          <b className="mt-1.5 block pt-2">{fold.then.title}</b>
          {fold.then.lines.map((line) => (
            <span key={line} className="mt-1.5 block">{line}</span>
          ))}
        </>
      ) : null}
    </details>
  );
}

/** Under the ring: what is left, the rows, the notes, the folds. */
export function OwnerRest({ panel, onFix }: { panel: OwnerPanel; onFix: (step: string) => void }) {
  return (
    <>
      {panel.checklist ? <Checklist list={panel.checklist} onOpen={onFix} /> : null}
      <Rows rows={panel.rows} />
      {panel.notes.map((n) => (
        <Muted key={n}>{n}</Muted>
      ))}
      {panel.folds.map((fold) => (
        <Fold key={fold.title} fold={fold} />
      ))}
    </>
  );
}
