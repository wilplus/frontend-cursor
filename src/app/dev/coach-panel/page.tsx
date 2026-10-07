"use client";

/* -------------------------------------------------------------------------- */
/*  Dev harness for the coach panel, redrawn, P1 (e2e/coach-panel.spec.mjs).   */
/*                                                                            */
/*  The founder-locked prototype's P1 screens (FOUNDER-LOCK-coach-panel-       */
/*  redesign-2026-10-06), drawn by the REAL panel (CoachPanelDoor and          */
/*  CoachPanel) over stubbed routes (panelFixtures.ts), with the real motion: */
/*                                                                            */
/*    /dev/coach-panel?screen=<name>     one screen, still: door, queue,       */
/*                                       speakers, speaker, judge, reveal     */
/*    /dev/coach-panel?flow=1&coach2=1   the Lounge door through the real     */
/*                                       switch (CoachWalkEntry); its own     */
/*                                       buttons move it, ‹ goes back, ✕      */
/*                                       closes, and What happened's Next     */
/*                                       hands over to today's answer flow    */
/*    /dev/coach-panel?flow=1            the same door with the switch off:   */
/*                                       today's door, unchanged              */
/*                                                                            */
/*  DEV ONLY. Production renders nothing — this is a test fixture, not a       */
/*  surface, and it must not become one.                                       */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import CoachWalkEntry from "@/components/willab/coachwalk/CoachWalkEntry";
import CoachPanelDoor from "@/components/willab/coachpanel/CoachPanelDoor";
import { installPanelStub } from "./panelFixtures";
import { PRE_RATED, SCREEN_NAMES, startFor, type ScreenName } from "./panelScreens";

type Mode = { kind: "index" } | { kind: "single"; name: ScreenName } | { kind: "flow" };

function readMode(search: string): Mode {
  const q = new URLSearchParams(search);
  if (q.get("flow") === "1") return { kind: "flow" };
  const name = q.get("screen");
  if (name && (SCREEN_NAMES as readonly string[]).includes(name)) return { kind: "single", name: name as ScreenName };
  return { kind: "index" };
}

function IndexList() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-2 p-5 text-[15px]">
      <h1 className="text-[18px] font-bold">Coach panel harness</h1>
      <a className="underline" href="?flow=1&coach2=1">flow</a>
      {SCREEN_NAMES.map((name) => (
        <a key={name} className="underline" href={`?screen=${name}`}>{name}</a>
      ))}
    </main>
  );
}

/** A plain stand-in for the Lounge: the door sits where the Lounge mounts it,
 *  above the message box. */
function LoungeStandIn({ children }: { children: React.ReactNode }) {
  return (
    <main data-testid="panel-lounge" className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-end gap-2.5 px-4 pb-8 pt-4">
      {children}
      <div aria-hidden="true" className="mt-1 h-[46px] rounded-3xl border border-border" />
    </main>
  );
}

function Harness() {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    const next = readMode(window.location.search);
    installPanelStub(next.kind === "single" ? PRE_RATED[next.name] : []);
    setMode(next);
  }, []);
  if (!mode) return null;
  if (mode.kind === "index") return <IndexList />;
  if (mode.kind === "flow") return <LoungeStandIn><CoachWalkEntry /></LoungeStandIn>;
  return (
    <div data-panel-harness={mode.name}>
      <LoungeStandIn><CoachPanelDoor initial={startFor(mode.name)} /></LoungeStandIn>
    </div>
  );
}

export default function CoachPanelHarness() {
  if (process.env.NODE_ENV === "production") return null;
  return <Harness />;
}
