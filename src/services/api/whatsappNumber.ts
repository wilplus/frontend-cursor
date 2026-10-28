import { createClient } from "@/lib/supabase/client";
import { saveWhatsAppPhone } from "@/services/api/whatsapp";

/* -------------------------------------------------------------------------- */
/*  whatsappNumber — one WhatsApp number for everything, checked once         */
/*  (founder 2026-10-28, backend N230).                                       */
/*                                                                            */
/*  A signed-in account gives a number (the Lounge's ask, Settings): Supabase */
/*  makes it the account's phone once its code is typed (a phone change; the */
/*  backend's hook sends the code on WhatsApp), and then it is saved as the   */
/*  number the messages go to too. So the number that gets the messages is    */
/*  the number that signs in, and neither happens without the code.          */
/* -------------------------------------------------------------------------- */

/** sent: the code is on its way. same: the account already signs in with
 *  this number, so it needs no code. taken: another account signs in with
 *  it (backend N235). failed: no code went (a pause between codes, offline). */
export type CodeSent = "sent" | "same" | "taken" | "failed";

/** Supabase's refusal of a phone another account has. */
function isTaken(error: { code?: string; message?: string }): boolean {
  return error.code === "phone_exists" || /already (been )?registered|already in use/i.test(error.message ?? "");
}

const bare = (phone: string) => phone.replace(/^\+/, "");

export async function sendNumberCode(phone: string): Promise<CodeSent> {
  try {
    const { data, error } = await createClient().auth.updateUser({ phone });
    if (error) return isTaken(error) ? "taken" : "failed";
    // Already this account's number (or a project that confirms phones
    // without a code): nothing to prove.
    if (bare(data.user?.phone ?? "") === bare(phone)) {
      return (await saveWhatsAppPhone(phone)) ? "same" : "failed";
    }
    return "sent";
  } catch {
    return "failed";
  }
}

/** The code typed: true once the number signs in and gets the messages. */
export async function confirmNumberCode(phone: string, token: string): Promise<boolean> {
  try {
    const { data, error } = await createClient().auth.verifyOtp({ phone, token, type: "phone_change" });
    if (error || !data.user) return false;
  } catch {
    return false;
  }
  // The messages number follows; a failure here leaves the sign-in done,
  // and the Lounge asks again later.
  await saveWhatsAppPhone(phone);
  return true;
}
