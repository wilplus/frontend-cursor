"use client";

/* -------------------------------------------------------------------------- */
/*  Will's questions, the founder's only (founder 2026-10-20, N83; prototype  */
/*  https://claude.ai/artifact/WLZ1KY6dX1RBLXiNU73F9N): one row under the    */
/*  queue's blind lists opens this screen. Will's questions after a Take, in  */
/*  the groups Will picks them by, each with when Will asks it and how often */
/*  it was asked. Tap a question or a tap answer to change it, then Save:    */
/*  Will asks the new words from the next Take. An empty slot takes a        */
/*  question of the founder's own. The backend checks the words and says     */
/*  what is wrong; it keeps the groups and the "when" lines.                 */
/* -------------------------------------------------------------------------- */

import { useState } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkFooter from "../walk/WalkFooter";
import WalkLoading from "../walk/WalkLoading";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import type { WillBank, WillBankItem } from "@/services/api/willBank";

type Change = Pick<WillBankItem, "key" | "question" | "chips">;

function Card({ item, onChange }: { item: WillBankItem; onChange: (next: Change) => void }) {
  const [adding, setAdding] = useState(false);
  if (item.empty && !adding && !item.question) {
    return (
      <button type="button" data-will-slot={item.key} onClick={() => setAdding(true)}
        className="flex w-full flex-col rounded-[14px] border border-dashed border-border px-4 py-3 text-left text-muted-foreground">
        <span className="text-[12.5px]">{COPY.emptySlot}</span>
        <span className="text-[15.5px]">+ {COPY.addQuestion}</span>
      </button>
    );
  }
  return (
    <div data-will-item={item.key} className="flex flex-col gap-1.5 rounded-[14px] border border-border px-4 py-3">
      <span className="text-[12.5px] text-muted-foreground">{item.when}</span>
      <textarea
        aria-label={item.when}
        value={item.question}
        autoFocus={adding}
        onChange={(e) => onChange({ key: item.key, question: e.target.value, chips: item.chips })}
        className="w-full resize-none bg-transparent text-[15.5px] leading-[1.45] outline-none [field-sizing:content]"
        rows={2}
      />
      {item.ownWords ? (
        <span className="text-[13px] text-muted-foreground">{COPY.ownWords}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {item.chips.map((chip, i) => (
            <input
              key={i}
              aria-label={`${item.when} · ${i + 1}`}
              value={chip}
              size={Math.max(4, chip.length)}
              onChange={(e) => onChange({ key: item.key, question: item.question,
                chips: item.chips.map((c, j) => (j === i ? e.target.value : c)) })}
              className="rounded-full border-[1.5px] border-primary bg-background px-3 py-[3px] text-[13.5px] font-semibold text-primary outline-none"
            />
          ))}
        </div>
      )}
      {item.empty ? null : <span className="text-[12.5px] text-muted-foreground">{COPY.askedTimes(item.asked)}</span>}
    </div>
  );
}

export function WillBankScreen({ bank, onSave, onBack, onClose }: {
  /** null while it loads. */
  bank: WillBank | null;
  /** Resolves with the backend's sentence when the words were refused, else null. */
  onSave: (changes: Change[]) => Promise<string | null>;
  onBack: () => void;
  onClose: () => void;
}) {
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const dirty = Object.keys(changes).length > 0;
  const shown = (item: WillBankItem): WillBankItem => ({ ...item, ...changes[item.key] });

  async function save(): Promise<void> {
    setBusy(true);
    const refused = await onSave(Object.values(changes));
    setBusy(false);
    setFail(refused);
    if (refused === null) setChanges({});
  }

  const footer = (
    <WalkFooter pill={{ label: COPY.save, onClick: () => void save(), disabled: !dirty || busy, testId: "will-bank-save" }}>
      {fail ? <p role="alert" className="m-0 pb-2 text-center text-[14px] text-destructive">{fail}</p> : null}
    </WalkFooter>
  );
  return (
    <WalkOverlay title={COPY.willQuestions} subtitle={COPY.willIntro} onBack={onBack} onClose={onClose}
      footer={footer} testId="coach-panel-willbank">
      {bank ? (
        bank.groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</span>
            {group.items.map((item) => (
              <Card key={item.key} item={shown(item)}
                onChange={(next) => setChanges((c) => ({ ...c, [next.key]: next }))} />
            ))}
          </section>
        ))
      ) : (
        <WalkLoading />
      )}
    </WalkOverlay>
  );
}
