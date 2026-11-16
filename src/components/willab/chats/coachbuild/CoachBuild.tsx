"use client";

import { useState, type ReactNode } from "react";
import { ONE_THING_COPY } from "@/components/willab/idealEditCopy";
import { checkPlugin } from "@/lib/willab/chatBuilder/plugins";
import { speakingCoachSeed } from "@/lib/willab/chatBuilder/seed";
import type { CoachDefinition, PluginDraft } from "@/lib/willab/chatBuilder/types";
import { startTry, type TryThing } from "@/services/api/hostSetup";
import { submitPlugin } from "@/services/api/chatBuilder";

const NOTCHES: Record<string, number[]> = {
  "tempo_stretch.MIN_OUTSIDE": [0.35, 0.3, 0.25, 0.2, 0.15],
  "moment_pick.FLOOR": [0.5, 0.55, 0.6, 0.65, 0.7],
};

const TRY_OF: Record<string, TryThing> = {
  "verbal_cues.FILLER_MIN_COUNT": "filler_cluster",
  "verbal_cues.FILLER_MIN_PER_100_WORDS": "filler_cluster",
  "verbal_cues.HEDGE_MIN_COUNT": "hedging",
  "verbal_cues.RESTART_MIN_COUNT": "restart_repair",
};

const NAMES: Record<string, string> = {
  "tempo_stretch.MIN_OUTSIDE": "A rushed moment",
  "verbal_cues.FILLER_MIN_COUNT": "Filler words",
  "verbal_cues.HEDGE_MIN_COUNT": "Hedging",
  "verbal_cues.RESTART_MIN_COUNT": "Restarts",
  "moment_pick.FLOOR": "A moment that needs a fix",
};

type Screen =
  | { id: "offer" }
  | { id: "home" }
  | { id: "pace" }
  | { id: "paceWhen" }
  | { id: "notice" }
  | { id: "dial"; name: string }
  | { id: "order" }
  | { id: "colour" }
  | { id: "card" }
  | { id: "paste" }
  | { id: "pasted"; draft: PluginDraft }
  | { id: "line" }
  | { id: "locked" }
  | { id: "kept"; line: string };

const LOCKED = new Set<string>();
for (const value of Object.values(ONE_THING_COPY)) {
  if (typeof value === "string") LOCKED.add(value);
}

function nudge(name: string, value: number, direction: "more" | "fewer"): number {
  const notches = NOTCHES[name];
  if (!notches) return value;
  const index = notches.indexOf(value);
  if (index < 0) return value;
  const next = direction === "more" ? index + 1 : index - 1;
  return notches[Math.max(0, Math.min(notches.length - 1, next))] ?? value;
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 rounded-full border border-primary px-4 text-[15px] font-semibold text-primary">
      {label}
    </button>
  );
}

