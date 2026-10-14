"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Logo from "@/components/Logo";
import { bookingUrl, clearBookingReturn, readBookingReturn, saveBookingReturn } from "@/lib/booking/returnTo";
import {
  allZones, city, dayKey, detectedZone, fmtDay, fmtShortDay, fmtTime, gmtLabel, money, parts,
  prefers12h, zoned,
} from "@/lib/booking/time";

/* -------------------------------------------------------------------------- */
/*  /book/<slug> — the public booking page (founder 2026-10-13, v1).           */
/*  Pick a day and a time in your own time zone, give a name and an email,     */
/*  pay on Stripe. Built from the approved prototype.                          */
/* -------------------------------------------------------------------------- */

export interface PageInfo {
  slug: string;
  title: string;
  host_name: string;
  duration_min: number;
  price_cents: number;
  currency: string;
  horizon_days: number;
  host_timezone: string;
  new_user_price_cents?: number;
}

/** What the signed-in person pays and gets (GET .../offer). */
export interface Offer {
  list_price_cents: number;
  price_cents: number;
  currency: string;
  preview: boolean;
  email?: string;
  name?: string;
}

const ERRORS: Record<string, string> = {
  SLOT_TAKEN: "That time was just taken. Pick another.",
  NAME_REQUIRED: "Add your name.",
  EMAIL_INVALID: "Check the email address. It should look like name@example.com.",
  PAYMENTS_OFF: "Payments aren't set up yet. Try again later.",
  RATE_LIMITED: "Too many tries. Wait a few minutes and try again.",
};

/* Stripe's card form inside the page. Without the publishable key on Vercel the
 * page falls back to Stripe's own checkout page, so payment never breaks. */
const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Meta({ info, tz, offer, children }: { info: PageInfo; tz: string; offer?: Offer | null; children?: React.ReactNode }) {
  const row = "flex items-center gap-2.5";
  // Signed out: show the first-time price (most visitors are new).
  const price = offer ? offer.price_cents : info.new_user_price_cents ?? info.price_cents;
  const list = offer ? offer.list_price_cents : info.price_cents;
  return (
    <div className="min-w-0 p-5 md:p-7">
      <a href="/" className="no-underline" aria-label="WillpowerLab home"><Logo /></a>
      <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-muted text-[10px] text-foreground">AW</span>
        with {info.host_name}
      </div>
      <h1 className="my-4 text-2xl font-semibold tracking-tight [text-wrap:balance]">{info.title}</h1>
      <div className="grid gap-2 text-sm text-muted-foreground">
        <div className={row}><Icon d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />{info.duration_min} min</div>
        <div className={row}><Icon d="M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3" />Google Meet</div>
        <div className={row}><Icon d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18" /><span className="flex items-baseline gap-2">
          {price < list && <s>{money(list, info.currency)}</s>}
          <span className={price < list ? "font-semibold text-foreground" : ""}>{money(price, info.currency)}</span>
        </span></div>
        <div className={row}><Icon d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />{city(tz)}</div>
      </div>
      {children}
    </div>
  );
}

const ICONS = {
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  video: "M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3",
  card: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18",
  globe: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
};

/** The summary on a phone (founder 2026-10-14, option B; the calendar step
 *  too): logo and an action on one row, the chosen time in a grey box, the
 *  details in a grid, so each step fits one screen. A computer keeps Meta. */
