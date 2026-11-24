"use client";

import { useState } from "react";
import ProductHome from "@/components/willab/chats/ProductHome";
import WillBuild from "@/components/willab/chats/WillBuild";
import type { TrainingArc } from "@/services/api/trainings";

/* The chat list and Build, on a phone, with no account and no network.
   DEV ONLY. Production renders nothing. Open /dev/own-chat. */

const PROJECTS = [{
  arcId: "bro",
  topic: "just my take bro",
  createdAt: null,
  takeCount: 0,
  takes: [],
  batchVerified: false,
  idealReady: false,
  bestPresentationArcId: "bro",
  coverRef: null,
  deletion: null,
  archived: false,
}] as TrainingArc[];

export default function OwnChatPreviewPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <Screen />;
}

function Screen() {
  const [open, setOpen] = useState(false);
  return (
    <main data-own-chat-screen="" className="fixed inset-0 flex flex-col bg-background text-foreground">
      <ProductHome
        knownProjects={PROJECTS}
        onOpenSpeaking={() => undefined}
        onOpenProject={() => undefined}
        onStartNewProject={() => undefined}
        onOpenOwnChat={() => setOpen(true)}
      />
      {open ? <WillBuild onBack={() => setOpen(false)} /> : null}
    </main>
  );
}
