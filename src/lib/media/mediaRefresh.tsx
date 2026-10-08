"use client";

/* -------------------------------------------------------------------------- */
/*  Playback that survives an expired link (founder 2026-10-08, "make sure    */
/*  the playbacks work all across the app").                                 */
/*                                                                            */
/*  The backend signs every media link it serves for a few hours (re-signed   */
/*  on every GET). A page left open past that, or a sheet that froze its      */
/*  items when it opened, holds a dead link, and the player went silent.      */
/*                                                                            */
/*  The HOST that fetched the links wraps its screens in MediaRefreshProvider */
/*  with the payload it holds and a `refresh` that reads it again. A PLAYER   */
/*  takes its src through useRecoverableSrc:                                  */
/*                                                                            */
/*    - its src is looked up, by the link's path, in the host's latest        */
/*      payload, so a copy frozen before the refresh still plays the fresh    */
/*      link;                                                                 */
/*    - on a media error it asks the host ONCE for fresh links, and plays the */
/*      new src when it arrives; only if that fails does it show its          */
/*      existing "unavailable" state;                                         */
/*    - the host refreshes on its own when the tab comes back after more      */
/*      than 5 h since its links were read.                                   */
/*                                                                            */
/*  Without a provider a player behaves as before: an error is final.         */
/* -------------------------------------------------------------------------- */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Links are signed for 6 h; refresh on return after 5 h. */
export const MEDIA_STALE_MS = 5 * 60 * 60 * 1000;
/** A refresh that never settles must not leave a player waiting forever. */
const REFRESH_TIMEOUT_MS = 20_000;

/** The link without its signature: what stays the same across re-signing. */
export function mediaKey(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

const LINK = /^(https?:)?\/\//i;

/** Every absolute link in a payload. Bounded depth: payloads are plain
 *  JSON-shaped data, never cyclic, but a bound costs nothing. */
export function collectMediaLinks(
  value: unknown,
  out: Set<string> = new Set(),
  depth = 0,
): Set<string> {
  if (depth > 12 || value === null || value === undefined) return out;
  if (typeof value === "string") {
    if (LINK.test(value)) out.add(value);
    return out;
  }
  if (typeof value !== "object") return out;
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const child of children) collectMediaLinks(child, out, depth + 1);
  return out;
}

/** The newest link per key. A payload can hold an old and a new signature of
 *  one file at once (a row kept on screen while a refetch lands, many moments
 *  cut from one Take's file), so "newest" is the link first seen last, as
 *  recorded in `seen` across reads. */
export function freshestByKey(
  links: Iterable<string>,
  seen: Map<string, number>,
): Map<string, string> {
  const out = new Map<string, string>();
  const order = new Map<string, number>();
  for (const url of links) {
    let at = seen.get(url);
    if (at === undefined) {
      at = seen.size;
      seen.set(url, at);
    }
    const key = mediaKey(url);
    if ((order.get(key) ?? -1) < at) {
      order.set(key, at);
      out.set(key, url);
    }
  }
  return out;
}

interface MediaRefreshValue {
  /** Ask the host for fresh links; shared while one is in flight. */
  refresh: () => Promise<void>;
  /** The freshest link the host holds for `src` (or `src` itself). */
  fresh: (src: string) => string;
}

const MediaRefreshContext = createContext<MediaRefreshValue | null>(null);

export function MediaRefreshProvider({
  refresh,
  payload,
  children,
}: {
  /** Read the payload the links came from again. */
  refresh: () => Promise<unknown> | void;
  /** The payload as held now; its links are what players play. */
  payload: unknown;
  children: ReactNode;
}) {
  const seen = useRef(new Map<string, number>());
  const links = useMemo(() => freshestByKey(collectMediaLinks(payload), seen.current), [payload]);
  // What the links ARE, not the payload's identity: a host may rebuild its
  // payload object on every render, and only new links are a new read.
  const signature = useMemo(() => [...links.values()].sort().join("\n"), [links]);
  const linksRef = useRef(links);
  linksRef.current = links;
  const fetchedAt = useRef(Date.now());
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const inflight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    fetchedAt.current = Date.now();
  }, [signature]);

  const refreshOnce = useCallback((): Promise<void> => {
    if (inflight.current) return inflight.current;
    fetchedAt.current = Date.now();
    const run = Promise.race([
      Promise.resolve()
        .then(() => refreshRef.current())
        .then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
    ])
      .catch(() => undefined)
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = run;
    return run;
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAt.current > MEDIA_STALE_MS) void refreshOnce();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshOnce]);

  const value = useMemo<MediaRefreshValue>(
    () => ({
      refresh: refreshOnce,
      fresh: (src) => linksRef.current.get(mediaKey(src)) ?? src,
    }),
    // A new signature is what must re-render the players; the ref holds
    // its links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, refreshOnce],
  );
  return <MediaRefreshContext.Provider value={value}>{children}</MediaRefreshContext.Provider>;
}

/** The host's side: a nonce to put in the fetch effect's dependencies, a
 *  `refresh` for the provider that bumps it, and `settle` to call when that
 *  fetch has landed (or failed). */
export function useMediaRefresher(): {
  nonce: number;
  refresh: () => Promise<void>;
  settle: () => void;
} {
  const [nonce, setNonce] = useState(0);
  const waiters = useRef<Array<() => void>>([]);
  const refresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiters.current.push(resolve);
        setNonce((n) => n + 1);
      }),
    [],
  );
  const settle = useCallback(() => {
    const done = waiters.current;
    waiters.current = [];
    for (const resolve of done) resolve();
  }, []);
  return { nonce, refresh, settle };
}

type Failure = { src: string; dead: boolean };

/** The player's side. `errored` is true only once a fresh link was asked
 *  for and the src still did not play (or there is no host to ask). */
export function useRecoverableSrc(
  raw: string | null | undefined,
  onError?: () => void,
): {
  src: string | null;
  errored: boolean;
  recovering: boolean;
  handleError: () => void;
  handleLoaded: () => void;
} {
  const host = useContext(MediaRefreshContext);
  const src = raw ? (host ? host.fresh(raw) : raw) : null;
  const [failure, setFailure] = useState<Failure | null>(null);
  const retried = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const handleError = useCallback(() => {
    onErrorRef.current?.();
    if (!src) return;
    if (!host || retried.current) {
      setFailure({ src, dead: true });
      return;
    }
    retried.current = true;
    setFailure({ src, dead: false });
    const failed = src;
    void host.refresh().then(() => {
      // Keyed by src: when the fresh link arrived, this marks only the dead
      // one, and the player is already on the new src.
      setFailure((f) => (f && f.src === failed ? { src: failed, dead: true } : f));
    });
  }, [host, src]);

  // A src that loads earns its own one refresh later (links expire again).
  const handleLoaded = useCallback(() => {
    retried.current = false;
  }, []);

  const mine = failure !== null && failure.src === src;
  return {
    src,
    errored: mine && failure.dead,
    recovering: mine && !failure.dead,
    handleError,
    handleLoaded,
  };
}