/** One question at a time over the speaking-coach draft. */
export default function CoachBuild({
  doc,
  onChange,
  onClose,
}: {
  doc: CoachDefinition | null;
  onChange: (next: CoachDefinition) => void;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<Screen>(doc ? { id: "home" } : { id: "offer" });
  const [paste, setPaste] = useState("");
  const [colour, setColour] = useState(doc?.theme.color.primary ?? "#ff6a14");

  const ask = (title: string, chips: { label: string; onClick: () => void }[], extra?: ReactNode) => (
    <div data-coach-build={screen.id} className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <button type="button" onClick={onClose} className="px-2 text-[15px] text-muted-foreground">Back</button>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-4">
        <p className="max-w-[36ch] text-[17px] leading-snug">{title}</p>
        {extra}
        <div className="flex flex-col items-end gap-2">{chips.map((c) => <Chip key={c.label} {...c} />)}</div>
      </div>
    </div>
  );

  if (!doc || screen.id === "offer") {
    return ask("Your chat is open. The speaking coach is still the one in the app. Want to build it from here?", [
      { label: "Yes, start from today's coach", onClick: () => { onChange(speakingCoachSeed()); setScreen({ id: "home" }); } },
      { label: "Not now", onClick: onClose },
    ]);
  }

  if (screen.id === "home") {
    return ask("Tap a part.", [
      { label: "The pace step", onClick: () => setScreen({ id: "pace" }) },
      { label: "What I notice", onClick: () => setScreen({ id: "notice" }) },
      { label: "The order", onClick: () => setScreen({ id: "order" }) },
      { label: "The colour", onClick: () => setScreen({ id: "colour" }) },
      { label: "The card", onClick: () => setScreen({ id: "card" }) },
      { label: "A line", onClick: () => setScreen({ id: "line" }) },
      { label: "Paste an intervention", onClick: () => setScreen({ id: "paste" }) },
    ]);
  }

  if (screen.id === "pace") {
    const on = doc.walk.steps.some((s) => s.key === "tempo" && s.when !== "never");
    return ask(on ? "The pace step is on. It practises a stretch that runs past the green." : "The pace step is off.", [
      { label: "Keep it", onClick: () => setScreen({ id: "home" }) },
      { label: "Change it", onClick: () => setScreen({ id: "paceWhen" }) },
    ]);
  }

  if (screen.id === "paceWhen") {
    const setWhen = (when: CoachDefinition["walk"]["steps"][number]["when"]) => {
      onChange({
        ...doc,
        walk: { ...doc.walk, steps: doc.walk.steps.map((s) => (s.key === "tempo" ? { ...s, when } : s)) },
      });
      setScreen(when === "never" ? { id: "home" } : { id: "dial", name: "tempo_stretch.MIN_OUTSIDE" });
    };
    return ask("When should it be the one thing they practise?", [
      { label: "When rushing outweighs the moment", onClick: () => setWhen("one_fix_is_tempo") },
      { label: "Never", onClick: () => setWhen("never") },
    ]);
  }

  if (screen.id === "notice") {
    const rows = Object.entries(NAMES);
    return ask("This is what I notice in a message. Tap one.", rows.map(([name, label]) => ({ label, onClick: () => setScreen({ id: "dial", name }) })));
  }

  if (screen.id === "dial") {
    const row = doc.noticing.dials.find((d) => d.name === screen.name);
    const value = typeof row?.default === "number" ? row.default : null;
    const move = (direction: "more" | "fewer") => {
      if (value == null) return;
      const next = nudge(screen.name, value, direction);
      onChange({
        ...doc,
        noticing: { ...doc.noticing, dials: doc.noticing.dials.map((d) => (d.name === screen.name ? { ...d, default: next } : d)) },
      });
      const thing = TRY_OF[screen.name];
      if (thing) void startTry(thing, direction);
      setScreen({ id: "kept", line: `I'll try catching ${direction} on the next 20 recordings, silently. Nobody sees a change.` });
    };
    return ask(`${NAMES[screen.name] ?? "This"}. Catch a shorter one, or only a long one?`, [
      { label: "Catch more", onClick: () => move("more") },
      { label: "Keep", onClick: () => setScreen({ id: "home" }) },
      { label: "Catch fewer", onClick: () => move("fewer") },
    ]);
  }

  if (screen.id === "order") {
    const moveAfter = () => {
      const steps = [...doc.walk.steps];
      const tempo = steps.findIndex((s) => s.key === "tempo");
      const words = steps.findIndex((s) => s.key === "words");
      if (tempo >= 0 && words >= 0 && tempo < words) {
        const [row] = steps.splice(tempo, 1);
        steps.splice(words, 0, row);
        onChange({ ...doc, walk: { ...doc.walk, steps } });
      }
      setScreen({ id: "home" });
    };
    return ask("The pace step comes before the helper words.", [
      { label: "Keep that", onClick: () => setScreen({ id: "home" }) },
      { label: "Move it after", onClick: moveAfter },
    ]);
  }

  if (screen.id === "colour") {
    return ask(`The orange is ${doc.theme.color.primary}. Keep it, or use another?`, [
      { label: "Keep", onClick: () => setScreen({ id: "home" }) },
      { label: "Pick another", onClick: () => setScreen({ id: "colour" }) },
    ], screen.id === "colour" ? (
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!/^#[0-9a-fA-F]{6}$/.test(colour)) return;
          onChange({ ...doc, theme: { ...doc.theme, color: { ...doc.theme.color, primary: colour } } });
          setScreen({ id: "home" });
        }}
      >
        <input aria-label="Colour" value={colour} onChange={(event) => setColour(event.target.value)} className="h-11 flex-1 rounded-full border border-border px-4" />
        <button type="submit" className="min-h-11 rounded-full bg-foreground px-4 text-background">Keep</button>
      </form>
    ) : null);
  }

  if (screen.id === "card") {
    return ask("The card shows the slide range, the attempts, the delivery word, and the progress bar.", [
      { label: "Keep all of it", onClick: () => setScreen({ id: "home" }) },
      { label: "Hide the progress bar", onClick: () => { onChange({ ...doc, shell: { ...doc.shell, historyCard: { showProgress: false } } }); setScreen({ id: "home" }); } },
    ]);
  }

  if (screen.id === "line") {
    const lines = doc.walk.steps.filter((s) => s.fixed);
    return ask("Tap a line.", lines.map((s) => ({
      label: s.fixed,
      onClick: () => setScreen(LOCKED.has(s.fixed) ? { id: "locked" } : { id: "home" }),
    })));
  }

  if (screen.id === "locked") {
    return ask("That word is locked.", [{ label: "Keep", onClick: () => setScreen({ id: "home" }) }]);
  }

  if (screen.id === "paste") {
    return ask("So you want a new intervention? Paste the code here.", [
      {
        label: "Check it",
        onClick: () => {
          const box = document.querySelector<HTMLTextAreaElement>("[data-coach-paste]");
          const text = box?.value ?? paste;
          void checkPlugin(text).then(async (local) => {
            const remote = await submitPlugin(text);
            setScreen({ id: "pasted", draft: remote ?? local });
          });
        },
      },
    ], (
      <textarea data-coach-paste="" aria-label="Paste here" defaultValue={paste} onChange={(event) => setPaste(event.target.value)} className="min-h-28 rounded-2xl border border-border p-3 text-[15px]" placeholder="Paste here" />
    ));
  }

  if (screen.id === "pasted") {
    const draft = screen.draft;
    const line = draft.status === "checked"
      ? "Kept. It is not in the coach yet. Use it stays off until the runner exists."
      : draft.reasons.includes("manifest")
        ? "I kept the paste. I need five lines at the top: what it notices, which kind it is, and which screen it uses."
        : draft.reasons.includes("component")
          ? "That screen isn't one of ours. I can put your line on a screen we have, or keep the paste as a note."
          : "I kept the paste. It cannot run.";
    return ask(line, [
      { label: "Leave it as a draft", onClick: () => setScreen({ id: "home" }) },
      { label: "Throw it away", onClick: () => { setPaste(""); setScreen({ id: "home" }); } },
    ]);
  }

  return ask(screen.line, [{ label: "Keep", onClick: () => setScreen({ id: "home" }) }]);
}
