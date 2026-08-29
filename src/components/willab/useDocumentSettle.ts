"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearProcessingTake,
  markProcessingTakeFailed,
  markProcessingTakeIdealTextUnconfirmed,
  readProcessingTake,
  type ProcessingTake,
} from "@/lib/willab/processingTake";
import {
  documentSettled,
  probeOf,
  type DocumentProbe,
} from "@/lib/willab/documentSettle";
import { fetchIdealText } from "@/services/api/idealText";
import { useUserId } from "./useUserId";

/* -------------------------------------------------------------------------- */
/*  useDocumentSettle — the ONE pending authority for the blocking screen       */
/*  (SPEC-lockin-loop §1).                                                     */
/*                                                                            */
/*  Reads the processing-take marker on an interval (500ms) rather than on     */
/*  flips, which closes §6.4 S5's blindness for its consumers: a marker        */
/*  written by another tab, or transitioned mid-view, is seen within 500ms     */
/*  without waiting for the next navigation.                                   */
/*                                                                            */
/*  While any spoken Take is in its "document" phase, probes the served Ideal */
/*  Text every second and clears it only on evidence the Take's review version */
/*  landed. The cap is Take 1's explicit unconfirmed terminal state; a later  */
/*  Take becomes an ordinary failed job rather than silently succeeding.       */
/*  The "analysis" phase is NOT probed here: the readout watches (LabOverlay   */
/*  live,                                                                        */
/*  Lounge resume) own that phase and transition it to "document" at their     */
/*  terminal states.                                                          */
/*                                                                            */
/*  Multiple mounts may run concurrently (Lounge + Lab readout + picker        */
/*  overlay). That is safe by construction: probes are reads, and the clear    */
/*  is session-scoped — the worst case is one redundant GET per surface.       */
/* -------------------------------------------------------------------------- */

// These loops run only while the visible processing/read surface is enabled.
// A multi-second UI delay after the backend finished made document assembly
// look like a second analysis pass, so keep the observer responsive without
// turning it into an always-on poller.
const MARKER_POLL_MS = 500;
const PROBE_MS = 1_000;
/** A marker older than this is stale regardless of phase (same 30-min rule
 *  the Lounge resume watch applies). */
const MARKER_STALE_MS = 30 * 60_000;

