"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isFounderEmail } from "@/lib/founder";
import { COACH_WALK_COPY } from "@/lib/willab/coachWalkCopy";

/** The founder's doors from the CEO header: the rings panel (2026-09-29),
 *  the pace panel and the research screen (2026-09-30), and next to pace
 *  the exercise library and the speaking errors page, which left the coach's
 *  app (CP3 A, 2026-10-06, N56.3; each under the title its page already
 *  carries). Rendered only for the founder's account; each page answers for
 *  itself, so this is a shortcut, not a gate. */
const LINKS: [string, string][] = [
  ["/admin/rings", "Rings"],
  ["/admin/pace", "Pace"],
  ["/admin/library", COACH_WALK_COPY.libraryTitle],
  ["/admin/errors", "Speaking errors"],
  ["/admin/research", "Research"],
];

export default function FounderRingsLink() {
  const [founder, setFounder] = useState(false);

  useEffect(() => {
    let disposed = false;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!disposed) setFounder(isFounderEmail(data.user?.email));
      })
      .catch(() => {
        if (!disposed) setFounder(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  if (!founder) return null;
  return (
    <>
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {label}
        </Link>
      ))}
    </>
  );
}
