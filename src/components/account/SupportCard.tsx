"use client";

import { SUPPORT_EMAIL } from "@/lib/appMenuLinks";

/* Support, moved here from the ☰ menu (founder 2026-10-07: "remove the
   support from the hamburger and add it to the settings page with just an
   email to contact@willpowerlab.com"). Just the address, selectable, and a
   mailto that may or may not open a mail app. */
export const SUPPORT_TITLE = "Support";

export default function SupportCard() {
  return (
    <section className="mt-6 rounded-2xl border border-border p-5" aria-label={SUPPORT_TITLE}>
      <h2 className="text-base font-semibold">{SUPPORT_TITLE}</h2>
      <p className="mt-2 text-sm">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="select-all underline underline-offset-4"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
    </section>
  );
}