export function useDocumentSettle({
  enabled,
  onSettled,
  onExpired,
}: {
  /** Read + probe only while true. Consumers gate on their own visibility so
   *  a surface that stood down (Lounge under the Lab) does not double-probe. */
  enabled: boolean;
  /** Fired once after positive settlement and marker clear — the refetch
   *  hook for consumers that need to pull the fresh document into view. */
  onSettled?: (take: ProcessingTake) => void;
  /** Defensive fallback for a document phase that reaches the same locked
   *  120-second boundary before the backend terminal event arrives. */
  onExpired?: (take: ProcessingTake) => void;
}): {
  /** A take is in flight (either phase) — the text surfaces must block. */
  pending: boolean;
  /** The in-flight take's index, for the chip. */
  takeIndex: number | null;
} {
  const userId = useUserId();
  const [marker, setMarker] = useState<ProcessingTake | null>(null);
  const firstProbeRef = useRef<DocumentProbe | null>(null);
  const probedSessionRef = useRef<string | null>(null);
  // THE PRE-ASSEMBLY BASELINE (founder 2026-08-10, "the analysis is taking
  // too long like it runs twice"). The version-moved settle rule needs a
  // baseline that PRECEDES assembly — the old first-probe baseline was
  // captured in the DOCUMENT phase, i.e. possibly after assembly already
  // landed, in which case no delta was ever observable and the block ran to
  // its full 2-minute cap on every take that won no block. Assembly happens
  // at pipeline end, strictly after the analysis phase, so a version read
  // during ANALYSIS is a safe "before" — the first document-phase probe then
  // confirms in seconds. Keyed by session; a late mount that missed the
  // analysis phase falls back to the old first-probe rule + cap.
  const baselineRef = useRef<{
    sessionId: string;
    probe: DocumentProbe;
  } | null>(null);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  // The marker read loop. Also runs immediately on enable, so a surface that
  // mounts mid-analysis blocks on its first paint rather than one poll later.
  useEffect(() => {
    if (!enabled) {
      setMarker(null);
      return;
    }
    const read = () => {
      const m = readProcessingTake(userId);
      if (m && Date.now() - m.startedAt > MARKER_STALE_MS) {
        clearProcessingTake(userId, m.sessionId);
        setMarker(null);
        return;
      }
      setMarker((prev) =>
        prev?.sessionId === m?.sessionId &&
        prev?.phase === m?.phase &&
        prev?.status === m?.status &&
        prev?.progress?.stage === m?.progress?.stage &&
        prev?.progress?.percent === m?.progress?.percent
          ? prev
          : m,
      );
    };
    read();
    const id = setInterval(read, MARKER_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, userId]);

  const settle = useCallback(
    (take: ProcessingTake) => {
      clearProcessingTake(userId, take.sessionId);
      setMarker(null);
      firstProbeRef.current = null;
      probedSessionRef.current = null;
      // Preserve the exact completed Take across the marker-clear boundary.
      // Consumers need its project identity to open the freshly-settled Ideal
      // Text; asking localStorage again after clear would necessarily lose it.
      onSettledRef.current?.(take);
    },
    [userId],
  );

  const expire = useCallback(
    (take: ProcessingTake) => {
      const takeOne = take.takeIndex === 1;
      if (takeOne) {
        markProcessingTakeIdealTextUnconfirmed(userId, take.sessionId);
      } else {
        markProcessingTakeFailed(userId, take.sessionId);
      }
      const terminal = {
        ...take,
        status: takeOne
          ? ("failed_ideal_text_unconfirmed" as const)
          : ("failed" as const),
      };
      setMarker(terminal);
      firstProbeRef.current = null;
      probedSessionRef.current = null;
      onExpiredRef.current?.(terminal);
    },
    [userId],
  );

  // The analysis-phase baseline read: ONE fetch per session, while the take
  // is still transcribing — before assembly can have moved the version.
  useEffect(() => {
    if (
      !enabled ||
      !marker ||
      marker.phase !== "analysis" ||
      marker.status !== "processing"
    ) {
      return;
    }
    const { sessionId, arcId } = marker;
    if (!arcId || baselineRef.current?.sessionId === sessionId) return;
    let active = true;
    void fetchIdealText(arcId).then((r) => {
      if (!active || baselineRef.current?.sessionId === sessionId) return;
      if (r.kind === "single") {
        baselineRef.current = {
          sessionId,
          probe: probeOf({ version: r.version, pieces: r.pieces }),
        };
      }
    });
    return () => {
      active = false;
    };
  }, [enabled, marker]);

  // The document-phase probe.
  useEffect(() => {
    if (
      !enabled ||
      !marker ||
      marker.phase !== "document" ||
      marker.status !== "processing"
    ) {
      return;
    }
    const { sessionId, arcId, takeIndex, phaseStartedAt } = marker;
    if (!arcId) {
      // No arc → no document to observe. A standalone recording assembles no
      // ideal text, so there is nothing to wait for.
      settle(marker);
      return;
    }
    if (probedSessionRef.current !== sessionId) {
      probedSessionRef.current = sessionId;
      // Seed from the analysis-phase baseline when we have one — the whole
      // point: the first probe here can then already see the version moved.
      firstProbeRef.current =
        baselineRef.current?.sessionId === sessionId
          ? baselineRef.current.probe
          : null;
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
            Date.now(),
          ) === "expired"
        ) {
          expire(marker);
        }
        return;
      }
      const current = probeOf(
        r.kind === "single"
          ? { version: r.version, pieces: r.pieces }
          : { version: null, pieces: null },
      );
      if (firstProbeRef.current === null) firstProbeRef.current = current;
      const verdict = documentSettled(
        takeIndex,
        firstProbeRef.current,
        current,
        phaseStartedAt,
        Date.now(),
      );
      if (verdict === "settled") settle(marker);
      if (verdict === "expired") expire(marker);
    };
    void probe();
    const id = setInterval(() => void probe(), PROBE_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, marker, settle, expire]);

  return {
    pending: enabled && marker !== null && marker.status === "processing",
    takeIndex: marker?.takeIndex ?? null,
  };
}
