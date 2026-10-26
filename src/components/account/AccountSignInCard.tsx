"use client";

/* -------------------------------------------------------------------------- */
/*  Email and password, in Data & consent (founder 2026-10-26, backend N187:  */
/*  "approved, implement it", on the prototype backend docs/design/           */
/*  settings-email-password-2026-10-26.html, WIL-95).                         */
/*                                                                            */
/*  Between Your projects and Support. Two rows:                              */
/*    Email     Change → New email (and Current password, for an account with */
/*              one) → Send link. A link goes to the new address and a notice */
/*              to the old one; the email changes when the link is opened,    */
/*              which brings the person back here (?email=changed).           */
/*    Password  Change → Current password, New password, Confirm new password */
/*              → Update password; Forgot password? under it sends a reset    */
/*              link. An account that signs in with Google or LinkedIn reads  */
/*              "You sign in with Google." with Set a password instead.        */
/*                                                                            */
/*  The backend checks the password, sends the emails and logs every change;  */
/*  this card asks and says what happened. Hidden when it cannot be read.     */
/* -------------------------------------------------------------------------- */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  changeEmail,
  changePassword,
  fetchSignIn,
  sendPasswordLink,
  type SignIn,
} from "@/services/api/accountSignIn";
import { createClient } from "@/lib/supabase/client";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

export const ACCOUNT_CARD_ID = "email-and-password";

const BUTTON =
  "inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-muted";
const PRIMARY =
  "inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-60";
const SMALL =
  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The backend's refusal, in the signed words; anything else is the page's
 *  "Couldn't save that. Try again." */
const REFUSALS: Record<string, string> = {
  EMAIL_INVALID: COPY.accountEmailInvalid,
  EMAIL_SAME: COPY.accountEmailSame,
  EMAIL_TAKEN: COPY.accountEmailTaken,
  WRONG_PASSWORD: COPY.accountWrongPassword,
  PASSWORD_TOO_SHORT: COPY.accountTooShort,
};
const refusal = (code: string) => REFUSALS[code] ?? COPY.failed;

type EmailLine = { kind: "sent" | "done"; to: string } | { kind: "failed" } | null;
type PasswordLine = { kind: "done" } | { kind: "reset" | "set"; to: string } | null;

/** Where the confirmation link brought the person: ?email=changed | failed. */
function landing(): "changed" | "failed" | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get("email");
  return value === "changed" || value === "failed" ? value : null;
}

