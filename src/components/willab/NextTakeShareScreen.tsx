"use client";

import { useEffect, useState } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "./idealEditCopy";
import WalkOverlay from "./walk/WalkOverlay";
import WalkFooter from "./walk/WalkFooter";
import WalkOptions, { WalkField, type WalkOption } from "./walk/WalkOptions";
import WalkToast from "./walk/WalkToast";
import { fetchCommunities, joinCommunity, type Community } from "@/services/api/communities";
import { keepNextTakeShare, SHARE_PASS_CODE_MIN } from "@/lib/willab/nextTakeShare";

/* -------------------------------------------------------------------------- */
/*  NextTakeShareScreen — "Do you agree to share your next take with          */
/*  others?", asked when "Record Take N" is tapped, from Take 2 on (founder    */
/*  lock 2026-10-12, moment and feedback chat, sections 5 and 9).              */
/*                                                                            */
/*    General community.                                                      */
/*    Only my community: the speaker's saved communities, all ticked; any     */
/*      can be unticked; "+ Add a community with a passcode" at the bottom.   */
/*    Only me: stands alone.                                                  */
/*                                                                            */
/*  The choice is kept for the Take about to be recorded (nextTakeShare.ts).  */
/*  ✕ records without sharing. With communities off, nothing is asked.      */
/* -------------------------------------------------------------------------- */

export default function NextTakeShareScreen({ onDone }: { onDone: () => void }) {
  const [saved, setSaved] = useState<Community[] | null>(null);
  const [ticks, setTicks] = useState<string[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void fetchCommunities().then((res) => {
      if (!live) return;
      if (!res.ok) {
        onDone();
        return;
      }
      const own = res.data.filter((c) => c.kind === "private");
      setSaved(own);
      setMine(own.map((c) => c.id));
    });
    return () => {
      live = false;
    };
    // Asked once per tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typed = code.trim();
  const codeOk = typed.length === 0 || typed.length >= SHARE_PASS_CODE_MIN;
  const ready =
    ticks.length > 0 &&
    codeOk &&
    (!ticks.includes("mine") || mine.length > 0 || typed.length >= SHARE_PASS_CODE_MIN);

  const close = () => {
    keepNextTakeShare(null);
    onDone();
  };

  const submit = async () => {
    if (!ready || busy) return;
    if (ticks.includes("none")) return close();
    const ids = ticks.includes("mine") ? [...mine] : [];
    if (ticks.includes("mine") && typed) {
      setBusy(true);
      const res = await joinCommunity(typed);
      setBusy(false);
      if (!res.ok || !res.data.id) {
        const unknown = !res.ok && (res.status === 404 || res.code === "PASS_CODE_INVALID");
        setToast((t) => ({ seq: (t?.seq ?? 0) + 1, text: unknown ? WALK_COPY.sharePassCodeUnknown : WALK_COPY.shareFailed }));
        return;
      }
      if (!ids.includes(res.data.id)) ids.push(res.data.id);
    }
    keepNextTakeShare({ general: ticks.includes("general"), communityIds: ids });
    onDone();
  };

  const mineFields = (
    <div className="flex w-full flex-col gap-2">
      {(saved ?? []).map((c) => (
        <label key={c.id} className="flex items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            checked={mine.includes(c.id)}
            onChange={(e) => setMine((m) => (e.target.checked ? [...m, c.id] : m.filter((id) => id !== c.id)))}
            className="h-[18px] w-[18px] accent-foreground"
          />
          {c.name}
        </label>
      ))}
      {adding ? (
        <WalkField name="addPassCode" placeholder={WALK_COPY.fieldPassCode} value={code} onChange={setCode} />
      ) : (
        <button
          type="button"
          data-testid="share-add-community"
          onClick={() => setAdding(true)}
          className="text-left text-[14.5px] text-muted-foreground"
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
        onClose={close}
        bare
        footer={
          <WalkFooter
            pill={{ label: COPY.pillContinue, onClick: () => void submit(), disabled: !ready || busy, testId: "share-continue" }}
          />
        }
      >
        <div className="flex flex-col gap-2.5 px-6 pb-1.5 pt-7">
          <p className="m-0 text-balance text-[22px] leading-[1.25]">{WALK_COPY.shareTitle}</p>
          <p className="m-0 text-[16px] leading-[1.5]">{WALK_COPY.nextShareAsk}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3.5">
          {saved ? <WalkOptions options={options} selected={ticks} onChange={setTicks} /> : null}
        </div>
      </WalkOverlay>
      {toast ? <WalkToast key={toast.seq} message={toast.text} onDone={() => setToast(null)} /> : null}
    </div>
  );
}
