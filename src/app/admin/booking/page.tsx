"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminGate from "@/components/admin/AdminGate";
import { allZones, city, fmtShortDay, fmtTime, gmtLabel, money } from "@/lib/booking/time";

/* -------------------------------------------------------------------------- */
/*  /admin/booking — the booking page's settings and upcoming bookings         */
/*  (founder 2026-10-13, v1). Bookings show in the host's time zone, with the  */
/*  guest's own time underneath.                                               */
/* -------------------------------------------------------------------------- */

interface Settings {
  slug: string;
  title: string;
  host_name: string;
  duration_min: number;
  price_cents: number;
  currency: string;
  buffer_before_min: number;
  buffer_after_min: number;
  notice_hours: number;
  horizon_days: number;
  timezone: string;
  weekly_hours: Record<string, [string, string][]>;
  calendar_ics_url: string;
  meet_url: string;
  enabled: boolean;
  bonus_tokens: number;
  new_user_discount_pct: number;
}

interface Booking {
  id: string;
  start_at: string;
  end_at: string;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  note: string;
  price_cents: number;
  list_price_cents: number | null;
  currency: string;
  bonus_tokens: number;
  tokens_granted_at: string | null;
}

const DAYS: [string, string][] = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];
const field = "w-full min-w-0 rounded-[10px] border border-border bg-background px-3 py-2.5 focus:border-foreground focus:outline-none";
const label = "grid gap-1.5 text-[13px] font-medium";

export default function AdminBookingPage() {
  return (
    <AdminGate>
      <BookingAdmin />
    </AdminGate>
  );
}

