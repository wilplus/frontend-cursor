'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { claimGuestProjects } from "@/services/api/projects";
import { fetchWhatsAppPhone, saveWhatsAppPhone } from "@/services/api/whatsapp";
import PhoneNumberField from "@/components/phone/PhoneNumberField";
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
  // Under the name (backend N232).
  nameWhy: "Will and your coach use it.",
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

/** The WhatsApp logo, solid: the bubble in the text colour with the handset
 *  cut out in the button's orange (backend N232: white on the button). */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12 1.6A10.4 10.4 0 0 0 3.05 17.3L1.6 22.4l5.25-1.38A10.4 10.4 0 1 0 12 1.6z" />
      <path fill="hsl(var(--primary))" d="M8.6 6.7c-.25-.55-.5-.56-.74-.57h-.63c-.22 0-.57.08-.87.41-.3.33-1.14 1.11-1.14 2.71s1.17 3.15 1.33 3.36c.16.22 2.26 3.6 5.57 4.9 2.75 1.09 3.31.87 3.9.82.6-.05 1.93-.79 2.2-1.55.27-.76.27-1.41.19-1.55-.08-.13-.3-.22-.63-.38-.33-.16-1.93-.95-2.23-1.06-.3-.11-.52-.16-.74.17-.22.33-.85 1.06-1.04 1.28-.19.22-.38.25-.71.08-.33-.16-1.38-.51-2.63-1.62-.97-.87-1.63-1.94-1.82-2.27-.19-.33-.02-.5.14-.67.15-.15.33-.38.49-.57.16-.19.22-.33.33-.55.11-.22.05-.41-.03-.57-.08-.17-.72-1.78-1-2.42z" />
    </svg>
  );
}

export default function WhatsAppAuth({
  mode,
  onBack,
  onSuccess,
  legal,
  first = false,
  after,
}: {
  mode: "signup" | "login";
  onBack?: () => void;
  onSuccess?: () => void;
  /** The terms line under the number (the sign-up page's). */
  legal?: React.ReactNode;
  /** The page opens on the number (backend N232): no Back, the button says
   *  "Sign up with WhatsApp" or "Sign in with WhatsApp". */
  first?: boolean;
  /** Under the number step only: the other ways in and the page's links. */
  after?: React.ReactNode;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<Step>("number");
  const [number, setNumber] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<"wrong" | "noAccount" | null>(null);
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
    const to = number;
    if (!to || busy) return;
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
        <div>
          <label htmlFor="wa-name" className="block text-base font-semibold">
            {WHATSAPP_AUTH_COPY.nameTitle}
          </label>
          <p className="mt-1 text-sm text-muted-foreground">{WHATSAPP_AUTH_COPY.nameWhy}</p>
        </div>
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
      {first ? null : (
        <button type="button" onClick={onBack}
          className="min-h-[44px] text-sm text-muted-foreground hover:underline">
          ← Back
        </button>
      )}
      <div>
        <label id="wa-phone-label" htmlFor="wa-phone"
          className={first ? "sr-only" : "mb-2 block text-sm font-medium"}>
          {WHATSAPP_AUTH_COPY.numberLabel}
        </label>
        {/* The country by its flag, Poland first (backend N230). */}
        <PhoneNumberField id="wa-phone" label="wa-phone-label" initial={phone || null} disabled={busy}
          onChange={(next) => {
            setNumber(next);
            if (error) setError(null);
          }} />
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
      <Button type="submit" className={first ? "h-12 w-full gap-2 rounded-xl text-[15px] font-semibold" : "w-full"}
        disabled={busy || !number}>
        {first ? (
          <>
            <WhatsAppGlyph className="h-5 w-5 shrink-0 text-white" />
            <span>{mode === "signup" ? WHATSAPP_AUTH_COPY.signUp : WHATSAPP_AUTH_COPY.signIn}</span>
          </>
        ) : WHATSAPP_AUTH_COPY.sendCode}
      </Button>
      {after}
      {legal}
    </form>
  );
}
