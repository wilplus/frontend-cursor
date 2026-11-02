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
import { fetchCommunities, joinCommunity, shareTake, type Community } from "@/services/api/communities";
import { keepNextTakeShare, shareChoiceMeta, SHARE_PASS_CODE_MIN, type ShareChoiceMeta } from "@/lib/willab/nextTakeShare";
import { shareChat, shareLineDraft, shareLineText } from "@/lib/willab/walkThread";
import { useLoungeThreadMaybe } from "./LoungeThreadContext";

/* -------------------------------------------------------------------------- */
/*  NextTakeShareScreen — "How big you want your audience?" (flow page G;     */
/*  prototype v31, the share step, one to one). Asked once, the first time   */
/*  "Record Take 2" is tapped, and again only when the words change or a     */
/*  community is added (backend N309 item 5; IdealTextActions decides).      */
/*                                                                            */
/*    The opener and the question in grey bubbles; the top bar names the     */
/*    Take. General community · Only my community (the saved communities,    */
/*    all ticked; "+ Add a community with a passcode" → Passcode + Add) ·    */
/*    Only me, which stands alone. Nothing is ticked until the speaker       */
/*    chooses, except when the line under a Take's recording opens it again  */
/*    to change the choice: then the choice as it stands (`initial`).        */
/*                                                                            */
/*  Before a Take the choice is kept for the Take about to be recorded       */
/*  (nextTakeShare.ts) and stored as the line it will show; from the line it */
/*  is applied to that Take at once, shared or taken back (G4), and stored   */
/*  as its new line. Either way the newest line is the choice the next      */
/*  Takes keep. ✕ closes the question and records nothing (prototype v31,   */
/*  lensOff); only Continue goes on.                                          */
/* -------------------------------------------------------------------------- */

export default function NextTakeShareScreen({
  takeCount = null,
  arcId = null,
  initial = null,
  takeSessionId = null,
  onDone,
  onClose,
}: {
  /** The Take just reviewed, for the top bar ("Take 2"). */
  takeCount?: number | null;
  /** The project: its chat bubbles open its Ideal Text (›). */
  arcId?: string | null;
  /** Opened again to change: the choice as it stands, ticked
   *  (`communityIds` null ticks every saved community, as before). */
  initial?: { ticks: string[]; communityIds: string[] | null } | null;
  /** Opened from the line under this Take's recording: Continue applies the
   *  choice to it now instead of keeping it for the next Take. */
  takeSessionId?: string | null;
  /** Continue: on to the recording, or back from the line. */
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
      // A failed read still asks: the speaker's communities are just not
      // listed (it used to skip the question and look like it closed).
      const own = res.ok ? res.data.filter((c) => c.kind === "private") : [];
      const ids = own.map((c) => c.id);
      const kept = initial?.communityIds?.filter((id) => ids.includes(id)) ?? [];
      setSaved(own);
      setMine(kept.length ? kept : ids);
      // Nothing is ticked until the speaker chooses (founder 2026-10-15,
      // fix 1; Privacy 3.6 §4d: a pre-ticked box is not consent). Continue
      // waits for one choice; "Only me" counts. Opened again to change, the
      // choice they gave is ticked (N309 item 5).
      setTicks(initial ? initial.ticks : []);
    });
    return () => {
      live = false;
    };
    // Read once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (text: string) => setToast((t) => ({ seq: (t?.seq ?? 0) + 1, text }));
  const ready = ticks.length > 0 && (!ticks.includes("mine") || mine.length > 0) && !busy;

  const close = () => {
    if (!takeSessionId) keepNextTakeShare(null);
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

  /** From the line: the Take is shared as chosen, or taken back from every
   *  community (G4), then its line says the new choice. A refusal keeps
   *  the line as it was. */
  const change = async (take: string, share: ShareChoiceMeta, names: string[]) => {
    setBusy(true);
    const res = await shareTake(
      take,
      share.none
        ? { general: false, communityIds: [], none: true }
        : { general: share.general, communityIds: share.community_ids, none: false, shareWordsVersion: share.words_version },
    );
    setBusy(false);
    if (!res.ok) {
      say(WALK_COPY.shareFailed);
      return;
    }
    await thread?.append(shareLineDraft(shareLineText(ticks, names), share, arcId, take)).catch(() => undefined);
    onDone();
  };

  const submit = () => {
    if (!ready) return;
    // The choice as the chat shows it; a failed post never stops recording.
    const names = (saved ?? []).filter((c) => mine.includes(c.id)).map((c) => c.name ?? "").filter(Boolean);
    const share = shareChoiceMeta(ticks, mine);
    if (takeSessionId) {
      void change(takeSessionId, share, names);
      return;
    }
    const next = typeof takeCount === "number" ? takeCount + 1 : null;
    void (async () => {
      for (const draft of shareChat(next, ticks, names, arcId, share)) await thread?.append(draft);
    })().catch(() => undefined);
    keepNextTakeShare(share.none ? null : { general: share.general, communityIds: share.community_ids });
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
    <div data-next-take-share data-walk-column className="fixed inset-0 z-[90] flex flex-col bg-background">
      <WalkOverlay
        testId="next-take-share"
        caption={typeof takeCount === "number" && takeCount >= 1 ? `${COPY.historyTake} ${takeCount}` : null}
        onClose={close}
        footer={
          <WalkFooter pill={{ label: COPY.pillContinue, onClick: submit, disabled: !ready, testId: "share-continue" }} />
        }
      >
        {/* Three bubbles (founder 2026-10-14). */}
        <WalkMessage>{WALK_COPY.shareBefore}</WalkMessage>
        <WalkMessage>{WALK_COPY.shareTitle}</WalkMessage>
        <WalkMessage>{WALK_COPY.shareAudience}</WalkMessage>
        {saved ? <WalkOptions options={options} selected={ticks} onChange={setTicks} /> : null}
      </WalkOverlay>
      {toast ? <WalkToast key={toast.seq} message={toast.text} onDone={() => setToast(null)} /> : null}
    </div>
  );
}
