"use client";

/* -------------------------------------------------------------------------- */
/*  DEV ONLY — a redesign study of the Voice Album in the Feedback walk's      */
/*  look, built from the walk's own components (WalkOverlay, WalkMessage,     */
/*  WalkPlayer, WalkSpeakerBubble, WalkThreadMark, WalkFaces, WalkUnclear,    */
/*  WalkFooter). Nothing is fetched; the data is fixtures. Not a surface.     */
/*                                                                            */
/*    /dev/voice-album-walk?screen=home | moment | note | new | answered |    */
/*                                 empty | morning | listen&step=0..5         */
/*                                                                            */
/*  Words: only strings the app already shows (the walk's copy, today's       */
/*  Voice Album, and the backend's "Your Voice Album is ready" message).      */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import WalkOverlay from "@/components/willab/walk/WalkOverlay";
import WalkMessage from "@/components/willab/walk/WalkMessage";
import WalkPlayer from "@/components/willab/walk/WalkPlayer";
import WalkFooter from "@/components/willab/walk/WalkFooter";
import WalkFaces, { WalkUnclear } from "@/components/willab/walk/WalkFaces";
import { WalkSpeakerBubble, WalkThreadMark } from "@/components/willab/walk/WalkThread";
import { CHUNK_SHEET_COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import { makeToneUrl } from "../feedback-walk/walkFixtures";
import { ListenBefore, MorningLounge } from "./listenBefore";

type Screen = "home" | "moment" | "note" | "new" | "answered" | "empty" | "morning" | "listen";

/* Shipped words, gathered in one place so the study adds none of its own. */
const SHIPPED = {
  title: "Voice Album", // today's album header
  intro:
    "It holds moments where you and a coach heard your confident voice. Listen before presenting to feel calmer and remember how confident you already sound.", // backend arc_notifications.fire_voice_album_ready
  practiceNew: "Practice new", // today's album tab
  addNote: "Add a note", // today's album
  save: "Save",
  cancel: "Cancel",
  notePlaceholder: "Your note",
  coachHeard: "heard the same thing", // today's album history
  empty:
    "Your Voice Album is empty. Moments appear here only after the machine, you, and your coach independently hear confident delivery.",
};

const FACE: Record<string, string> = { yes: "👍 Yes", in_between: "😐 In-between", no: "👎 No" };

type Moment = { id: string; take: number; slide: number; date: string; ms: number };
const PROJECTS: { title: string; moments: Moment[] }[] = [
  {
    title: "Q3 Board pitch",
    moments: [
      { id: "s1", take: 2, slide: 1, date: "Oct 30", ms: 9000 },
      { id: "s2", take: 3, slide: 2, date: "Nov 2", ms: 7000 },
      { id: "s3", take: 3, slide: 4, date: "Nov 3", ms: 5000 },
    ],
  },
  { title: "Wedding toast", moments: [{ id: "s4", take: 3, slide: 1, date: "Nov 4", ms: 11000 }] },
];

const where = (m: Moment) => `Take ${m.take} · Slide ${m.slide} · ${m.date}`;

export default function VoiceAlbumWalkStudy() {
  const [src, setSrc] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [answer, setAnswer] = useState<ConfidenceRatingValue | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const url = makeToneUrl(4);
    setSrc(url);
    const q = new URLSearchParams(window.location.search).get("screen") as Screen | null;
    if (q) setScreen(q);
    setStep(Number(new URLSearchParams(window.location.search).get("step") ?? 0) || 0);
    return () => URL.revokeObjectURL(url);
  }, []);
  if (process.env.NODE_ENV === "production") return null;
  const close = () => setScreen("home");

  const shell = (node: React.ReactNode) => <div className="fixed inset-0 z-50">{node}</div>;

  if (screen === "morning") {
    return shell(<MorningLounge onOpen={() => { setStep(0); setScreen("listen"); }} onClose={close} />);
  }
  if (screen === "listen") {
    return shell(<ListenBefore step={step} src={src} onStep={setStep} onClose={() => setScreen("morning")} />);
  }

  if (screen === "empty") {
    return shell(
      <WalkOverlay caption={SHIPPED.title} onClose={close}>
        <WalkMessage>{SHIPPED.empty}</WalkMessage>
      </WalkOverlay>,
    );
  }

  if (screen === "home") {
    return shell(
      <WalkOverlay
        caption={SHIPPED.title}
        onClose={close}
        footer={<WalkFooter pill={{ label: SHIPPED.practiceNew, onClick: () => setScreen("new") }} />}
      >
        <WalkMessage>{SHIPPED.intro}</WalkMessage>
        {PROJECTS.map((p) => (
          <div key={p.title} className="flex flex-col gap-3">
            <WalkThreadMark label={p.title} />
            {p.moments.map((m) => (
              <div key={m.id} className="cursor-pointer" onClick={() => setScreen("moment")}>
                <WalkPlayer look="me" seed={m.id} src={src} durationMs={m.ms} label={where(m)} words={<span className="text-[13px] opacity-90">{where(m)}</span>} />
              </div>
            ))}
          </div>
        ))}
      </WalkOverlay>,
    );
  }

  if (screen === "moment" || screen === "note") {
    const m = PROJECTS[0].moments[1];
    const writing = screen === "note";
    return shell(
      <WalkOverlay
        nav={{ label: PROJECTS[0].title, index: 1, total: 3, onBack: () => {}, onNext: () => {} }}
        onClose={close}
        footer={
          writing ? (
            <WalkFooter
              pill={{ label: SHIPPED.save, onClick: () => setScreen("moment") }}
              links={[{ label: SHIPPED.cancel, onClick: () => setScreen("moment") }]}
            >
              <textarea
                autoFocus
                defaultValue="Breathe before the numbers."
                placeholder={SHIPPED.notePlaceholder}
                className="mb-2 min-h-[84px] w-full resize-none rounded-[22px] border-[1.5px] border-foreground bg-background px-[17px] py-[13px] text-[18.5px] leading-[1.45] outline-none"
              />
            </WalkFooter>
          ) : (
            <WalkFooter pill={{ label: SHIPPED.addNote, onClick: () => setScreen("note") }} />
          )
        }
      >
        <WalkThreadMark label={where(m)} />
        <WalkPlayer look="me" seed={m.id} src={src} durationMs={m.ms} label={where(m)} />
        <WalkMessage>{CHUNK_SHEET_COPY.confidenceQuestion}</WalkMessage>
        <WalkSpeakerBubble>{FACE.yes}</WalkSpeakerBubble>
        <WalkMessage coach>
          <span>{CHUNK_SHEET_COPY.titleCoachLine}</span>
          <span>{SHIPPED.coachHeard}</span>
        </WalkMessage>
        <WalkMessage wide>
          <div className="mb-2.5 aspect-[16/10] w-full rounded-[14px] bg-[#2a2a2a]" aria-label="Exercise video" />
          Slow down on “March”, then let the sentence end low.
        </WalkMessage>
        <WalkSpeakerBubble>Listen to this before the board meeting.</WalkSpeakerBubble>
      </WalkOverlay>,
    );
  }

  // Practice new: the walk's judging step, on the speaker's own clip.
  const answered = screen === "answered" ? (answer ?? "yes") : answer;
  return shell(
    <WalkOverlay
      nav={{ position: `${SHIPPED.practiceNew} · ${answered ? 2 : 1} ${CHUNK_SHEET_COPY.pagerOf} 2`, index: answered ? 1 : 0, total: 2, onBack: () => {}, onNext: () => {}, backDisabled: !answered }}
      onClose={close}
      footer={
        <WalkFooter>
          <WalkFaces answered={null} onPick={(v) => setAnswer(v)} />
          <WalkUnclear onPick={() => setAnswer("audio_unclear")} />
        </WalkFooter>
      }
    >
      <WalkThreadMark label={`${PROJECTS[0].title} · Take 3 · Slide 3`} />
      <WalkMessage wide>
        <WalkPlayer look="bare" seed="q1" src={src} durationMs={6000} label={CHUNK_SHEET_COPY.confidenceQuestion} />
        <span className="mt-2">{CHUNK_SHEET_COPY.confidenceQuestion}</span>
      </WalkMessage>
      {answered ? (
        <>
          <WalkSpeakerBubble>{FACE[answered] ?? WALK_COPY.judgeUnclear}</WalkSpeakerBubble>
          <WalkThreadMark label={`${PROJECTS[0].title} · Take 3 · Slide 5`} />
          <WalkMessage wide>
            <WalkPlayer look="bare" seed="q2" src={src} durationMs={6000} label={CHUNK_SHEET_COPY.confidenceQuestion} />
            <span className="mt-2">{CHUNK_SHEET_COPY.confidenceQuestion}</span>
          </WalkMessage>
        </>
      ) : null}
    </WalkOverlay>,
  );
}