/** Taken off the address once said, so a reload says nothing. */
function forgetLanding(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("email");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

/** The menu reads the email from the session; a fresh one carries the new. */
async function refreshSession(): Promise<void> {
  try {
    await createClient().auth.refreshSession();
  } catch {
    /* the menu catches up at the next refresh */
  }
}

export default function AccountSignInCard({ load = fetchSignIn }: { load?: () => Promise<SignIn | null> }) {
  const [account, setAccount] = useState<SignIn | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailLine, setEmailLine] = useState<EmailLine>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLine, setPasswordLine] = useState<PasswordLine>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const arrived = landing();
    void load().then((found) => {
      if (!alive || !found) return;
      setAccount(found);
      if (arrived === "changed") {
        setEmailLine({ kind: "done", to: found.email });
        void refreshSession();
      }
      if (arrived === "failed") setEmailLine({ kind: "failed" });
      if (arrived) {
        forgetLanding();
        window.requestAnimationFrame(() =>
          document.getElementById(ACCOUNT_CARD_ID)?.scrollIntoView({ block: "start" }));
      }
    });
    return () => {
      alive = false;
    };
  }, [load]);

  if (!account) return null;

  const openEmail = () => {
    setEmailOpen(true);
    setEmailError(null);
    setPasswordOpen(false);
    setPasswordError(null);
  };
  const openPassword = () => {
    setPasswordOpen(true);
    setPasswordError(null);
    setPasswordLine(null);
    setEmailOpen(false);
    setEmailError(null);
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const to = String(form.get("new_email") ?? "").trim().toLowerCase();
    if (!EMAIL.test(to)) return setEmailError(COPY.accountEmailInvalid);
    if (to === account.email.toLowerCase()) return setEmailError(COPY.accountEmailSame);
    setBusy(true);
    const result = await changeEmail(
      to,
      account.hasPassword ? String(form.get("current_password") ?? "") : undefined,
    );
    setBusy(false);
    if (!result.ok) return setEmailError(refusal(result.code));
    setEmailOpen(false);
    setEmailError(null);
    setEmailLine({ kind: "sent", to: result.sentTo ?? to });
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get("current_password") ?? "");
    const next = String(form.get("new_password") ?? "");
    if (next.length < 6) return setPasswordError(COPY.accountTooShort);
    if (next !== String(form.get("confirm_password") ?? "")) return setPasswordError(COPY.accountNoMatch);
    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (!result.ok) return setPasswordError(refusal(result.code));
    setPasswordOpen(false);
    setPasswordError(null);
    setPasswordLine({ kind: "done" });
  };

  const sendLink = async () => {
    setBusy(true);
    const result = await sendPasswordLink();
    setBusy(false);
    if (!result.ok) {
      setPasswordError(COPY.failed);
      return;
    }
    setPasswordOpen(false);
    setPasswordError(null);
    setPasswordLine({ kind: result.kind ?? "reset", to: result.sentTo ?? account.email });
  };

  return (
    <section
      id={ACCOUNT_CARD_ID}
      className="mt-6 rounded-2xl border border-border p-5"
      aria-label={COPY.accountTitle}
    >
      <h2 className="text-base font-semibold">{COPY.accountTitle}</h2>
      <ul className="mt-2">
        <li className="flex flex-col gap-3 pb-3.5 pt-1">
          <Row
            label={COPY.accountEmail}
            value={<span className="break-all text-[15px]">{account.email}</span>}
            action={emailOpen ? null : (
              <button type="button" className={SMALL} onClick={openEmail}>{COPY.accountChange}</button>
            )}
          />
          {emailOpen ? (
            <form className="flex flex-col gap-3.5 rounded-xl bg-muted p-4" onSubmit={submitEmail} noValidate>
              <Field id="account-new-email" name="new_email" label={COPY.accountNewEmail} type="email"
                autoComplete="email" placeholder={COPY.accountEmailPlaceholder} autoFocus />
              {account.hasPassword ? (
                <Field id="account-email-password" name="current_password" label={COPY.accountCurrentPassword}
                  type="password" autoComplete="current-password" />
              ) : null}
              <Problem text={emailError} />
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={PRIMARY} disabled={busy}>{COPY.accountSendLink}</button>
                <button type="button" className={BUTTON} onClick={() => { setEmailOpen(false); setEmailError(null); }}>
                  {COPY.cancel}
                </button>
              </div>
            </form>
          ) : (
            <EmailStatus line={emailLine} />
          )}
        </li>
        <li className="flex flex-col gap-3 border-t border-border pt-3.5">
          {account.hasPassword ? (
            <Row
              label={COPY.accountPassword}
              value={<span className="text-[15px] tracking-[0.12em]" aria-hidden>••••••••</span>}
              action={passwordOpen ? null : (
                <button type="button" className={SMALL} onClick={openPassword}>{COPY.accountChange}</button>
              )}
            />
          ) : (
            <Row
              label={COPY.accountPassword}
              value={<span className="text-sm leading-relaxed text-muted-foreground">
                {COPY.accountProvider(account.provider ?? "Google")}
              </span>}
              action={<button type="button" className={SMALL} disabled={busy} onClick={() => void sendLink()}>
                {COPY.accountSetPassword}
              </button>}
            />
          )}
          {passwordOpen ? (
            <form className="flex flex-col gap-3.5 rounded-xl bg-muted p-4" onSubmit={submitPassword} noValidate>
              <Field id="account-current-password" name="current_password" label={COPY.accountCurrentPassword}
                type="password" autoComplete="current-password" autoFocus />
              <Field id="account-new-password" name="new_password" label={COPY.accountNewPassword}
                type="password" autoComplete="new-password" placeholder={COPY.accountAtLeast6} />
              <Field id="account-confirm-password" name="confirm_password" label={COPY.accountConfirmPassword}
                type="password" autoComplete="new-password" placeholder={COPY.accountConfirmPassword} />
              <Problem text={passwordError} />
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={PRIMARY} disabled={busy}>{COPY.accountUpdatePassword}</button>
                <button type="button" className={BUTTON} onClick={() => { setPasswordOpen(false); setPasswordError(null); }}>
                  {COPY.cancel}
                </button>
              </div>
              <button
                type="button"
                className="self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                disabled={busy}
                onClick={() => void sendLink()}
              >
                {COPY.accountForgot}
              </button>
            </form>
          ) : (
            <>
              <Problem text={account.hasPassword ? null : passwordError} />
              <PasswordStatus line={passwordLine} />
            </>
          )}
        </li>
      </ul>
    </section>
  );
}

function Row({ label, value, action }: { label: string; value: ReactNode; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        {value}
      </div>
      {action}
    </div>
  );
}

function Field({
  id, name, label, type, autoComplete, placeholder, autoFocus,
}: {
  id: string; name: string; label: string; type: "email" | "password";
  autoComplete: string; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="self-start text-sm font-medium">{label}</label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="text-base sm:text-sm"
        {...(type === "email" ? { inputMode: "email" as const, autoCapitalize: "off", spellCheck: false } : {})}
      />
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? <p role="alert" className="text-sm text-destructive">{text}</p> : null;
}

function EmailStatus({ line }: { line: EmailLine }) {
  if (!line) return null;
  if (line.kind === "failed") return <Problem text={COPY.failed} />;
  return (
    <p role="status" className="text-sm leading-relaxed">
      {line.kind === "sent" ? COPY.accountEmailSent(line.to) : COPY.accountEmailDone(line.to)}
    </p>
  );
}

function PasswordStatus({ line }: { line: PasswordLine }) {
  if (!line) return null;
  const text = line.kind === "done"
    ? COPY.accountPasswordDone
    : line.kind === "reset" ? COPY.accountResetSent(line.to) : COPY.accountSetSent(line.to);
  return <p role="status" className="text-sm leading-relaxed">{text}</p>;
}
