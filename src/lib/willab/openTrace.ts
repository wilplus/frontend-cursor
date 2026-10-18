/* -------------------------------------------------------------------------- */
/*  WHERE A BUBBLE'S OPEN SPENDS ITS TIME (founder 2026-10-18: "clicking the   */
/*  bubbles has a major lag in loading but it is not visible in the network   */
/*  logs").                                                                   */
/*                                                                            */
/*  It is in the network log, just not after the click: a press starts the    */
/*  Ideal Text's reads (`warmIdealTextOpen`) before the tap lands, and the    */
/*  walk then waits on the slow `document_layers` lane those reads started.   */
/*  Nothing new is asked after the tap, so nothing new shows.                 */
/*                                                                            */
/*  This writes ONE console line per open, from the press to the first walk   */
/*  step on screen (or the text, when there is nothing to walk), with every   */
/*  /api/v2 read that started since the press, its time and its               */
/*  Server-Timing. The same stretch is a `willab.open` measure in the         */
/*  Performance panel. Console only: nothing reaches the screen.              */
/* -------------------------------------------------------------------------- */

import { WALK_STEP_SELECTOR } from "./lensScreen";

/** An open nobody ends (the overlay closed first, a step never came) is
 *  reported as still waiting after this long. */
export const OPEN_TRACE_CAP_MS = 20_000;

/** The Ideal Text page, and the lens screen that covers it while the walk
 *  loads (both drawn by IdealTextOverlay). */
const IDEAL_TEXT_PAGE_SELECTOR = "[data-ideal-text-wheel-owner]";
const LENS_SCREEN_SELECTOR = "[data-lens-screen]";

/** A press this much older than its tap belongs to another tap. */
const PRESS_FRESH_MS = 2_000;

interface Trace {
  what: string;
  pressAt: number | null;
  tapAt: number;
  stages: { name: string; at: number }[];
  observer: MutationObserver | null;
  cap: ReturnType<typeof setTimeout> | null;
}

let lastPressAt: number | null = null;
let current: Trace | null = null;

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

function mark(name: string): void {
  try {
    performance.mark(`willab.open.${name}`);
  } catch {
    // An old browser: the console line still has it.
  }
}

/** A finger went down on something that opens the Ideal Text. */
export function pressOpenTrace(): void {
  lastPressAt = now();
  mark("press");
}

/** The tap landed: an Ideal Text open of kind `what` starts now. */
export function startOpenTrace(what: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  stop();
  const tapAt = now();
  const pressAt = lastPressAt !== null && tapAt - lastPressAt < PRESS_FRESH_MS ? lastPressAt : null;
  lastPressAt = null;
  mark("tap");
  const trace: Trace = { what, pressAt, tapAt, stages: [], observer: null, cap: null };
  current = trace;
  if (typeof MutationObserver !== "undefined" && document.body) {
    let pageSeen = false;
    trace.observer = new MutationObserver(() => {
      const page = document.querySelector(IDEAL_TEXT_PAGE_SELECTOR) !== null;
      pageSeen ||= page;
      if (document.querySelector(WALK_STEP_SELECTOR)) endOpenTrace("step on screen");
      else if (pageSeen && !page) endOpenTrace("closed");
      // The text is in and no lens screen covers it: the text is what shows.
      else if (page && trace.stages.some((s) => s.name === "text") && !document.querySelector(LENS_SCREEN_SELECTOR)) {
        endOpenTrace("text");
      }
    });
    trace.observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  trace.cap = setTimeout(() => endOpenTrace("still waiting"), OPEN_TRACE_CAP_MS);
}

/** A stage of the open in progress ("text", "feedback"): first time only. */
export function markOpenTrace(name: string): void {
  const trace = current;
  if (!trace || trace.stages.some((s) => s.name === name)) return;
  trace.stages.push({ name, at: now() });
  mark(name);
}

/** The open is over: `how` is what the speaker now sees. */
export function endOpenTrace(how: string): void {
  const trace = current;
  if (!trace) return;
  stop();
  const endAt = now();
  const from = trace.pressAt ?? trace.tapAt;
  mark("end");
  try {
    performance.measure("willab.open", { start: from, end: endAt });
  } catch {
    // An old browser: the console line still has it.
  }
  const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
  const lines = [
    `[open] ${trace.what} → ${how} in ${secs(endAt - trace.tapAt)} after the tap` +
      (trace.pressAt !== null ? ` (press ${secs(trace.tapAt - trace.pressAt)} before it)` : ""),
  ];
  if (trace.stages.length > 0) {
    lines.push(`  ${trace.stages.map((s) => `${s.name} ${secs(s.at - trace.tapAt)}`).join(" · ")}`);
  }
  const reads = readsSince(from - 50, endAt);
  lines.push(reads.length > 0 ? "  reads since the press:" : "  no /api/v2 read finished since the press");
  lines.push(...reads.map((r) => `    ${r}`));
  console.info(lines.join("\n"));
}

function stop(): void {
  const trace = current;
  current = null;
  if (!trace) return;
  trace.observer?.disconnect();
  if (trace.cap !== null) clearTimeout(trace.cap);
}

/** Every finished /api/v2 read that started in [from, to]: its path (ids
 *  out), when it started relative to `from`, how long, and Server-Timing. */
function readsSince(from: number, to: number): string[] {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") return [];
  return (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
    .filter((e) => e.name.includes("/api/v2/") && e.startTime >= from && e.startTime <= to)
    .map((e) => {
      const server = (e.serverTiming ?? []).map((t) => `${t.name} ${Math.round(t.duration)}`).join(", ");
      return (
        `${shortPath(e.name)}  ${Math.round(e.duration)} ms` +
        ` (started +${Math.round(e.startTime - from)} ms)` +
        (server ? `  [${server}]` : "")
      );
    });
}

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname
      .replace(/^\/api\/v2\//, "")
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, "/:id");
    return path + decodeURIComponent(u.search);
  } catch {
    return url;
  }
}
