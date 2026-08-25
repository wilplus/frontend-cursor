"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import AppMenu from "@/components/AppMenu";
import { COMMUNITY_URL, SUPPORT_EMAIL } from "@/lib/appMenuLinks";
import { useAppMenuData } from "@/hooks/useAppMenuData";

/**
 * Shared sticky header for the public marketing pages (About, Journal/blog —
 * /science was folded into the blog 2026-07-30). The WillpowerLab logo links
 * home.
 *
 * FE-3 — the menu is now the SAME AppMenu the lab renders, not a second
 * hand-rolled one. It used to be its own list (Home / About / Science /
 * Journal / The lab) with its own styling and its own open/close behaviour;
 * the story asks for one component with two mounts, so the blog gets the
 * lab's menu verbatim: Lab first behind a 1px stroke, then the account rows.
 *
 * Signed out — the usual case here — that means no email row and no credits
 * row, with Lab still first, which falls out of AppMenu's own auth handling
 * rather than being special-cased for this mount.
 */
export default function SiteHeader() {
  const menu = useAppMenuData();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur">
      <Link href="/" className="no-underline" aria-label="WillpowerLab — home">
        <Logo />
      </Link>

      <AppMenu
        authState={menu.authState}
        userEmail={menu.userEmail}
        tokensLabel={menu.tokensLabel}
        lifeMenu={menu.lifeMenu}
        productMenu={menu.productMenu}
        supportEmail={SUPPORT_EMAIL}
        communityUrl={COMMUNITY_URL}
        onLogout={menu.logout}
        loggingOut={menu.loggingOut}
        labHref="/chat"
        corpusHref={menu.isCoach ? "/coach/corpus" : null}
      />
    </header>
  );
}
