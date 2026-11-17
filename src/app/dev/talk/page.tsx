"use client";

import { useEffect, useState } from "react";
import TalkBuild from "@/components/willab/chats/hostsetup/TalkBuild";

/* The talk, on a phone, with no account and no network.
   DEV ONLY. Production renders nothing. Open /dev/talk. */

const MODELS = [{ id: "hedge", q: "Did they hedge?" }];

export default function TalkPreviewPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <Harness />;
}

function Harness() {
  const [where, setWhere] = useState<"home" | "list" | "talk">("list");
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <main data-talk-screen="" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-border px-2">
        <button type="button" data-talk-back="" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[20px]" aria-label="Back" onClick={() => setWhere(where === "talk" ? "list" : "home")}>‹</button>
        <span className="text-[16px] font-semibold">Your chat</span>
      </header>
      {where === "home" ? <p data-talk-home="" className="px-4 py-6 text-[16px]">Home</p> : null}
      {where === "list" ? (
        <div className="flex flex-col gap-3 px-4 py-4">
          <button type="button" data-talk-open="" className="min-h-11 self-start text-[15px] font-semibold text-primary" onClick={() => setWhere("talk")}>Talk it through</button>
        </div>
      ) : null}
      {where === "talk" ? (
        <TalkBuild onList={() => setWhere("list")} models={MODELS} />
      ) : null}
    </main>
  );
}
