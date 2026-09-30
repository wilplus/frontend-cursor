"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isFounderEmail } from "@/lib/founder";

/** The founder's doors from the CEO header: the rings panel (2026-09-29),
 *  the pace panel and the research screen (2026-09-30). Rendered only for
 *  the founder's account; each page answers for itself, so this is a
 *  shortcut, not a gate. */
const LINKS: [string, string][] = [
  ["/admin/rings", "Rings"],
  ["/admin/pace", "Pace"],
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
