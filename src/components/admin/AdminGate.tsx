"use client";

import { useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  AdminGate — nothing renders until the backend says you are an admin.       */
/*  Founder 2026-08-12: "gate it so it is not publicly available."             */
/*                                                                            */
/*  NOT A SECURITY BOUNDARY, and treating it as one is the mistake to avoid.   */
/*  Every admin endpoint enforces @require_admin on its own; a page that       */
/*  skipped this would still get 403s and no data. What this closes is         */
/*  EXPOSURE — without it the token top-up form renders for anyone who knows   */
/*  the URL, publishing the shape of a money endpoint and offering a           */
/*  ready-made phishing surface. The gate removes the form; the decorator      */
/*  removes the access. Both, or the page is either useless or naked.          */
/*                                                                            */
/*  IT SAYS "NOT FOUND", NOT "FORBIDDEN". A page that announces "admins only"  */
/*  confirms the URL is real and worth attacking. The one thing this surface   */
/*  should tell an unauthorised visitor is nothing at all.                     */
/*                                                                            */
/*  A FAILED PROBE IS NOT AN ADMIN. Network error, 500, unreachable backend —  */
/*  all deny. The safe direction for a lock is closed, which is the opposite   */
/*  of the rule the rest of this codebase follows for FEEDBACK reads (where a  */
/*  hiccup must never take the surface dark). Different failure, different     */
/*  direction.                                                                */
/* -------------------------------------------------------------------------- */
export default function AdminGate({
  children,
}: {
  children: React.ReactNode;
}) {
  // null = still probing. Rendering the children optimistically and pulling
  // them back would flash the form at exactly the person it is hidden from.
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v2/admin/whoami", { cache: "no-store" })
      .then((r) => {
        if (!cancelled) setAllowed(r.ok);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (allowed === null) return null;
  if (!allowed) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-sm text-foreground/60">
          This page does not exist.
        </p>
      </main>
    );
  }
  return <>{children}</>;
}
