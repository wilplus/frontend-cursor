"use client";

import { useEffect, useState } from "react";
import { withSessionBearer } from "@/lib/api/sessionBearer";

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
    // SPEED (founder 2026-10-13: "tap and open"; 2026-10-14: the CEO app on
    // the home screen boots straight in). After one confirmed probe on this
    // device, admin pages render at once and re-check in the background; a
    // "no" on the re-check still hides them. The remembered yes only skips
    // the blank wait: every admin endpoint enforces @require_admin, so it
    // opens no data.
    if (rememberedAdmin()) setAllowed(true);
    void probeAdmin().then((ok) => {
      if (!cancelled) setAllowed(ok);
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

// localStorage, not sessionStorage: an app opened from the home screen
// starts a new session every time, so a per-session memory never helped it.
const REMEMBER_KEY = "willab:admin-confirmed:v2";

export function rememberedAdmin(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(ok: boolean) {
  try {
    if (ok) localStorage.setItem(REMEMBER_KEY, "1");
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage blocked: every page probes, as before */
  }
}

// One probe per page load, shared by the gate and the admin menu.
let probe: Promise<boolean> | null = null;

/** Whether the backend says this account is an admin. A failed probe is a no. */
export function probeAdmin(): Promise<boolean> {
  probe ??= withSessionBearer({ cache: "no-store" })
    .then((init) => fetch("/api/v2/admin/whoami", init))
    .then((r) => r.ok)
    .catch(() => false)
    .then((ok) => {
      remember(ok);
      if (!ok) probe = null;
      return ok;
    });
  return probe;
}
