/** The founder's account, as the founder-only pages already name it
 *  (`/admin/rings`, `/coach/corpus/summary`). Exposure only: every founder
 *  surface is authorized again server-side by the backend's admin checks. */
export const FOUNDER_EMAIL = "artur@willonski.com";

export function isFounderEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === FOUNDER_EMAIL;
}
