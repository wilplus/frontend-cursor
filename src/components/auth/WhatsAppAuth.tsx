'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { claimGuestProjects } from "@/services/api/projects";
import { fetchWhatsAppPhone, normalizePhone, saveWhatsAppPhone } from "@/services/api/whatsapp";
import { WHATSAPP_COPY } from "@/components/willab/WillabWhatsAppPrompt";
import { sameSitePath } from "@/lib/auth/sameSitePath";

/* -------------------------------------------------------------------------- */
/*  WhatsAppAuth — sign up and sign in with WhatsApp (founder 2026-10-27,      */
/*  backend N214).                                                            */
/*                                                                            */
/*  The number, then the code Supabase makes and checks (its Send SMS hook    */
/*  hands it to our backend, which sends it on WhatsApp with Meta's           */
/*  Authentication template; no Twilio), then, for a new account, the name.   */
/*  Signing up saves the number as the account's WhatsApp number, so the      */
/*  WhatsApp ask after Take 1 never comes. Signing in never makes a new       */
/*  account (N214 item 5). On for everyone (founder 2026-10-28, "go", once    */
/*  Meta approved login_code); NEXT_PUBLIC_WHATSAPP_SIGNIN=false hides it.    */
/* -------------------------------------------------------------------------- */

export const WHATSAPP_SIGNIN = process.env.NEXT_PUBLIC_WHATSAPP_SIGNIN !== "false";

/** The words, signed (backend N214). No em-dashes (house style). */
export const WHATSAPP_AUTH_COPY = {
  signUp: "Sign up with WhatsApp",
  signIn: "Sign in with WhatsApp",
  numberLabel: "Your WhatsApp number",
  sendCode: "Send code",
  codeTitle: "Enter the code we sent you on WhatsApp",
  resend: "Resend code",
  otherNumber: "Use a different number",
  wrongCode: "That code didn't work. Try again.",
  nameTitle: "What should we call you?",
  continue: "Continue",
  noAccount: "No account signs in with this number. Sign in another way, or ",
  noAccountLink: "sign up with WhatsApp",
} as const;

/** Supabase asks for a pause between two codes to one number. */
const RESEND_AFTER_MS = 60_000;

type Step = "number" | "code" | "name";

