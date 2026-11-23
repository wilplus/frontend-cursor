"use client";

import { useCallback, useRef, useState } from "react";
import { loadRingState } from "@/services/api/rings";
import { NATIVE_TAKE_FEATURE, nativeTakeAvailable } from "@/lib/willab/nativeTakeRecorder";
import { useDualCaptureMic, type DualCaptureMic } from "./useDualCaptureMic";
import { useNativeTakeMic } from "./useNativeTakeMic";

/** Which recorder records this Take (backend N655, N662): the phone's own in
 *  the iPhone app with the TakeRecorder plugin and the ring row `native_take`
 *  on; the web recorder everywhere else (a browser, the home-screen app, an
 *  app version without the plugin, the row off or unread). Decided at each
 *  start, so a ring change reaches the next Take. */
export async function recordsNatively(): Promise<boolean> {
  if (!nativeTakeAvailable()) return false;
  try {
    return (await loadRingState()).featuresOn.has(NATIVE_TAKE_FEATURE);
  } catch {
    return false;
  }
}

/** The Take's microphone: the recording screens' one recorder, with the web
 *  recorder's interface whichever records. */
export function useTakeMic(): DualCaptureMic {
  const web = useDualCaptureMic({ transcript: false });
  const native = useNativeTakeMic();
  const [useNative, setUseNative] = useState(false);
  const recordersRef = useRef({ web, native });
  recordersRef.current = { web, native };
  const activeRef = useRef<DualCaptureMic>(web);
  activeRef.current = useNative ? native : web;

  const start = useCallback(async () => {
    const nativeNow = await recordsNatively();
    setUseNative(nativeNow);
    const { web: w, native: n } = recordersRef.current;
    activeRef.current = nativeNow ? n : w;
    await activeRef.current.start();
  }, []);
  const stop = useCallback(() => activeRef.current.stop(), []);
  const cancel = useCallback(() => activeRef.current.cancel(), []);
  const getAudioStartedAt = useCallback(() => activeRef.current.getAudioStartedAt(), []);
  const getPausedMs = useCallback(() => activeRef.current.getPausedMs(), []);

  return {
    state: activeRef.current.state,
    start,
    stop,
    cancel,
    getAudioStartedAt,
    getPausedMs,
  };
}
