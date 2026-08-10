"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearProcessingTake,
  readProcessingTake,
  type ProcessingTake,
} from "@/lib/willab/processingTake";
import {
  documentSettled,
  probeOf,
  type DocumentProbe,
} from "@/lib/willab/documentSettle";
import { fetchIdealText } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  useDocumentSettle — the ONE pending authority for the blocking screen       */
/*  (SPEC-lockin-loop §1).                                                     */
/*                                                                            */
/*  Reads the processing-take marker on an interval (2s) rather than on state  */
/*  flips, which closes §6.4 S5's blindness for its consumers: a marker        */
/*  written by another tab, or transitioned mid-view, is seen within two       */
/*  seconds instead of at the next navigation.                                 */
/*                                                                            */
/*  While the marker is in its "document" phase, probes the served ideal text  */
/*  every 4s and clears the marker on evidence the new text landed (or on the  */
/*  bounded cap — lib/willab/documentSettle.ts owns the rules). The            */
/*  "analysis" phase is NOT probed here: the readout watches (LabOverlay live, */
/*  Lounge resume) own that phase and transition it to "document" at their     */
/*  terminal states.                                                          */
/*                                                                            */
/*  Multiple mounts may run concurrently (Lounge + Lab readout + picker        */
/*  overlay). That is safe by construction: probes are reads, and the clear    */
/*  is session-scoped — the worst case is one redundant GET per surface.       */
/* -------------------------------------------------------------------------- */

const MARKER_POLL_MS = 2_000;
const PROBE_MS = 4_000;
/** A marker older than this is stale regardless of phase (same 30-min rule
 *  the Lounge resume watch applies). */
const MARKER_STALE_MS = 30 * 60_000;

export function useDocumentSettle({
  enabled,
  onSettled,
}: {
  /** Read + probe only while true. Consumers gate on their own visibility so
   *  a surface that stood down (Lounge under the Lab) does not double-probe. */
  enabled: boolean;
  /** Fired once per settle/expiry, AFTER the marker cleared — the refetch
   *  hook for consumers that need to pull the fresh document into view. */
  onSettled?: () => void;
}): {
  /** A take is in flight (either phase) — the text surfaces must block. */
  pending: boolean;
  /** The in-flight take's index, for the chip. */
  takeIndex: number | null;
} {
  const [marker, setMarker] = useState<ProcessingTake | null>(null);
  const firstProbeRef = useRef<DocumentProbe | null>(null);
  const probedSessionRef = useRef<string | null>(null);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  // The marker read loop. Also runs immediately on enable, so a surface that
  // mounts mid-analysis blocks on its first paint rather than 2s later.
  useEffect(() => {
    if (!enabled) {
      setMarker(null);
      return;
    }
    const read = () => {
      const m = readProcessingTake();
      if (m && Date.now() - m.startedAt > MARKER_STALE_MS) {
        clearProcessingTake(m.sessionId);
        setMarker(null);
        return;
      }
      setMarker((prev) =>
        prev?.sessionId === m?.sessionId && prev?.phase === m?.phase
          ? prev
          : m
      );
    };
    read();
    const id = setInterval(read, MARKER_POLL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  const settle = useCallback((sessionId: string) => {
    clearProcessingTake(sessionId);
    setMarker(null);
    firstProbeRef.current = null;
    probedSessionRef.current = null;
    onSettledRef.current?.();
  }, []);

  // The document-phase probe.
  useEffect(() => {
    if (!enabled || !marker || marker.phase !== "document") return;
    const { sessionId, arcId, takeIndex, phaseStartedAt } = marker;
    if (!arcId) {
      // No arc → no document to observe. A standalone recording assembles no
      // ideal text, so there is nothing to wait for.
      settle(sessionId);
      return;
    }
    if (probedSessionRef.current !== sessionId) {
      probedSessionRef.current = sessionId;
      firstProbeRef.current = null;
    }
    let active = true;
    const probe = async () => {
      const r = await fetchIdealText(arcId);
      if (!active) return;
      if (r.kind !== "single" && r.kind !== "ready") {
        // No document served — only the cap can release from here.
        if (
          documentSettled(
            takeIndex,
            firstProbeRef.current,
            { version: null, maxTakeIndex: null },
            phaseStartedAt,
            Date.now()
          ) === "expired"
        ) {
          settle(sessionId);
        }
        return;
      }
      const current = probeOf(
        r.kind === "single"
          ? { version: r.version, pieces: r.pieces }
          : { version: null, pieces: null }
      );
      if (firstProbeRef.current === null) firstProbeRef.current = current;
      const verdict = documentSettled(
        takeIndex,
        firstProbeRef.current,
        current,
        phaseStartedAt,
        Date.now()
      );
      if (verdict !== "waiting") settle(sessionId);
    };
    void probe();
    const id = setInterval(() => void probe(), PROBE_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, marker, settle]);

  return {
    pending: enabled && marker !== null,
    takeIndex: marker?.takeIndex ?? null,
  };
}
