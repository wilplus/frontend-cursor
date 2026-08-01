"use client";

import { useCallback } from "react";
import { EMPTY } from "@/lib/life/copy";
import { fetchTimeline } from "@/services/api/life";
import TimelineCanvas from "@/components/life/TimelineCanvas";
import {
  EmptyState,
  Resource,
  usePanelResource,
} from "@/components/life/primitives";

/** FE-8 — the timeline. Data from GET /v2/life/timeline, never localStorage:
 *  this view is inside the app and reads the same rows every other view does. */
export default function TimelinePage() {
  const load = useCallback(() => fetchTimeline(), []);
  const resource = usePanelResource("timeline", load);

  return (
    <>
      <Resource resource={resource}>
        {(events) =>
          events.length === 0 ? (
            <EmptyState>{EMPTY.timeline}</EmptyState>
          ) : (
            <TimelineCanvas events={events} />
          )
        }
      </Resource>
    </>
  );
}
