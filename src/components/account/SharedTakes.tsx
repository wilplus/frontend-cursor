"use client";

/* -------------------------------------------------------------------------- */
/*  Shared Takes, inside Your projects (founder 2026-10-15, fix 3). Each      */
/*  Take shared right now says where, with Stop sharing: its clips leave     */
/*  every community at once (Privacy 3.6 §4d). Nothing shows while nothing   */
/*  is shared or the list cannot be read.                                    */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchSharedTakes,
  stopSharingTake,
  type SharedTake,
} from "@/services/api/takeShares";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

export function sharedWhere(take: SharedTake): string {
  return take.communities
    .map((c) => (c.kind === "general" ? COPY.generalCommunity : c.name || ""))
    .filter(Boolean)
    .join(", ");
}

export default function SharedTakes({ quietHover }: { quietHover: string }) {
  const [takes, setTakes] = useState<SharedTake[] | null>(null);
  const [stopped, setStopped] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchSharedTakes().then((list) => {
      if (alive) setTakes(list);
    });
    return () => { alive = false; };
  }, []);

  if (!takes || (takes.length === 0 && !stopped)) return null;

  const stop = async (take: SharedTake) => {
    setFailed(null);
    const ok = await stopSharingTake(take.takeSessionId);
    if (!ok) {
      setFailed(take.takeSessionId);
      return;
    }
    setTakes((list) => (list ?? []).filter((t) => t.takeSessionId !== take.takeSessionId));
    setStopped(true);
  };

  return (
    <div className="mt-2">
      <ul className="divide-y divide-border border-t border-border">
        {takes.map((take) => (
          <li key={take.takeSessionId} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="min-w-0 break-words text-[15px]">
              {take.project ? `${take.project}, ` : ""}
              {COPY.shareTake(take.takeIndex)}
              <span className="ml-2 text-[13px] text-muted-foreground">
                {COPY.sharedWith(sharedWhere(take))}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`rounded-full ${quietHover}`}
              onClick={() => void stop(take)}
            >
              {COPY.stopSharing}
            </Button>
            {failed === take.takeSessionId ? (
              <p role="alert" className="w-full text-sm text-destructive">{COPY.failed}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {stopped ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">{COPY.stoppedSharing}</p>
      ) : null}
    </div>
  );
}
