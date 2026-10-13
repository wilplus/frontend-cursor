"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminGate from "@/components/admin/AdminGate";

/* -------------------------------------------------------------------------- */
/*  /admin/users/<id> — one person's profile (founder 2026-10-13, step 1).     */
/*  Who they are, where they are from, what they agreed to and how many times  */
/*  they said no, their tokens and their lesson price. Asking for missing      */
/*  answers in the app comes in step 2.                                        */
/* -------------------------------------------------------------------------- */

interface Consent {
  key: string;
  label: string;
  state: "yes" | "no" | "missing";
  at: string | null;
  no_count: number;
  last_no_at: string | null;
}

interface Ask {
  id: string;
  kind: "whatsapp" | "home_screen" | "consent";
  consent_key: string | null;
  status: "waiting" | "shown" | "opened" | "answered";
  created_at: string;
}

interface Person {
  user_id: string;
  email: string | null;
  name: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  country: string | null;
  locale: string | null;
  native_language: string | null;
  domain: string | null;
  goal: string | null;
  phone: string | null;
  home_screen_at: string | null;
  consents: Consent[];
  tokens: { balance: number; monthly: number; bonus: number; tier: string | null } | null;
  lesson_price_cents: number | null;
  list_price_cents: number | null;
  asks: Ask[];
}

const WAIT_DAYS = 30;
const ASK_STATUS: Record<Ask["status"], string> = {
  waiting: "Waiting for their next take",
  shown: "Seen, not answered yet",
  opened: "Opened the consent page",
  answered: "Answered",
};

const day = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
const n = (v: number | undefined | null) => (typeof v === "number" ? v.toLocaleString("en-US") : "—");

