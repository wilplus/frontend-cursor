"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "./idealEditCopy";
import WalkOverlay from "./walk/WalkOverlay";
import WalkFooter from "./walk/WalkFooter";
import WalkMessage from "./walk/WalkMessage";
import WalkOptions, { WalkField, type WalkOption } from "./walk/WalkOptions";
import WalkToast from "./walk/WalkToast";
import { fetchCommunities, joinCommunity, type Community } from "@/services/api/communities";
import { keepNextTakeShare, SHARE_PASS_CODE_MIN } from "@/lib/willab/nextTakeShare";
import { shareChat } from "@/lib/willab/walkThread";
import { useLoungeThreadMaybe } from "./LoungeThreadContext";

/* -------------------------------------------------------------------------- */
/*  NextTakeShareScreen — "Do you agree to share your next take with          */
/*  others?", asked when "Record Take N" is tapped, from Take 2 on (founder    */
/*  lock 2026-10-12, moment and feedback chat, sections 5 and 9; prototype    */
/*  v31, the share step, one to one).                                          */
/*                                                                            */
/*    The opener and the question in one grey bubble; the top bar names the   */
/*    Take. General community · Only my community (the saved communities,    */
/*    all ticked; "+ Add a community with a passcode" → Passcode + Add) ·    */
/*    Only me, which stands alone. Ticked by default: "Only my community"    */
/*    when the speaker has communities, else "General community".            */
/*                                                                            */
/*  The choice is kept for the Take about to be recorded (nextTakeShare.ts).  */
/*  ✕ closes the question and records nothing (prototype v31, lensOff); only */
/*  Continue goes on to the recording. With communities off, nothing is      */
/*  asked.                                                                    */
/* -------------------------------------------------------------------------- */

export default function NextTakeShareScreen({
  takeCount = null,
  arcId = null,
  onDone,
  onClose,
}: {
  /** The Take just reviewed, for the top bar ("Take 2"). */
  takeCount?: number | null;
  /** The project: its chat bubbles open its Ideal Text (›). */
  arcId?: string | null;
  /** Continue: on to the recording. */
  onDone: () => void;
  /** ✕: the question closes and nothing is recorded. */
  onClose: () => void;
}) {
  const [saved, setSaved] = useState<Community[] | null>(null);
  const [ticks, setTicks] = useState<string[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null);
  const thread = useLoungeThreadMaybe();

  useEffect(() => {
    let live = true;
    void fetchCommunities().then((res) => {
      if (!live) return;
      if (!res.ok) {
        (onCancel ?? onDone)();
        return;
      }
      const own = res.data.filter((c) => c.kind === "private");
      setSaved(own);
      setMine(own.map((c) => c.id));
      setTicks(own.length > 0 ? ["mine"] : ["general"]);
    });
    return () => {
      live = false;
    };
    // Asked once per tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (text: string) => setToast((t) => ({ seq: (t?.seq ?? 0) + 1, text }));
  const ready = ticks.length > 0 && (!ticks.includes("mine") || mine.length > 0) && !busy;

  const close = () => {
    keepNextTakeShare(null);
    onClose();
  };

  const add = async () => {
    const typed = code.trim();
    if (typed.length < SHARE_PASS_CODE_MIN || busy) return;
    setBusy(true);
    const res = await joinCommunity(typed);
    setBusy(false);
    if (!res.ok || !res.data.id) {
      const unknown = !res.ok && (res.status === 404 || res.code === "PASS_CODE_INVALID");
      say(unknown ? WALK_COPY.sharePassCodeUnknown : WALK_COPY.shareFailed);
      return;
    }
    const joined = res.data;
    setSaved((list) => (list?.some((c) => c.id === joined.id) ? list : [...(list ?? []), joined]));
    setMine((m) => (m.includes(joined.id) ? m : [...m, joined.id]));
    setCode("");
    setAdding(false);
  };

  const submit = () => {
    if (!ready) return;
    // The choice as the chat shows it; a failed post never stops recording.
    const names = (saved ?? []).filter((c) => mine.includes(c.id)).map((c) => c.name ?? "").filter(Boolean);
    const next = typeof takeCount === "number" ? takeCount + 1 : null;
    void (async () => {
      for (const draft of shareChat(next, ticks, names, arcId)) await thread?.append(draft);
    })().catch(() => undefined);
    keepNextTakeShare(
      ticks.includes("none") ? null : { general: ticks.includes("general"), communityIds: ticks.includes("mine") ? mine : [] },
    );
    onDone();
  };

  const toggleMine = (id: string) => setMine((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const mineFields = (
    <div className="flex w-full flex-col gap-1.5">
      {(saved ?? []).map((c) => {
        const on = mine.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => toggleMine(c.id)}
            className="flex items-center gap-2.5 px-0.5 py-1.5 text-left text-[15px]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-background",
                on ? "border-foreground bg-foreground" : "border-foreground/35",
              )}
            >
              {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            {c.name}
          </button>
        );
      })}
      {adding ? (
        <div className="flex gap-1.5">
          <WalkField name="passcode" placeholder={WALK_COPY.sharePasscode} value={code} onChange={setCode} />
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy}
            className="shrink-0 rounded-[10px] border border-border px-3 text-[14px] font-semibold"
          >
            {WALK_COPY.shareAdd}
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="share-add-community"
          onClick={() => setAdding(true)}
          className="px-0.5 py-1.5 text-left text-[14px] text-muted-foreground"
        >
          {WALK_COPY.shareAddCommunity}
        </button>
      )}
    </div>
  );

  const options: readonly WalkOption[] = [
    { value: "general", label: WALK_COPY.shareGeneral, hint: WALK_COPY.shareGeneralHint },
    { value: "mine", label: WALK_COPY.shareMine, hint: WALK_COPY.shareMineHint, fields: mineFields },
    { value: "none", label: WALK_COPY.shareOnlyMe, hint: WALK_COPY.shareNoneHint, exclusive: true },
  ];

  return (
    <div data-next-take-share className="fixed inset-0 z-[90] flex flex-col bg-background">
      <WalkOverlay
        testId="next-take-share"
        caption={typeof takeCount === "number" && takeCount >= 1 ? `${COPY.historyTake} ${takeCount}` : null}
        onClose={close}
        footer={
          <WalkFooter pill={{ label: COPY.pillContinue, onClick: submit, disabled: !ready, testId: "share-continue" }} />
        }
      >
        <WalkMessage>
          <span>
            {WALK_COPY.shareTitle}
            <br />
            {WALK_COPY.nextShareAsk}
          </span>
        </WalkMessage>
        {saved ? <WalkOptions options={options} selected={ticks} onChange={setTicks} /> : null}
      </WalkOverlay>
      {toast ? <WalkToast key={toast.seq} message={toast.text} onDone={() => setToast(null)} /> : null}
    </div>
  );
}
