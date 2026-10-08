"use client";

import { useEffect, useState } from "react";
import ReportCard from "@/components/willab/ReportCard";
import { setNewCoachFeedback } from "@/lib/willab/newCoachFeedback";
import type { LoungeMessage } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  /dev/feedback-walk?lounge=new|plain&walk=1 — the PRODUCTION Ideal Text     */
/*  bubble (ReportCard) as the Lounge draws it, for the screenshot harness     */
/*  (X7): with new coach feedback waiting for the walk (the orange outline and */
/*  the "new" tag, D-FW-19), or with none. The flag is set here, never read;  */
/*  the bubble's own document read fails quietly (no project), and its title   */
/*  is the row's own. DEV ONLY: page.tsx renders nothing in production.       */
/* -------------------------------------------------------------------------- */

export type LoungeView = "new" | "plain";

const ARC = "dev-arc";

const BUBBLE: LoungeMessage = {
  client_id: "dev-ideal-text",
  role: "bot",
  kind: "ideal_text",
  body: "",
  metadata: { arc_id: ARC, version: 2, topic: "Q3 Board pitch" },
  client_created_at: "2026-10-08T09:00:00Z",
};

export default function LoungeBubble({ view }: { view: LoungeView }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setNewCoachFeedback({ [ARC]: view === "new" });
    setReady(true);
  }, [view]);
  if (!ready) return null;
  return (
    <main data-lounge-bubble={view} className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-end gap-2 bg-background px-4 pb-24 pt-8">
      <ReportCard message={BUBBLE} latestForArc onOpenIdealText={() => undefined} />
    </main>
  );
}
