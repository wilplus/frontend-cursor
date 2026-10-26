import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  accountSignIn — Email and password on Data & consent (backend N189)        */
/*                                                                            */
/*   GET  /api/v2/account/sign-in         → { email, has_password, provider } */
/*   POST /api/v2/account/email           { new_email, current_password? }    */
/*   POST /api/v2/account/password        { current_password, new_password }  */
/*   POST /api/v2/account/password/link   → { sent_to, kind: reset | set }    */
/*   POST /api/v2/account/password/link-used   (Set new password saved one)   */
/*                                                                            */
/*  The backend checks the current password, sends the emails and keeps the  */
/*  security log; a refusal comes back as its `code`, which the card turns    */
/*  into the signed words.                                                    */
/* -------------------------------------------------------------------------- */

const BASE = "/api/v2/account";

export interface SignIn {
  email: string;
  hasPassword: boolean;
  /** "Google", "LinkedIn": how an account without a password signs in. */
  provider: string | null;
}

export type AccountResult =
  | { ok: true; sentTo?: string; kind?: "reset" | "set" }
  | { ok: false; code: string };

/** The card's facts; null when they could not be read (signed out, offline,
 *  the backend not ready), so the card is left out rather than guessed. */
export async function fetchSignIn(): Promise<SignIn | null> {
  const result = await bffFetch(`${BASE}/sign-in`, { cache: "no-store" });
  if (result.kind !== "response" || !result.ok) return null;
  const body = (result.body ?? {}) as Record<string, unknown>;
  if (typeof body.email !== "string") return null;
  return {
    email: body.email,
    hasPassword: body.has_password === true,
    provider: typeof body.provider === "string" && body.provider ? body.provider : null,
  };
}

async function post(path: string, json: Record<string, unknown> = {}): Promise<AccountResult> {
  const result = await bffFetch(`${BASE}${path}`, { method: "POST", json });
  if (result.kind !== "response") return { ok: false, code: "NETWORK" };
  const body = (result.body ?? {}) as Record<string, unknown>;
  if (!result.ok) return { ok: false, code: typeof body.code === "string" ? body.code : "FAILED" };
  return {
    ok: true,
    ...(typeof body.sent_to === "string" ? { sentTo: body.sent_to } : {}),
    ...(body.kind === "reset" || body.kind === "set" ? { kind: body.kind } : {}),
  };
}

export function changeEmail(newEmail: string, currentPassword?: string): Promise<AccountResult> {
  return post("/email", {
    new_email: newEmail,
    ...(currentPassword !== undefined ? { current_password: currentPassword } : {}),
  });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<AccountResult> {
  return post("/password", { current_password: currentPassword, new_password: newPassword });
}

/** Forgot password? or Set a password: a link to the account's email. */
export function sendPasswordLink(): Promise<AccountResult> {
  return post("/password/link");
}

/** Set new password saved a password from an emailed link: logged, and the
 *  notice goes for a reset. Best effort; the password is saved either way. */
export async function passwordLinkUsed(): Promise<void> {
  try {
    await post("/password/link-used");
  } catch {
    /* the log is the backend's; the person's password is already set */
  }
}