function country(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

export default function PersonPage({ params }: { params: { id: string } }) {
  return (
    <AdminGate>
      <PersonProfile id={params.id} />
    </AdminGate>
  );
}

function PersonProfile({ id }: { id: string }) {
  const [p, setP] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState("100000");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/admin/people/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error || `Could not load this person (${res.status}).`);
      setP(body as Person);
      setPrice(typeof body.lesson_price_cents === "number" ? String(body.lesson_price_cents / 100) : "");
    } catch {
      setError("Could not reach the server.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = async () => {
    const amount = Number.parseInt(tokens, 10);
    if (!Number.isFinite(amount) || amount === 0) return setNote("Enter a non-zero number of tokens.");
    const res = await fetch("/api/v2/admin/tokens/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id, tokens: amount, ref_id: `admin:${id}:${amount}:${Date.now()}` }),
    }).catch(() => null);
    setNote(res?.ok ? `Added ${amount.toLocaleString("en-US")} tokens.` : "Could not add the tokens. Try again.");
    if (res?.ok) void load();
  };

  const openAsk = (kind: Ask["kind"], key: string | null = null) =>
    p?.asks.some((a) => a.kind === kind && a.consent_key === key && (a.status === "waiting" || a.status === "shown"));

  const sendAsk = async (kind: Ask["kind"], key: string | null = null) => {
    const res = await fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/asks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, consent_key: key }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setNote(res?.ok ? "Sent. They see it after their next take." : body.error || "Could not send. Try again.");
    if (res?.ok) void load();
  };

  const savePrice = async () => {
    const res = await fetch("/api/v2/admin/booking/user-price", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id, price_cents: price.trim() === "" ? null : Math.round(Number(price) * 100) }),
    }).catch(() => null);
    setNote(res?.ok ? "Lesson price saved." : "Could not save the lesson price. Try again.");
  };

  const askLabel = (a: Ask) =>
    a.kind === "whatsapp" ? "Phone number" : a.kind === "home_screen" ? "Add to home screen"
      : `Consent: ${p?.consents.find((c) => c.key === a.consent_key)?.label || a.consent_key}`;

  if (error) return <main className="mx-auto max-w-3xl px-5 py-10 text-sm text-destructive">{error}</main>;
  if (!p) return <main className="mx-auto max-w-3xl px-5 py-10 text-sm text-muted-foreground">Loading…</main>;

  const list = p.list_price_cents;
  const row = "grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3 border-b border-border py-2.5 text-sm last:border-b-0";
  const box = "rounded-2xl border border-border px-4";
  const h2 = "mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground";
  const field = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:border-foreground";
  const missing = <span className="rounded-full border border-border px-2 py-0.5 text-xs text-[hsl(var(--pending))]">Missing</span>;
  const askBtn = (kind: Ask["kind"], key: string | null = null, label = "Ask in app") =>
    openAsk(kind, key) ? (
      <span className="text-xs text-muted-foreground">Asked</span>
    ) : (
      <button type="button" onClick={() => void sendAsk(kind, key)}
        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium">{label}</button>
    );
  const row3 = "grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2.5 text-sm last:border-b-0";

  return (
    <main className="mx-auto grid max-w-3xl gap-7 px-5 pb-12 pt-8">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground">← Users</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{p.name || p.email || "Unnamed account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {p.email} · joined {day(p.created_at) || "—"} · last sign-in {day(p.last_sign_in_at) || "never"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Tokens to spend", n(p.tokens?.balance)], ["Monthly (resets)", n(p.tokens?.monthly)],
          ["Bonus (kept)", n(p.tokens?.bonus)], ["Plan", p.tokens?.tier || "—"]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border px-3.5 py-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="text-xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className={h2}>Tokens and prices</h2>
        <div className={`${box} grid gap-3 py-4`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="pp-tokens">
              Add tokens
              <input id="pp-tokens" type="number" className={field} value={tokens} onChange={(e) => setTokens(e.target.value)} />
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="pp-price">
              Lesson price{list !== null ? ` (normal ${list / 100})` : ""}
              <input id="pp-price" type="number" min="0" className={field} value={price} placeholder={list !== null ? String(list / 100) : ""}
                onChange={(e) => setPrice(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void grant()} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">Add tokens</button>
            <button type="button" onClick={() => void savePrice()} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Save lesson price</button>
            <a className="text-xs text-muted-foreground underline" target="_blank" rel="noreferrer"
              href={`https://www.willpowerlab.com/book/artur?as=${encodeURIComponent(p.user_id)}`}>See their booking page</a>
          </div>
          {note && <p className="text-sm">{note}</p>}
        </div>
      </section>

      <section>
        <h2 className={h2}>What we know</h2>
        <div className={box}>
          <div className={row}><span className="text-muted-foreground">Country</span><span>{country(p.country) || missing}</span></div>
          <div className={row}><span className="text-muted-foreground">App language</span><span>{p.locale || missing}</span></div>
          <div className={row}><span className="text-muted-foreground">Native language</span><span>{p.native_language || missing}</span></div>
          <div className={row}><span className="text-muted-foreground">Speaks about</span><span>{p.domain || missing}</span></div>
          <div className={row}><span className="text-muted-foreground">Goal</span><span>{p.goal || missing}</span></div>
          <div className={row3}>
            <span className="text-muted-foreground">Phone (WhatsApp)</span><span>{p.phone || missing}</span>
            {p.phone ? <span /> : askBtn("whatsapp")}
          </div>
          <div className={row3}>
            <span className="text-muted-foreground">On home screen</span>
            <span>{p.home_screen_at ? `Yes, since ${day(p.home_screen_at)}` : <span className="text-muted-foreground">Not seen yet</span>}</span>
            {p.home_screen_at ? <span /> : askBtn("home_screen")}
          </div>
        </div>
      </section>

      <section>
        <h2 className={h2}>Consents</h2>
        <div className={box}>
          {p.consents.map((c) => {
            const again = c.last_no_at ? new Date(new Date(c.last_no_at).getTime() + WAIT_DAYS * 86400000) : null;
            const tooSoon = c.state === "no" && again !== null && again > new Date();
            return (
            <div key={c.key} className={row3}>
              <span className="text-muted-foreground">{c.label}</span>
              <span className="flex flex-wrap items-center gap-2">
                {c.state === "yes" ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-[hsl(var(--success))]">Yes</span>
                ) : c.state === "no" ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-destructive">Said no</span>
                ) : missing}
                {c.no_count > 0 && <span className="text-xs text-muted-foreground">said no {c.no_count} {c.no_count === 1 ? "time" : "times"}</span>}
                {c.at && <span className="text-xs text-muted-foreground">{day(c.at)}</span>}
              </span>
              {c.state === "yes" ? <span /> : tooSoon ? (
                <span className="text-xs text-muted-foreground">Ask again {day(again!.toISOString())}</span>
              ) : askBtn("consent", c.key, c.state === "no" ? "Ask again" : "Ask in app")}
            </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A consent ask opens their Data &amp; consent page, where they answer. After a no, the same consent can be asked again after {WAIT_DAYS} days.
        </p>
      </section>

      <section>
        <h2 className={h2}>Asks sent</h2>
        <div className={box}>
          {p.asks.length ? p.asks.map((a) => (
            <div key={a.id} className={row}>
              <span className="text-muted-foreground">{day(a.created_at)}</span>
              <span>{askLabel(a)} · <span className="text-muted-foreground">{ASK_STATUS[a.status]}</span></span>
            </div>
          )) : <p className="py-3 text-sm text-muted-foreground">Nothing sent yet.</p>}
        </div>
      </section>
    </main>
  );
}
