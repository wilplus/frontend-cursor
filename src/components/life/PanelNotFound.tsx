import Link from "next/link";

/**
 * The dead end for a /panel URL that resolves to nothing: the flag is off, or
 * this user is on no allowlist, or the route does not exist.
 *
 * It says nothing about a panel, a trial, or an allowlist. A 404 that hints at
 * what is behind it is a 403 wearing a costume, and the point of the 404 is
 * that there is nothing to discover (spec §1.4).
 *
 * No "use client": this is markup and a Link, so both the server `not-found.tsx`
 * and the client shell can render it, and the two dead ends look identical.
 */
export default function PanelNotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">This page does not exist.</p>
      <Link
        href="/chat"
        className="mt-4 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
      >
        Back to the lab
      </Link>
    </div>
  );
}
