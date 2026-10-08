"use client";

import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkOverlay from "./WalkOverlay";
import WalkFooter from "./WalkFooter";
import WalkOptions, { WalkField, type WalkOption } from "./WalkOptions";
import type { ShareFields } from "@/lib/willab/walkShare";

/* -------------------------------------------------------------------------- */
/*  WalkShareScreen — sharing, after every finished review (build plan         */
/*  D-FW-20; founder lock 2026-10-06, flow 11): "After all, it's about         */
/*  speaking publicly!" / "Do you agree to share this take with others?",      */
/*  then the four choices exactly as the locked prototype draws them. Several */
/*  may be ticked; "None" stands alone. A ticked choice with fields shows     */
/*  them, rising in. A screen that stands apart: it cross-fades in. ✕ goes    */
/*  on without sharing, as the prototype's ✕ does.                           */
/*                                                                            */
/*  Every word is signed: the title and question (N52.5), the choices and    */
/*  their fields (WQ5 A; "None" S-B6 A). Consent words never rotate.          */
/* -------------------------------------------------------------------------- */

export type WalkShareField = keyof ShareFields;

export default function WalkShareScreen({
  testId,
  ticks,
  onTicks,
  fields,
  onField,
  ready,
  busy = false,
  onContinue,
  onClose,
}: {
  testId?: string;
  ticks: readonly string[];
  onTicks: (next: string[]) => void;
  /** The fields' values; absent, they are left to themselves (the dev harness). */
  fields?: ShareFields;
  onField?: (field: WalkShareField, value: string) => void;
  /** Continue is on. */
  ready: boolean;
  /** A share is on its way: Continue waits. */
  busy?: boolean;
  onContinue: () => void;
  onClose: () => void;
}) {
  const field = (name: WalkShareField, placeholder: string) => (
    <WalkField
      name={name}
      placeholder={placeholder}
      value={fields?.[name]}
      onChange={onField ? (value) => onField(name, value) : undefined}
    />
  );
  const options: readonly WalkOption[] = [
    { value: "general", label: WALK_COPY.shareGeneral, hint: WALK_COPY.shareGeneralHint },
    {
      value: "mine",
      label: WALK_COPY.shareMine,
      hint: WALK_COPY.shareMineHint,
      fields: field("minePassCode", WALK_COPY.fieldPassCode),
    },
    {
      value: "own",
      label: WALK_COPY.shareOwn,
      fields: (
        <>
          {field("ownName", WALK_COPY.fieldCommunityName)}
          {field("ownPassCode", WALK_COPY.fieldPassCode)}
        </>
      ),
    },
    { value: "none", label: WALK_COPY.shareNone, hint: WALK_COPY.shareNoneHint, exclusive: true },
  ];
  return (
    <WalkOverlay
      testId={testId}
      onClose={onClose}
      bare
      footer={
        <WalkFooter
          pill={{
            label: COPY.pillContinue,
            onClick: onContinue,
            disabled: !ready || busy,
            testId: "walk-forward",
          }}
        />
      }
    >
      <div className="flex flex-col gap-2.5 px-6 pb-1.5 pt-7">
        <h2 className="m-0 text-balance text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em]">
          {WALK_COPY.shareTitle}
        </h2>
        <p className="m-0 text-[16px] leading-[1.5]">{WALK_COPY.shareAsk}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3.5">
        <WalkOptions options={options} selected={ticks} onChange={onTicks} />
      </div>
    </WalkOverlay>
  );
}
