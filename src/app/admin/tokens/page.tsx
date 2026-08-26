"use client";

import { useCallback, useEffect, useState } from "react";
import AdminGate from "@/components/admin/AdminGate";

/* -------------------------------------------------------------------------- */
/*  /admin/tokens — top up one account, for an operator. Founder 2026-08-12.   */
/*                                                                            */
/*  NOT linked in nav; a bare internal tool, same posture as /admin/pipeline   */
/*  and /admin/learning. The gate is SERVER-SIDE: the BFF forwards the         */
/*  Supabase JWT and the backend enforces @require_admin, so a non-admin sees  */
/*  the 403 and nothing else. No password field, and no secret in the bundle — */
/*  this replaces the /v2/internal/student-credits/* pair, which took a shared */
/*  CREDIT_ADMIN_PASSWORD in the request body.                                */
/*                                                                            */
/*  IT GRANTS TO `bonus_balance`, AND THE PANEL SAYS SO. The monthly roll SETS */
/*  `token_balance`, so a grant there silently expires at the user's next      */
/*  period. The breakdown is rendered rather than a single total precisely so  */
/*  the operator can see which half moved.                                    */
/*                                                                            */
/*  AC-9: a token balance is commerce, not a read on a speaker. No quality     */
/*  signal appears here, and nothing on this page renders on a student surface.*/
/* -------------------------------------------------------------------------- */

interface Account {
  user_id: string;
  available: boolean;
  balance?: number;
  monthly_balance?: number;
  bonus_balance?: number;
  tier?: string;
  period_ends_at?: string | null;
  pricing_enabled?: boolean;
}

/** Presets, because the realistic operator action is "give this test account
 *  enough to stop thinking about it" and typing six zeros is how you type
 *  seven. */
const PRESETS = [100_000, 1_000_000];

function n(v: number | undefined): string {
  return typeof v === "number" ? v.toLocaleString("en-US") : "—";
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function AdminTokensPage() {
  // THE PAGE IS PUBLICLY ROUTABLE; the panel is not. AdminGate renders
  // nothing until the backend confirms the caller, so an unauthorised
  // visitor never sees the form — see the component for why that is about
  // exposure rather than authorization.
  return (
    <AdminGate>
      <TokenTopUpPanel />
    </AdminGate>
  );
}

function TokenTopUpPanel() {
  const [email, setEmail] = useState("");
  const [tokens, setTokens] = useState<string>("1000000");
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const lookupEmail = useCallback(async (value: string) => {
    const target = value.trim();
    if (!target) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(
        `/api/v2/admin/tokens/lookup?email=${encodeURIComponent(target)}`,
        { cache: "no-store" }
      );
      const body = await readJson(res);
      if (!res.ok) {
        setAccount(null);
        setError(
          (body.error as string) ??
            (res.status === 403
              ? "Not an admin account."
              : `Lookup failed (${res.status}).`)
        );
        return;
      }
      setAccount(body as unknown as Account);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }, []);

  const lookup = useCallback(() => lookupEmail(email), [email, lookupEmail]);

  useEffect(() => {
    const target = new URLSearchParams(window.location.search)
      .get("email")
      ?.trim();
    if (!target) return;
    setEmail(target);
    void lookupEmail(target);
  }, [lookupEmail]);

  const grant = useCallback(async () => {
    const target = email.trim();
    const amount = Number.parseInt(tokens, 10);
    if (!target || !Number.isFinite(amount) || amount === 0) {
      setError("Enter an email and a non-zero amount.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/v2/admin/tokens/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: target,
          tokens: amount,
          // THE IDEMPOTENCY KEY, minted per submitted form. A double-tap, a
          // retried fetch or a refreshed tab reuses it and the backend
          // returns the account unchanged instead of granting twice.
          ref_id: `admin:${target}:${amount}:${Date.now()}`,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) {
        setError(
          (body.error as string) ??
            (res.status === 403
              ? "Not an admin account."
              : `Grant failed (${res.status}).`)
        );
        return;
      }
      setAccount(body as unknown as Account);
      setNote(
        `${amount > 0 ? "Added" : "Removed"} ${Math.abs(
          amount
        ).toLocaleString("en-US")} tokens.`
      );
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }, [email, tokens]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Token top-up</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Grants land in the non-expiring bonus balance. The monthly allowance
        resets on its own and is never touched here.
      </p>

      <div className="mt-6 space-y-3">
        <label className="block text-sm font-medium" htmlFor="admin-email">
          Account email
        </label>
        <div className="flex gap-2">
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAccount(null);
              setNote(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void lookup();
            }}
            placeholder="name@example.com"
            className="flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={busy || !email.trim()}
            className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Look up
          </button>
        </div>
      </div>

      {account ? (
        <section className="mt-6 rounded-xl border border-foreground/12 p-4">
          {account.available ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-foreground/60">Spendable now</dt>
                <dd className="text-right font-medium tabular-nums">
                  {n(account.balance)}
                </dd>
                <dt className="text-foreground/60">Monthly (expires)</dt>
                <dd className="text-right tabular-nums">
                  {n(account.monthly_balance)}
                </dd>
                <dt className="text-foreground/60">Bonus (never expires)</dt>
                <dd className="text-right tabular-nums">
                  {n(account.bonus_balance)}
                </dd>
                <dt className="text-foreground/60">Tier</dt>
                <dd className="text-right">{account.tier ?? "—"}</dd>
              </dl>
              {account.pricing_enabled === false ? (
                // Without this the operator tops up an account on the dark
                // flag, sees nothing change in the app, and concludes the
                // grant failed. The grant IS real; nothing is reading it yet.
                <p className="mt-3 rounded-lg bg-pending/[0.18] px-3 py-2 text-xs">
                  Token pricing is switched off on this backend
                  (TOKEN_PRICING_ENABLED). Grants are stored and will apply the
                  moment it is switched on — nothing meters against them yet.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-foreground/70">
              Account row unreadable. It may not be initialised yet — the app
              seeds it on first touch.
            </p>
          )}
        </section>
      ) : null}

      <div className="mt-6 space-y-3">
        <label className="block text-sm font-medium" htmlFor="admin-tokens">
          Tokens to add
        </label>
        <div className="flex gap-2">
          <input
            id="admin-tokens"
            type="number"
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            className="flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm tabular-nums outline-none focus:border-foreground/40"
          />
          <button
            type="button"
            onClick={() => void grant()}
            disabled={busy || !email.trim()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            {busy ? "Working…" : "Grant"}
          </button>
        </div>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setTokens(String(p))}
              className="rounded-full border border-foreground/15 px-3 py-1 text-xs tabular-nums"
            >
              {p.toLocaleString("en-US")}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-foreground/50">
            Negative corrects a mistake.
          </span>
        </div>
      </div>

      {note ? (
        <p className="mt-4 rounded-lg bg-success/[0.14] px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-destructive/[0.12] px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
    </main>
  );
}
