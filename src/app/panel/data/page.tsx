"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DELETE, EXPORT, STATUS, VIEWS } from "@/lib/life/copy";
import { deleteLifeData, exportLifeData } from "@/services/api/life";
import { invalidateLifeState } from "@/lib/life/useLifeState";
import { PanelCard, PanelHeading } from "@/components/life/primitives";

/* -------------------------------------------------------------------------- */
/*  FE-10 — export and delete                                                  */
/*                                                                            */
/*  LAUNCH BLOCKERS, not follow-ups. The engine ships public with no staged    */
/*  rollout, so there is no soft-launch window in which to add these later     */
/*  (spec §6.1). Own-data export and hard delete ship in P1.                   */
/*                                                                            */
/*  Two clicks from the panel, not buried in account settings: the shell keeps */
/*  a standing link to this page for anyone who has consented.                 */
/*                                                                            */
/*  Delete takes a typed confirmation. Not because typing is a good UX ritual, */
/*  but because this is the one action in the product that destroys four years */
/*  of a person's writing with nothing to restore it from.                     */
/* -------------------------------------------------------------------------- */

export default function DataPage() {
  return (
    <>
      <PanelHeading title={VIEWS.data.title} lede={VIEWS.data.lede} />
      <div className="space-y-6">
        <ExportCard />
        <DeleteCard />
      </div>
    </>
  );
}

function ExportCard() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setBusy(true);
    setFailed(false);
    try {
      const blob = await exportLifeData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "willpowerlab-panel-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PanelCard>
      <h2 className="text-[15px] font-medium text-foreground">
        {EXPORT.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{EXPORT.body}</p>
      {failed ? (
        <p className="mt-2 text-sm text-muted-foreground">{STATUS.error}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="mt-4 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-40"
      >
        {busy ? EXPORT.workingLabel : EXPORT.buttonLabel}
      </button>
    </PanelCard>
  );
}

function DeleteCard() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const armed = typed.trim() === DELETE.confirmWord;

  async function run() {
    if (!armed || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await deleteLifeData(DELETE.confirmWord);
      invalidateLifeState();
      router.push("/chat");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-destructive/40 bg-background p-4">
      <h2 className="text-[15px] font-medium text-foreground">
        {DELETE.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{DELETE.body}</p>
      <p className="mt-2 text-sm text-muted-foreground">{DELETE.hint}</p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {DELETE.confirmLabel}
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        />
      </label>

      {failed ? (
        <p className="mt-2 text-sm text-muted-foreground">{STATUS.error}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void run()}
        disabled={!armed || busy}
        className="mt-4 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-40"
      >
        {busy ? DELETE.workingLabel : DELETE.buttonLabel}
      </button>
    </div>
  );
}
