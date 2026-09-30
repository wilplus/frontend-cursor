"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's one door under the Lounge thread: the walk when its switch is  */
/*  on (group 3, founder 2026-09-30), the roster button until then. Kept out   */
/*  of Lounge.tsx so the Lounge's own branch count stays where the ratchet     */
/*  froze it.                                                                  */
/* -------------------------------------------------------------------------- */

import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import CoachWalkEntry from "./CoachWalkEntry";

export default function CoachDoor({
  walkOn,
  onOpenRoster,
  onAnswer,
}: {
  walkOn: boolean;
  onOpenRoster: () => void;
  onAnswer: (sessionId: string, snippetId: string) => void;
}) {
  if (walkOn) return <CoachWalkEntry onAnswer={onAnswer} />;
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onOpenRoster}
      className="h-12 w-full gap-2 rounded-full"
    >
      <Users className="h-4 w-4" />
      Your students
    </Button>
  );
}
