import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  whatsapp — the speaker's WhatsApp number (founder 2026-10-12)              */
/*                                                                            */
/*   GET /api/v2/user/whatsapp → { phone: string | null }                      */
/*   PUT /api/v2/user/whatsapp   body { phone } → { phone } | 422 refusal       */
/*                                                                            */
/*  The backend owns the format rule (E.164) and refuses anything else; the    */
/*  same rule runs here first so the speaker hears about it without a round    */
/*  trip.                                                                      */
/* -------------------------------------------------------------------------- */

const ENDPOINT = "/api/v2/user/whatsapp";

/** E.164 after dropping spaces, dashes, dots and brackets ("00" counts as "+"),
 *  or null when it is not a full international number. */
export function normalizePhone(raw: string): string | null {
  let text = raw.trim().replace(/[\s\-().]/g, "");
  if (text.startsWith("00")) text = `+${text.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(text) ? text : null;
}

/** The saved number; `undefined` when it could not be read (signed out,
 *  offline), so the caller never offers on a guess. */
export async function fetchWhatsAppPhone(): Promise<string | null | undefined> {
  const result = await bffFetch(ENDPOINT, { cache: "no-store" });
  if (result.kind !== "response" || !result.ok) return undefined;
  const phone = (result.body as { phone?: unknown } | null)?.phone;
  return typeof phone === "string" && phone ? phone : null;
}

export async function saveWhatsAppPhone(phone: string): Promise<boolean> {
  const result = await bffFetch(ENDPOINT, { method: "PUT", json: { phone } });
  return result.kind === "response" && result.ok;
}
