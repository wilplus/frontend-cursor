"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminGate from "@/components/admin/AdminGate";
import TakesExplorer from "./TakesExplorer";
import ExerciseEffects from "./ExerciseEffects";
import { planLabel } from "@/components/tokens/copy";

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
  kind: "whatsapp" | "home_screen" | "consent" | "promo" | "lesson";
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
  promotion: { plan: string; price_cents: number; list_cents: number; ends_at: string } | null;
  practice: { offered: number; done: number } | null;
  deletion: { request_id: string; state: string; completes_after: string | null; cancellable: boolean } | null;
}

const WAIT_DAYS = 30;
const ASK_STATUS: Record<Ask["status"], string> = {
  waiting: "Waiting for them to open the chat",
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
  const [tellLesson, setTellLesson] = useState(false);

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
    setNote(res?.ok ? "Sent. They see it the next time they open the chat." : body.error || "Could not send. Try again.");
    if (res?.ok) void load();
  };

  const savePrice = async () => {
    const res = await fetch("/api/v2/admin/booking/user-price", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id, price_cents: price.trim() === "" ? null : Math.round(Number(price) * 100) }),
    }).catch(() => null);
    setNote(res?.ok ? "Lesson price saved." : "Could not save the lesson price. Try again.");
    const cents = Math.round(Number(price) * 100);
    const normal = p?.list_price_cents ?? null;
    if (res?.ok && tellLesson && price.trim() !== "" && normal !== null && cents < normal) void sendAsk("lesson");
  };



  const askLabel = (a: Ask) =>
    a.kind === "whatsapp" ? "Phone number" : a.kind === "home_screen" ? "Add to home screen"
      : a.kind === "promo" ? "Price on the pricing screen" : a.kind === "lesson" ? "Lesson price"
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
    <main className="mx-auto grid max-w-5xl gap-7 px-5 pb-12 pt-8">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground">← Users</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{p.name || p.email || "Unnamed account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {p.email} · joined {day(p.created_at) || "—"} · last sign-in {day(p.last_sign_in_at) || "never"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {[["Tokens to spend", n(p.tokens?.balance)], ["Monthly (resets)", n(p.tokens?.monthly)],
          ["Bonus (kept)", n(p.tokens?.bonus)], ["Plan", p.tokens?.tier || "—"]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border px-3.5 py-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="text-xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
        <PracticeTile practice={p.practice} />
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
            <label className="grid gap-1.5 text-[13px] font-medium sm:col-span-2" htmlFor="pp-tell">
              Tell them about the lesson price
              <select id="pp-tell" className={field} value={tellLesson ? "yes" : "no"} onChange={(e) => setTellLesson(e.target.value === "yes")}>
                <option value="no">No, they see it on the pricing screen and booking page</option>
                <option value="yes">Yes, also in the chat</option>
              </select>
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

      <PromotionSection id={id} promotion={p.promotion} sendAsk={sendAsk} reload={load} />

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
              <span>{askLabel(a)} · <span className="text-muted-foreground">{a.status === "opened" && a.kind !== "consent" ? "Opened it" : ASK_STATUS[a.status]}</span></span>
            </div>
          )) : <p className="py-3 text-sm text-muted-foreground">Nothing sent yet.</p>}
        </div>
      </section>

      <ExerciseEffects id={id} />

      <TakesExplorer id={id} />

      <DeleteSection id={id} email={p.email} deletion={p.deletion} reload={load} />
    </main>
  );
}

/** Confident Voice practice progress (founder 2026-10-18): completed
 *  practices out of those offered. Admin eyes only; a speaker never sees it. */
function PracticeTile({ practice }: { practice: Person["practice"] }) {
  const offered = practice?.offered ?? 0;
  const done = practice?.done ?? 0;
  const pct = offered > 0 ? Math.round((done / offered) * 100) : null;
  return (
    <div className="rounded-xl border border-border px-3.5 py-3">
      <div className="text-xs text-muted-foreground">Confident Voice practice</div>
      <div className="text-xl font-semibold tabular-nums">{pct === null ? "—" : `${pct}%`}</div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label="Confident Voice practice done">
        <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {offered > 0 ? `${done} of ${offered} done` : "No practice offered yet"}
      </div>
    </div>
  );
}

const H2 = "mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground";
const BOX = "rounded-2xl border border-border px-4";
const FIELD = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:border-foreground";