function BookingAdmin() {
  const [s, setS] = useState<Settings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/v2/admin/booking", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { settings?: Settings; bookings?: Booking[]; error?: string }) => {
        if (!b.settings) return setMsg({ ok: false, text: b.error || "Could not load the settings." });
        setS(b.settings);
        setPrice(String(b.settings.price_cents / 100));
        setBookings(b.bookings || []);
      })
      .catch(() => setMsg({ ok: false, text: "Could not reach the server." }));
  }, []);

  if (!s) return <main className="mx-auto max-w-[720px] px-4 py-10 text-sm text-muted-foreground">{msg?.text || "Loading…"}</main>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const setDay = (d: string, v: [string, string][] | null) => {
    const hours = { ...s.weekly_hours };
    if (v) hours[d] = v;
    else delete hours[d];
    set("weekly_hours", hours);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v2/admin/booking/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...s, price_cents: Math.round(Number(price) * 100) }),
      });
      const b = (await res.json().catch(() => ({}))) as { settings?: Settings; error?: string };
      if (res.ok && b.settings) {
        setS(b.settings);
        setMsg({ ok: true, text: "Saved" });
      } else {
        setMsg({ ok: false, text: b.error || "Could not save. Try again." });
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server." });
    }
    setSaving(false);
  };

  const numSelect = (k: keyof Settings, opts: number[], unit: string, text: string) => (
    <label className={label} htmlFor={`bk-${k}`}>
      {text}
      <select id={`bk-${k}`} className={field} value={s[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)}>
        {opts.map((o) => <option key={o} value={o}>{o} {unit}</option>)}
      </select>
    </label>
  );
  const box = "grid gap-3.5 rounded-xl border border-border p-4";
  const h3 = "text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground";
  const pageUrl = `willpowerlab.com/book/${s.slug}`;

  return (
    <main className="mx-auto grid max-w-[720px] gap-7 px-4 pb-12 pt-8">
      <div>
        <h1 className="font-heading text-2xl">Bookings</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Times in your time zone, {city(s.timezone)}.</p>
      </div>
      <div className="rounded-xl border border-border px-4 py-1">
        {bookings.length ? bookings.map((b) => {
          const st = Date.parse(b.start_at), en = Date.parse(b.end_at);
          return (
            <div key={b.id} className="grid gap-0.5 border-b border-border py-3 text-sm last:border-b-0">
              <span className="font-semibold">{fmtShortDay(st, s.timezone)} · {fmtTime(st, s.timezone, true)} – {fmtTime(en, s.timezone, true)}</span>
              <span>{b.guest_name} · {b.guest_email}</span>
              <span className="text-[13px] text-muted-foreground">
                {fmtTime(st, b.guest_timezone, true)} their time ({city(b.guest_timezone)}) · paid {money(b.price_cents, b.currency)}
                {b.list_price_cents && b.price_cents < b.list_price_cents ? ` (list ${money(b.list_price_cents, b.currency)})` : ""}
                {b.bonus_tokens ? ` · ${b.bonus_tokens.toLocaleString("en-US")} tokens${b.tokens_granted_at ? " added" : " pending"}` : ""}
              </span>
              {b.note && <span className="text-[13px] text-muted-foreground">“{b.note}”</span>}
            </div>
          );
        }) : <p className="py-3 text-sm text-muted-foreground">No upcoming bookings.</p>}
      </div>

      <form className="grid gap-7" onSubmit={save} noValidate>
        <section className="grid gap-3.5">
          <h2 className={h3}>Booking page</h2>
          <div className={box}>
            <label className="flex items-center gap-2 font-medium" htmlFor="bk-enabled">
              <input id="bk-enabled" type="checkbox" checked={s.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              Page is on
            </label>
            <p className="-mt-2 text-[13px] text-muted-foreground">
              {s.enabled ? <>Live at <a className="underline" href={`https://www.willpowerlab.com/book/${s.slug}`} target="_blank" rel="noreferrer">{pageUrl}</a></> : "Nobody can book while the page is off."}
            </p>
            <label className={label} htmlFor="bk-slug">
              Link
              <div className="flex overflow-hidden rounded-[10px] border border-border">
                <span className="whitespace-nowrap py-2.5 pl-3 text-muted-foreground">willpowerlab.com/book/</span>
                <input id="bk-slug" className="min-w-0 flex-1 bg-background py-2.5 pl-0.5 pr-3 focus:outline-none" value={s.slug}
                  onChange={(e) => set("slug", e.target.value.toLowerCase())} />
              </div>
            </label>
            <label className={label} htmlFor="bk-title">
              Meeting name
              <input id="bk-title" className={field} value={s.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {numSelect("duration_min", [30, 45, 60, 90], "min", "Length")}
              <label className={label} htmlFor="bk-newpct">
                First lesson off for new people (%)
                <input id="bk-newpct" className={field} type="number" min="0" max="100" step="5" value={s.new_user_discount_pct ?? 0}
                  onChange={(e) => set("new_user_discount_pct", Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              </label>
              <label className={label} htmlFor="bk-bonus">
                Tokens with each lesson
                <input id="bk-bonus" className={field} type="number" min="0" step="1000" value={s.bonus_tokens}
                  onChange={(e) => set("bonus_tokens", Math.max(0, Number(e.target.value) || 0))} />
              </label>
              <label className={label} htmlFor="bk-price">
                Price
                <div className="flex gap-2.5">
                  <input id="bk-price" className={field} type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
                  <select className={`${field} w-24`} aria-label="Currency" value={s.currency} onChange={(e) => set("currency", e.target.value)}>
                    {["usd", "eur", "pln", "gbp"].map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>
              </label>
            </div>
          </div>
        </section>

        <section className="grid gap-3.5">
          <h2 className={h3}>When people can book</h2>
          <div className={box}>
            <label className={label} htmlFor="bk-tz">
              Your time zone
              <select id="bk-tz" className={field} value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {allZones([s.timezone]).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")} ({gmtLabel(z)})</option>)}
              </select>
            </label>
            <div className="grid gap-2">
              {DAYS.map(([d, name]) => {
                const h = s.weekly_hours[d]?.[0];
                return (
                  <div key={d} className="grid grid-cols-[70px_1fr] items-center gap-2.5 text-sm">
                    <label className="flex items-center gap-2 font-medium" htmlFor={`bk-on${d}`}>
                      <input id={`bk-on${d}`} type="checkbox" checked={!!h} onChange={(e) => setDay(d, e.target.checked ? [["09:00", "17:00"]] : null)} />
                      {name}
                    </label>
                    {h ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <input type="time" aria-label={`${name} from`} className="rounded-[10px] border border-border bg-background px-2 py-[7px]" value={h[0]}
                          onChange={(e) => setDay(d, [[e.target.value, h[1]]])} />
                        –
                        <input type="time" aria-label={`${name} until`} className="rounded-[10px] border border-border bg-background px-2 py-[7px]" value={h[1]}
                          onChange={(e) => setDay(d, [[h[0], e.target.value]])} />
                      </div>
                    ) : <span className="text-muted-foreground">Unavailable</span>}
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {numSelect("buffer_before_min", [0, 5, 10, 15, 30, 60], "min", "Buffer before")}
              {numSelect("buffer_after_min", [0, 5, 10, 15, 30, 60], "min", "Buffer after")}
              {numSelect("notice_hours", [1, 2, 4, 12, 24, 48], "hours", "Minimum notice")}
              {numSelect("horizon_days", [7, 14, 30, 60], "days ahead", "Book up to")}
            </div>
          </div>
        </section>

        <section className="grid gap-3.5">
          <h2 className={h3}>Calendar and meeting</h2>
          <div className={box}>
            <label className={label} htmlFor="bk-ics">
              Calendar share links (one per line)
              <textarea id="bk-ics" rows={3} className={field} value={s.calendar_ics_url}
                onChange={(e) => set("calendar_ics_url", e.target.value)} />
            </label>
            <p className="-mt-2 text-[13px] text-muted-foreground">
              Busy times from every calendar listed block the booking page. In Proton: Calendar settings → Share →
              Share with anyone → Full view. Each booking is also sent to you as an invite you add with one click.
            </p>
            <label className={label} htmlFor="bk-meet">
              Google Meet link
              <input id="bk-meet" className={field} value={s.meet_url} onChange={(e) => set("meet_url", e.target.value)} />
            </label>
            <p className="-mt-2 text-[13px] text-muted-foreground">
              The same link goes into every invite. Make one at meet.google.com → New meeting → Create a meeting for later.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-[10px] bg-foreground px-[18px] py-3 font-semibold text-background disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-muted-foreground" : "text-destructive"}`}>{msg.text}</span>}
        </div>
      </form>
    </main>
  );
}
