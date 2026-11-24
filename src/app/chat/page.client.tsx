"use client";

import { useEffect } from "react";
import WillabSurface from "@/components/willab/WillabSurface";
import MembersOnly from "@/components/invite/MembersOnly";
import DumpScreenHost from "@/components/willab/DumpScreenHost";
import { hasAcceptedConsentLocally } from "@/components/willab/useWillabFlow";
import { hasParkedReadout } from "@/components/willab/willabParked";
import { prefetchChatOpen } from "@/services/api/bootPrefetch";
import { chatLinkHref } from "@/lib/willab/chatLink";

/**
 * /chat — the willab product surface.
 *
 * Phase 5 clearance (D1 = REPLACE): the legacy charisma/stress funnel that used
 * to live here behind `NEXT_PUBLIC_WILLAB_BETA` has been removed. willab is now
 * the only product; this is a thin client wrapper over WillabSurface, which owns
 * the whole flow (Welcome → Intake → Lounge → Lab → Readout → Send → Insights).
 */
export default function ChatPageClient({
  take,
  coach,
}: {
  /** `?take=<session_id>` (backend N691 item 3), or null. */
  take: string | null;
  /** The link asks for the coach's bubble (chatLink.ts). */
  coach: boolean;
}) {
  // The boot reads start with the members check, not after it; past
  // Welcome only, as the flow itself reads nothing before it
  // (bootPrefetch.ts prefetchChatOpen).
  useEffect(() => {
    if (hasAcceptedConsentLocally()) void prefetchChatOpen({ parked: hasParkedReadout() });
  }, []);
  // A link already sent arrives with its old parameters: the address keeps
  // only `take`, so a reload or a shared link reads the one link.
  useEffect(() => {
    const href = chatLinkHref(window.location.href);
    if (href !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", href);
    }
  }, []);
  // By invitation (backend N471): members only; the guest path is off.
  return (
    <MembersOnly>
      <WillabSurface linkTake={take} coachLink={coach} />
      {/* The dump screen opens first only on a plain open, never from a
          link to a Take (backend N506, N507). */}
      <DumpScreenHost plain={!coach} />
    </MembersOnly>
  );
}
