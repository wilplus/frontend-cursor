"use client";

import { useState } from "react";

/* -------------------------------------------------------------------------- */
/*  /admin/credits — internal credits testing tool (FE-6)                      */
/*                                                                            */
/*  NOT linked in nav. A password-gated form to look up and set a student's    */
/*  credit balance during testing. The password is checked on the BE (it       */
/*  rides in the request body, so this plain browser form can drive it); this   */
/*  page just posts to the two internal BFF proxies and shows what comes back.  */
/*  Deliberately bare — a functional tool, not a designed surface.             */
/* -------------------------------------------------------------------------- */

type Balance = { userId: string; credits: number };

/** The BE resolves the user by email or id; decide which by the "@" sign so a
 *  single field can accept either. */
function targetBody(target: string): Record<string, string> {
  const t = target.trim();
  return t.includes("@") ? { email: t } : { user_id: t };
}

function readBalance(data: unknown): Balance | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.credits !== "number") return null;
  return {
    userId: typeof d.user_id === "string" ? d.user_id : String(d.user_id ?? ""),
    credits: d.credits,
  };
}

function readError(data: unknown, status: number): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (typeof d.error === "string") return d.error;
  if (status === 401) return "Wrong password.";
  if (status === 503) return "Admin password is not configured on the server.";
  return `Request failed (HTTP ${status}).`;
}

export default function CreditsAdminPage() {
  const [password, setPassword] = useState("");
  const [target, setTarget] = useState("");
  const [credits, setCredits] = useState("");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"lookup" | "set" | null>(null);

  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function lookup() {
    if (!password || !target.trim() || busy) return;
    setBusy("lookup");
    setError(null);
    setMessage(null);
    try {
      const { ok, status, data } = await post(
        "/api/v2/internal/student-credits/lookup",
        { password, ...targetBody(target) }
      );
      if (ok) {
        setBalance(readBalance(data));
        setMessage("Current balance loaded.");
      } else {
        setBalance(null);
        setError(readError(data, status));
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function setCreditsBalance() {
    const n = Number(credits);
    if (!password || !target.trim() || credits.trim() === "" || Number.isNaN(n) || busy) {
      return;
    }
    setBusy("set");
    setError(null);
    setMessage(null);
    try {
      const { ok, status, data } = await post(
        "/api/v2/internal/student-credits/set",
        { password, ...targetBody(target), credits: n }
      );
      if (ok) {
        setBalance(readBalance(data));
        setMessage(`Credits set to ${n}.`);
      } else {
        setError(readError(data, status));
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const inputCls =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[15px] text-neutral-900 outline-none focus:border-neutral-500";
  const labelCls = "mb-1 block text-[13px] font-medium text-neutral-700";

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-[20px] font-semibold text-neutral-900">Credits admin</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Internal testing tool. Look up or set a student&apos;s credit balance.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className={labelCls} htmlFor="pw">
            Admin password
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="target">
            User email or ID
          </label>
          <input
            id="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="jane@example.com or a user id"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="credits">
            Credits
          </label>
          <input
            id="credits"
            type="number"
            inputMode="numeric"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="e.g. 25"
            className={inputCls}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={lookup}
            disabled={!password || !target.trim() || busy !== null}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-4 py-2 text-[14px] font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            {busy === "lookup" ? "Looking up…" : "Look up"}
          </button>
          <button
            type="button"
            onClick={setCreditsBalance}
            disabled={
              !password || !target.trim() || credits.trim() === "" || busy !== null
            }
            className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-[14px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
          >
            {busy === "set" ? "Saving…" : "Set credits"}
          </button>
        </div>
      </div>

      {balance ? (
        <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-[13px] text-neutral-500">Balance</p>
          <p className="mt-0.5 text-[28px] font-semibold tabular-nums text-neutral-900">
            {balance.credits}
          </p>
          <p className="mt-1 break-all text-[12px] text-neutral-500">
            user_id: {balance.userId || "(unknown)"}
          </p>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 text-[13px] text-green-700">{message}</p>
      ) : null}
      {error ? <p className="mt-4 text-[13px] text-red-600">{error}</p> : null}
    </main>
  );
}