/** Step 3: a plan price for this person on their pricing screen. */
function PromotionSection({ id, promotion, sendAsk, reload }: {
  id: string;
  promotion: Person["promotion"];
  sendAsk: (kind: Ask["kind"]) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [plans, setPlans] = useState<[string, number][]>([]);
  const [promo, setPromo] = useState({ plan: "coaching", price: "", until: "", tell: true });
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v2/tokens/prices", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { tiers?: Record<string, { usd_per_month: number }> } | null) => {
        const paid = Object.entries(b?.tiers || {}).filter(([, t]) => t.usd_per_month > 0)
          .map(([k, t]) => [k, t.usd_per_month] as [string, number]).sort((a, c) => a[1] - c[1]);
        setPlans(paid);
      })
      .catch(() => undefined);
  }, []);

  const savePromo = async () => {
    const res = await fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/promotion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: promo.plan, price_cents: Math.round(Number(promo.price) * 100), ends_on: promo.until }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setNote(body.error || "Could not save the promotion. Try again.");
    setNote("Promotion is on their pricing screen.");
    if (promo.tell) await sendAsk("promo");
    else void reload();
  };

  const endPromo = async () => {
    const res = await fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/promotion`, { method: "DELETE" }).catch(() => null);
    setNote(res?.ok ? "Promotion ended." : "Could not end the promotion. Try again.");
    if (res?.ok) void reload();
  };

  return (
      <section>
        <h2 className={H2}>Promotion on their pricing screen</h2>
        <div className={`${BOX} grid gap-3 py-4`}>
          {promotion && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Live now: {planLabel(promotion.plan)}{" "}
                <s className="text-muted-foreground">${promotion.list_cents / 100}</s> <b>${promotion.price_cents / 100}</b>{" "}
                <span className="text-muted-foreground">until {day(promotion.ends_at)}</span>
              </span>
              <button type="button" onClick={() => void endPromo()} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium">End</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="pr-plan">
              Plan
              <select id="pr-plan" className={FIELD} value={promo.plan} onChange={(e) => setPromo({ ...promo, plan: e.target.value })}>
                {plans.map(([k, usd]) => <option key={k} value={k}>{planLabel(k)} · ${usd}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="pr-price">
              Their price
              <input id="pr-price" type="number" min="1" className={FIELD} value={promo.price} onChange={(e) => setPromo({ ...promo, price: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="pr-until">
              Until
              <input id="pr-until" type="date" className={FIELD} value={promo.until} onChange={(e) => setPromo({ ...promo, until: e.target.value })} />
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium" htmlFor="pr-tell">
              Also tell them in the app
              <select id="pr-tell" className={FIELD} value={promo.tell ? "yes" : "no"} onChange={(e) => setPromo({ ...promo, tell: e.target.value === "yes" })}>
                <option value="yes">Yes, in the chat</option>
                <option value="no">No, only on the pricing screen</option>
              </select>
            </label>
          </div>
          <div>
            <button type="button" onClick={() => void savePromo()} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">
              {promotion ? "Replace promotion" : "Start promotion"}
            </button>
          </div>
          {note && <p className="text-sm">{note}</p>}
        </div>
      </section>
  );
}

/** At the bottom: delete this account. Same road as the person's own
 *  "Delete my account": stopped now, deleted after seven days, cancellable
 *  until then. */
function DeleteSection({ id, email, deletion, reload }: {
  id: string;
  email: string | null;
  deletion: Person["deletion"];
  reload: () => Promise<void>;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const post = async (path: string) => {
    setBusy(true);
    const res = await fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/${path}`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setNote(body.error || "Could not do that. Try again.");
    // No data agreement yet: only the login existed, and it is gone now.
    if (body.deletion?.kind === "login_only") return window.location.assign("/admin/users");
    setNote(null);
    void reload();
  };

  const remove = () => {
    if (!window.confirm(`Delete ${email || "this user"}? Their account stops now and all their data is deleted after 7 days. You can cancel until then.`)) return;
    void post("delete");
  };

  return (
    <section>
      <h2 className={H2}>Delete user</h2>
      <div className={`${BOX} grid gap-3 py-4`}>
        {deletion && deletion.state !== "cancelled" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              Deletion requested
              {deletion.completes_after ? `, data deleted after ${new Date(deletion.completes_after).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.
            </span>
            {deletion.cancellable && (
              <button type="button" disabled={busy} onClick={() => void post(`delete/${encodeURIComponent(deletion.request_id)}/cancel`)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium">Cancel deletion</button>
            )}
          </div>
        ) : (
          <div>
            <button type="button" disabled={busy} onClick={remove}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60">
              Delete user
            </button>
          </div>
        )}
        {note && <p className="text-sm text-destructive">{note}</p>}
      </div>
    </section>
  );
}
