"use client";

import { useState } from "react";
import HostSetup from "@/components/willab/chats/hostsetup/HostSetup";
import type { HostRecipe, SetupPart } from "@/services/api/hostSetup";

const MODEL = { q: "Ok?", opts: ["Yes", "No"], says: "", own: false };

/* Every row's last Yes and No, with no account. DEV ONLY. Open /dev/row-yes. */

const SENDS = ["rec", "text", "photo", "file"] as const;
const PARTS: SetupPart[] = [
  { part: "send", title: "They send", value: "A recording · A message · A photo · A file" },
  { part: "walk", title: "The walk", value: "Their best moment" },
  { part: "out", title: "They get back", value: "An answer" },
];

function recipe(): HostRecipe {
  return {
    spec: "Speaking coach",
    suggest: {
      line: ["People come."], send: [...SENDS], out: ["answer", "words"], hello: ["Hi."],
      qs: ["How?"], taps: [["Ask"]], models: [MODEL], name: ["Ask"], sample_in: "", sample_out: "",
    },
    line: "People come.", name: "Ask", send: [...SENDS], out: "answer", hello: "Hi.",
    questions: [], taps: ["Ask"], smart: false, way: "own", models: [MODEL], who: "shadow",
    share: false, price: 0, cost: { people: 0, sends: 0 }, live: true,
  };
}

export default function RowYesPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <Harness />;
}

function Harness() {
  const [active, setActive] = useState<string | null>(null);
  const [at, setAt] = useState("list");
  const index = PARTS.findIndex((part) => part.part === active);
  const next = () => {
    const following = PARTS[index + 1];
    setAt(following ? following.part : "list");
    setActive(following ? following.part : null);
  };
  return (
    <main data-row-yes="" className="flex min-h-screen flex-col bg-background text-foreground">
      <p data-row-now="">{at}</p>
      {active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <HostSetup
            key={active}
            name="Artur"
            recipe={recipe()}
            parts={{ line: null, parts: PARTS }}
            part={active}
            onClose={() => { setActive(null); setAt("list"); }}
            onDone={next}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-4">
          {PARTS.map((part) => (
            <button key={part.part} type="button" data-build-part={part.part} className="min-h-11 text-left text-[16px]" onClick={() => { setActive(part.part); setAt(part.part); }}>
              {part.title}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