function decodedOnce(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Supabase's answer when signing in may not make an account. */
function isNoAccount(error: { code?: string; message?: string }): boolean {
  return error.code === "otp_disabled" || /signups? not allowed/i.test(error.message ?? "");
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

export default function WhatsAppAuth({
  mode,
  onBack,
  onSuccess,
  legal,
}: {
  mode: "signup" | "login";
  onBack: () => void;
  onSuccess?: () => void;
  /** The terms line under the number (the sign-up page's). */
  legal?: React.ReactNode;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<Step>("number");
  const [raw, setRaw] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<"invalid" | "wrong" | "noAccount" | null>(null);
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const resendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resendTimer.current) clearTimeout(resendTimer.current);
  }, []);

  const failed = () => toast.error(mode === "signup"
    ? "Registration failed. Please try again."
    : "Sign-in failed. Please try again.");

  const sendCode = async (to: string): Promise<boolean> => {
    const { error: sendError } = await supabase.auth.signInWithOtp({
      phone: to,
      options: { shouldCreateUser: mode === "signup" },
    });
    if (sendError) {
      if (mode === "login" && isNoAccount(sendError)) setError("noAccount");
      else failed();
      return false;
    }
    setCanResend(false);
    if (resendTimer.current) clearTimeout(resendTimer.current);
    resendTimer.current = setTimeout(() => setCanResend(true), RESEND_AFTER_MS);
    return true;
  };

  const submitNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = normalizePhone(raw);
    if (!to) {
      setError("invalid");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await sendCode(to)) {
        setPhone(to);
        setCode("");
        setStep("code");
      }
    } finally {
      setBusy(false);
    }
  };

  /** Session on the server, the guest's Take claimed, then where they were
   *  going (as the email form and the login form do). */
  const land = async () => {
    await claimGuestProjects().catch(() => false);
    try {
      await fetch("/api/auth/confirm-session", { method: "POST", credentials: "include" });
    } catch {
      /* the middleware refreshes the cookies on the next page anyway */
    }
    await new Promise((r) => setTimeout(r, 200));
    if (onSuccess) {
      onSuccess();
      return;
    }
    const back = sameSitePath(decodedOnce(new URLSearchParams(window.location.search).get("redirectTo")));
    if (back) {
      window.location.replace(back);
      return;
    }
    try {
      const res = await fetch("/api/results/state", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { kind: string; session_id?: string };
        if ((data.kind === "completed" || data.kind === "processing") && data.session_id) {
          window.location.replace(`/chat?session=${encodeURIComponent(data.session_id)}`);
          return;
        }
      }
    } catch {
      /* non-fatal: /chat resolves the rest */
    }
    window.location.replace("/chat");
  };

  /** A new WhatsApp account's number is its WhatsApp number too; signing in
   *  never touches it (a number removed in Settings stays removed). */
  const keepNumber = async () => {
    if (mode !== "signup") return;
    const saved = await fetchWhatsAppPhone();
    if (saved === null) await saveWhatsAppPhone(phone);
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      if (verifyError || !data.session) {
        setError("wrong");
        return;
      }
      await keepNumber();
      const meta = (data.user?.user_metadata ?? {}) as { name?: unknown; full_name?: unknown };
      if (mode === "signup" && !meta.name && !meta.full_name) {
        setStep("name");
        return;
      }
      await land();
    } finally {
      setBusy(false);
    }
  };

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault();
    const given = name.trim();
    if (!given) return;
    setBusy(true);
    try {
      const { error: nameError } = await supabase.auth.updateUser({ data: { name: given, display_name: given } });
      if (nameError) {
        failed();
        return;
      }
      // The backend reads the name from the token: take a fresh one.
      await supabase.auth.refreshSession();
      await land();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!canResend || busy) return;
    setBusy(true);
    try {
      await sendCode(phone);
    } finally {
      setBusy(false);
    }
  };

  const otherNumber = () => {
    setStep("number");
    setCode("");
    setError(null);
  };

  if (step === "name") {
    return (
      <form onSubmit={submitName} className="space-y-4">
        <label htmlFor="wa-name" className="block text-base font-semibold">
          {WHATSAPP_AUTH_COPY.nameTitle}
        </label>
        <Input id="wa-name" type="text" autoComplete="name" placeholder="Your name" value={name}
          onChange={(e) => setName(e.target.value)} required disabled={busy} />
        <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
          {WHATSAPP_AUTH_COPY.continue}
        </Button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <div>
          <label htmlFor="wa-code" className="block text-base font-semibold">
            {WHATSAPP_AUTH_COPY.codeTitle}
          </label>
          <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
        </div>
        <Input id="wa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          placeholder="••••••" value={code} disabled={busy}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          className="h-14 text-center text-2xl tracking-[0.4em]" />
        {error === "wrong" ? (
          <p role="alert" className="text-sm text-destructive">{WHATSAPP_AUTH_COPY.wrongCode}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
          {WHATSAPP_AUTH_COPY.continue}
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={() => void resend()} disabled={!canResend || busy}
            className="min-h-[44px] text-muted-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline">
            {WHATSAPP_AUTH_COPY.resend}
          </button>
          <button type="button" onClick={otherNumber}
            className="min-h-[44px] text-muted-foreground hover:underline">
            {WHATSAPP_AUTH_COPY.otherNumber}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitNumber} className="space-y-4">
      <button type="button" onClick={onBack}
        className="min-h-[44px] text-sm text-muted-foreground hover:underline">
        ← Back
      </button>
      <div>
        <label htmlFor="wa-phone" className="mb-2 block text-sm font-medium">
          {WHATSAPP_AUTH_COPY.numberLabel}
        </label>
        <Input id="wa-phone" type="tel" inputMode="tel" autoComplete="tel"
          placeholder={WHATSAPP_COPY.placeholder} value={raw} disabled={busy}
          aria-invalid={error === "invalid" ? true : undefined}
          onChange={(e) => {
            setRaw(e.target.value);
            if (error) setError(null);
          }} />
        {error === "invalid" ? (
          <p role="alert" className="mt-2 text-sm text-destructive">{WHATSAPP_COPY.invalid}</p>
        ) : null}
        {error === "noAccount" ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {WHATSAPP_AUTH_COPY.noAccount}
            <Link href="/signup?way=whatsapp" className="font-medium text-primary hover:underline">
              {WHATSAPP_AUTH_COPY.noAccountLink}
            </Link>
            .
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {WHATSAPP_AUTH_COPY.sendCode}
      </Button>
      {legal}
    </form>
  );
}
