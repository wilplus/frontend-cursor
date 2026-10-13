/* -------------------------------------------------------------------------- */
/*  Booking page time helpers. Every time arrives from the backend as UTC;     */
/*  these turn it into the viewer's wall clock and back, with Intl only.       */
/* -------------------------------------------------------------------------- */

export interface WallParts {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

export function parts(ts: number, tz: string): WallParts {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    partsFormatters.set(tz, f);
  }
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ts))) {
    if (p.type !== "literal") o[p.type] = Number(p.value);
  }
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute };
}

function offset(ts: number, tz: string): number {
  const p = parts(ts, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ts / 60000) * 60000;
}

/** Wall time in `tz` -> UTC ms. Day/hour overflow is normalised by Date.UTC. */
export function zoned(y: number, m: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offset(guess, tz);
  const second = offset(t, tz);
  if (guess - second !== t) t = guess - second;
  return t;
}

export function dayKey(ts: number, tz: string): string {
  const p = parts(ts, tz);
  return `${p.y}-${p.m}-${p.d}`;
}

export const fmtTime = (ts: number, tz: string, h12: boolean) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: h12 }).format(ts);

export const fmtDay = (ts: number, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(ts);

export const fmtShortDay = (ts: number, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(ts);

export const city = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");

export function gmtLabel(tz: string, at = Date.now()): string {
  const o = offset(at, tz) / 60000;
  const a = Math.abs(o);
  return `GMT${o < 0 ? "-" : "+"}${Math.floor(a / 60)}${a % 60 ? ":" + String(a % 60).padStart(2, "0") : ""}`;
}

export function detectedZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function allZones(extra: string[]): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    zones = ["America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Warsaw", "Asia/Tokyo", "UTC"];
  }
  for (const z of extra) if (z && !zones.includes(z)) zones.push(z);
  return zones;
}

export function prefers12h(): boolean {
  try {
    return !/^(pl|de|fr|en-GB)/.test(navigator.language || "en-US");
  } catch {
    return true;
  }
}

export function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}