function PhoneSummary({ info, tz, offer, when, action }: {
  info: PageInfo; tz: string; offer: Offer | null; when?: [string, string]; action?: React.ReactNode;
}) {
  const price = offer ? offer.price_cents : info.new_user_price_cents ?? info.price_cents;
  const list = offer ? offer.list_price_cents : info.price_cents;
  const row = "flex items-center gap-1.5";
  return (
    <div className="grid gap-3.5 pb-4 md:hidden">
      <div className="flex items-center justify-between">
        <a href="/" className="no-underline" aria-label="WillpowerLab home"><Logo /></a>
        {action}
      </div>
      <div className="grid gap-1">
        <h1 className="text-[22px] font-bold tracking-tight [text-wrap:balance]">{info.title}</h1>
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-muted text-[8px] text-foreground">AW</span>
          with {info.host_name}
        </div>
      </div>
      {when && (
        <div className="grid gap-0.5 rounded-xl bg-muted px-3.5 py-3 text-[15px]">
          <strong className="font-semibold">{when[0]}</strong>
          <span>{when[1]}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
        <div className={row}><Icon d={ICONS.clock} />{info.duration_min} min</div>
        <div className={row}><Icon d={ICONS.video} />Google Meet</div>
        <div className={row}><Icon d={ICONS.globe} />{city(tz)}</div>
        <div className={row}><Icon d={ICONS.card} />
          {price < list && <s>{money(list, info.currency)}</s>}
          <span className={price < list ? "font-semibold text-foreground" : ""}>{money(price, info.currency)}</span>
        </div>
      </div>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function BookingPage({ info }: { info: PageInfo }) {
  const [tz, setTz] = useState("UTC");
  const [h12, setH12] = useState(true);
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [slots, setSlots] = useState<number[] | null>(null);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", note: "" });
  // null = still asking; "signed-out" = no account session.
  const [offer, setOffer] = useState<Offer | "signed-out" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const timesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const z = detectedZone();
    setTz(z);
    setH12(prefers12h());
    const p = parts(Date.now(), z);
    setMonth({ y: p.y, m: p.m });
    const as = new URLSearchParams(window.location.search).get("as");
    fetch(`/api/v2/booking/${info.slug}/offer${as ? `?as=${encodeURIComponent(as)}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return setOffer("signed-out");
        const o = (await r.json()) as Offer;
        setOffer(o);
        setForm((f) => ({ ...f, name: f.name || o.name || "" }));
        // Back from sign-in / sign-up: open the time they had chosen.
        const saved = readBookingReturn();
        clearBookingReturn();
        const chosen = Date.parse(new URLSearchParams(window.location.search).get("slot") || "")
          || (saved?.slug === info.slug ? saved.slot : null);
        if (chosen && chosen > Date.now()) setSlot(chosen);
      })
      .catch(() => setOffer("signed-out"));
  }, [info.slug]);

  const signedIn = offer !== null && offer !== "signed-out" ? offer : null;
  const signUpFor = (chosen: number | null) => {
    saveBookingReturn(info.slug, chosen);
    window.location.href = `/signup?redirectTo=${encodeURIComponent(bookingUrl({ slug: info.slug, slot: chosen }))}`;
  };

  // One request per visible month, from its first to its last midnight in
  // the viewer's zone.
  useEffect(() => {
    if (!month) return;
    const from = zoned(month.y, month.m, 1, 0, 0, tz);
    const to = zoned(month.y, month.m + 1, 1, 0, 0, tz);
    let live = true;
    setSlots(null);
    fetch(`/api/v2/booking/${info.slug}/slots?from=${new Date(from).toISOString()}&to=${new Date(to).toISOString()}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((b: { slots?: string[] }) => live && setSlots((b.slots || []).map((s) => Date.parse(s))))
      .catch(() => live && setSlots([]));
    return () => {
      live = false;
    };
  }, [month, tz, info.slug]);

  const byDay = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of slots || []) {
      const k = dayKey(s, tz);
      map.set(k, [...(map.get(k) || []), s]);
    }
    return map;
  }, [slots, tz]);

  // Open the first day that has times, so the page never starts empty.
  useEffect(() => {
    if (!slots) return;
    if (selDay && byDay.has(selDay)) return;
    setSelDay(slots.length ? dayKey(slots[0], tz) : null);
  }, [slots, byDay, selDay, tz]);

  const zones = useMemo(() => allZones([tz, info.host_timezone]), [tz, info.host_timezone]);

  const submit = useCallback(
    async (e: FormEvent, skipPayment = false) => {
      e.preventDefault();
      if (slot === null) return;
      const name = form.name.trim();
      if (!name) return setError(ERRORS.NAME_REQUIRED);
      setSending(true);
      setError(null);
      try {
        const res = await fetch(`/api/v2/booking/${info.slug}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start: new Date(slot).toISOString(), name, note: form.note, timezone: tz,
            embedded: !!stripePromise && !skipPayment, skip_payment: skipPayment,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { url?: string; client_secret?: string; code?: string };
        if (res.ok && body.client_secret) {
          setClientSecret(body.client_secret);
          setSending(false);
          return;
        }
        if (res.ok && body.url) {
          window.location.href = body.url;
          return;
        }
        setError(ERRORS[body.code || ""] || "Something went wrong. Try again.");
        if (body.code === "SLOT_TAKEN") {
          setSlot(null);
          setMonth((m) => (m ? { ...m } : m));
        }
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
      setSending(false);
    },
    [slot, form, tz, info.slug]
  );

  if (!month) return null;

  if (slot !== null) {
    const end = slot + info.duration_min * 60000;
    const field = "w-full min-w-0 rounded-[10px] border border-border bg-background px-3 py-2.5 focus:border-foreground focus:outline-none";
    const back = () => { setSlot(null); setError(null); setClientSecret(null); };
    return (
      <Shell preview={!!signedIn?.preview}>
        <div className="grid md:grid-cols-[260px_1fr] md:rounded-[14px] md:border md:border-border">
          <PhoneSummary info={info} tz={tz} offer={signedIn}
            action={<button className="text-sm text-muted-foreground" onClick={back}>← Back</button>}
            when={[fmtDay(slot, tz), `${fmtTime(slot, tz, h12)} – ${fmtTime(end, tz, h12)}`]} />
          <div className="hidden md:block">
            <Meta info={info} tz={tz} offer={signedIn}>
              <div className="mt-4 border-t border-border pt-4 text-sm">
                <strong className="block font-semibold">{fmtDay(slot, tz)}</strong>
                {fmtTime(slot, tz, h12)} – {fmtTime(end, tz, h12)}
              </div>
            </Meta>
          </div>
          <div className="min-w-0 border-t border-border pt-4 md:border-l md:border-t-0 md:p-7">
            <button className="mb-3.5 hidden text-sm text-muted-foreground md:block" onClick={back}>
              ← Back
            </button>
            {clientSecret && stripePromise ? (
              <div className="min-w-0">
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            ) : (
            <form className="grid gap-3 md:max-w-[460px] md:gap-4" onSubmit={submit} noValidate>
              <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="bk-name">
                Your name
                <input id="bk-name" className={field} autoComplete="name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              {signedIn?.email && (
                <div className="grid gap-1.5 text-[13px] font-medium">
                  Email
                  <span className="py-1 font-normal text-muted-foreground">{signedIn.email}</span>
                </div>
              )}
              <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="bk-note">
                <span>Anything {info.host_name.split(" ")[0]} should know? <span className="text-muted-foreground">(optional)</span></span>
                <textarea id="bk-note" className={`${field} h-16 md:h-auto md:min-h-[84px]`} value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
              {error && <p className="text-[13px] text-destructive">{error}</p>}
              <div className="grid gap-2">
                <button type="submit" disabled={sending || !!signedIn?.preview}
                  className="min-h-[50px] w-full rounded-xl border border-foreground bg-foreground px-[18px] py-3 font-semibold text-background disabled:opacity-60">
                  {sending ? "Opening payment…" : `Book and pay ${money(signedIn?.price_cents ?? info.price_cents, info.currency)}`}
                </button>
                <button type="button" disabled={sending || !!signedIn?.preview} onClick={(e) => void submit(e, true)}
                  className="min-h-[50px] w-full rounded-xl border border-foreground bg-background px-[18px] py-3 font-semibold text-foreground disabled:opacity-60">
                  Book &amp; pay after the lesson
                </button>
              </div>
              <p className="text-[13px] text-muted-foreground">
                You&apos;ll get a calendar invite with the Google Meet link by email.
              </p>
            </form>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  const { y, m } = month;
  const today = parts(Date.now(), tz);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = parts(Date.now() + info.horizon_days * 86400000, tz);
  const atStart = y === today.y && m === today.m;
  const atEnd = y > last.y || (y === last.y && m >= last.m);
  const dayTimes = selDay ? byDay.get(selDay) || [] : [];
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(Date.UTC(y, m - 1, 1));
  const signIn = (size: string) => offer === "signed-out" && (
    <a href={`/signup?redirectTo=${encodeURIComponent(`/book/${info.slug}`)}`}
      onClick={(e) => { e.preventDefault(); signUpFor(null); }} className={`inline-block rounded-[10px] bg-foreground font-semibold text-background no-underline ${size}`}>
      Sign in to book
    </a>
  );
  const iconBtn = "grid h-8 w-8 md:h-[34px] md:w-[34px] place-items-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <Shell preview={!!signedIn?.preview}>
      <div className="grid md:grid-cols-[260px_1fr_240px] md:rounded-[14px] md:border md:border-border">
        <PhoneSummary info={info} tz={tz} offer={signedIn} action={signIn("px-3 py-2 text-[13px]")} />
        <div className="hidden md:block">
          <Meta info={info} tz={tz} offer={signedIn}>{signIn("mt-5 px-4 py-2.5 text-sm")}</Meta>
        </div>
        <div className="min-w-0 border-t border-border py-4 md:border-l md:border-t-0 md:p-7">
          <div className="mb-1.5 flex items-center justify-between md:mb-3">
            <b className="font-semibold">{monthName}</b>
            <div className="flex gap-1">
              <button className={iconBtn} disabled={atStart} aria-label="Previous month"
                onClick={() => setMonth(m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })}>
                <Chevron d="m15 6-6 6 6 6" />
              </button>
              <button className={iconBtn} disabled={atEnd} aria-label="Next month"
                onClick={() => setMonth(m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })}>
                <Chevron d="m9 6 6 6-6 6" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d) => (
              <span key={d} className="py-0.5 text-[10px] md:py-1 md:text-[11px] uppercase tracking-wider text-muted-foreground">{d}</span>
            ))}
            {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const d = i + 1;
              const key = `${y}-${m}-${d}`;
              const open = byDay.has(key);
              const sel = key === selDay;
              const isToday = y === today.y && m === today.m && d === today.d;
              return (
                <button key={key} disabled={!open} aria-label={`${d}${open ? ", times available" : ""}`}
                  onClick={() => {
                    setSelDay(key);
                    if (window.innerWidth < 768) timesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`relative h-[38px] rounded-[10px] md:aspect-square md:h-auto tabular-nums transition-colors ${
                    sel ? "bg-foreground font-semibold text-background"
                      : open ? "bg-muted font-semibold text-foreground hover:outline hover:outline-1 hover:outline-foreground"
                        : "text-muted-foreground"
                  }`}>
                  {d}
                  {isToday && <span className="absolute bottom-1 left-1/2 md:bottom-1.5 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground md:mt-[18px]">
            <label htmlFor="bk-tz">Time zone</label>
            <select id="bk-tz" value={tz} onChange={(e) => { setTz(e.target.value); setSelDay(null); }}
              className="min-w-0 max-w-full flex-[1_1_200px] rounded-lg border border-border bg-background px-2 py-1.5 md:py-[7px]">
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")} ({gmtLabel(z)})</option>)}
            </select>
          </div>
        </div>
        <div ref={timesRef} className="min-w-0 border-t border-border py-4 md:border-l md:border-t-0 md:p-7">
          <div className="mb-2 md:mb-3 flex items-center justify-between gap-2">
            <b className="font-semibold">{dayTimes.length ? fmtShortDay(dayTimes[0], tz) : "Pick a day"}</b>
            <div className="inline-flex rounded-lg border border-border text-xs" role="group" aria-label="Clock format">
              {[true, false].map((v) => (
                <button key={String(v)} aria-pressed={h12 === v} onClick={() => setH12(v)}
                  className={`rounded-[7px] px-2 py-[3px] ${h12 === v ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
                  {v ? "12h" : "24h"}
                </button>
              ))}
            </div>
          </div>
          {slots === null ? (
            <p className="text-sm text-muted-foreground">Loading times…</p>
          ) : dayTimes.length ? (
            <div className="grid max-h-[420px] grid-cols-4 gap-1.5 overflow-auto md:grid-cols-1 md:gap-2">
              {dayTimes.map((s) => (
                <button key={s} onClick={() => {
                    if (offer === "signed-out") {
                      signUpFor(s);
                      return;
                    }
                    setSlot(s);
                    window.scrollTo(0, 0);
                  }}
                  className="h-11 rounded-[10px] border border-border bg-background px-1 font-medium md:h-auto md:px-2 md:py-[11px] tabular-nums hover:border-foreground">
                  {fmtTime(s, tz, h12)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open times this month.</p>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Chevron({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Shell({ children, preview }: { children: React.ReactNode; preview?: boolean }) {
  return (
    <main className="mx-auto max-w-[1020px] px-4 pb-12 pt-5 md:pt-10">
      {preview && (
        <p className="mb-3 rounded-[10px] bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          Preview: this is the page and price this person sees. Booking is off in preview.
        </p>
      )}
      {children}
    </main>
  );
}
