"use client";

import StrategyPanel from "@/components/life/StrategyPanel";
import ProposalDeck from "@/components/life/ProposalCards";

/** FE-9 — Strategy: read, download, re-upload as an approved diff.
 *
 *  The one strategy proposal allowed per day (L-2b) surfaces here too, above
 *  the document it would change, so the diff and its target are on one screen. */
export default function StrategyPage() {
  return (
    <>
      <ProposalDeck kinds={["strategy"]} title="Waiting for you" />
      <StrategyPanel />
    </>
  );
}
