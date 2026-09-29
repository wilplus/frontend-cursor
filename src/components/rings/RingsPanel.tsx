"use client";

import { useState } from "react";
import FeaturesTab from "./FeaturesTab";
import PeopleTab from "./PeopleTab";
import DefaultsTab from "./DefaultsTab";
import AnnouncementsTab from "./AnnouncementsTab";
import AuditTab from "./AuditTab";

/* -------------------------------------------------------------------------- */
/*  The rings panel: five tabs, as in the accepted mock.                       */
/*                                                                            */
/*  Features   — ring dropdown, rule editor, consent badge, people-on count,   */
/*               kill switch, note.                                            */
/*  People     — search, attribute filters, per-person ring, multi-select and  */
/*               bulk set.                                                     */
/*  Defaults   — the default ring for new accounts, your own ring, the        */
/*               attribute list.                                              */
/*  Announcements — title/body per feature, placeholders until signed off.    */
/*  Audit      — the append-only change list.                                  */
/*                                                                            */
/*  Direction of the ladder: higher ring = more features. A feature carries    */
/*  the lowest ring that gets it. Rings are plain integers, unbounded.         */
/*  Everything here is operator copy on a founder-only page.                   */
/* -------------------------------------------------------------------------- */

export const TABS = [
  { key: "features", label: "Features" },
  { key: "people", label: "People" },
  { key: "defaults", label: "Defaults" },
  { key: "announcements", label: "Announcements" },
  { key: "audit", label: "Audit" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export const RULE_SENTENCE =
  "A feature is on for a person when it is not killed, their ring ≥ its ring, its attribute rule matches them (AND of “key is in list”), and its consent (if any) is current for them.";

export default function RingsPanel() {
  const [tab, setTab] = useState<TabKey>("features");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rings</h1>
        <p className="text-sm text-foreground/60">
          founder only · every change here becomes one row in the audit log
        </p>
      </header>
      <p className="mb-4 text-sm text-foreground/70">{RULE_SENTENCE}</p>
      <nav role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-black/10">
        {TABS.map((item) => (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={
              "whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium " +
              (tab === item.key
                ? "border border-b-0 border-black/10 bg-white"
                : "text-foreground/60 hover:text-foreground")
            }
          >
            {item.label}
          </button>
        ))}
      </nav>
      <section role="tabpanel">
        {tab === "features" ? <FeaturesTab /> : null}
        {tab === "people" ? <PeopleTab /> : null}
        {tab === "defaults" ? <DefaultsTab /> : null}
        {tab === "announcements" ? <AnnouncementsTab /> : null}
        {tab === "audit" ? <AuditTab /> : null}
      </section>
    </main>
  );
}
