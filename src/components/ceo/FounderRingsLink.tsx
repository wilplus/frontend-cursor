"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isFounderEmail } from "@/lib/founder";

/** The one way into the rings panel from the CEO header (founder 2026-09-29).
 *  Rendered only for the founder's account; the panel itself answers Not
 *  Found to anyone else, so this is a shortcut, not a gate. */
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
    <Link
      href="/admin/rings"
      className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      Rings
    </Link>
  );
}
