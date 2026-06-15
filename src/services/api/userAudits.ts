/* -------------------------------------------------------------------------- */
/*  userAudits — coach-uploaded PDF audits for the user (§C2)                 */
/*                                                                            */
/*  GET /api/v2/user/audits → { audits:[{id, name, date, pdf_url}] }          */
/*  The PDF is the coach's deliverable; the FE stores nothing — it opens the  */
/*  BE-signed pdf_url directly in a new tab.                                  */
/* -------------------------------------------------------------------------- */

export interface UserAudit {
  id: string;
  name: string;
  /** ISO 8601 date string (audit_date from BE). */
  date: string;
  /** Short-lived signed URL — open in new tab immediately; don't cache. */
  pdfUrl: string;
}

function mapAudit(raw: unknown): UserAudit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  return {
    id: r.id,
    name: r.name,
    date: typeof r.date === "string" ? r.date : "",
    pdfUrl: typeof r.pdf_url === "string" ? r.pdf_url : "",
  };
}

export function mapUserAudits(raw: unknown): UserAudit[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.audits)) return [];
  return r.audits.map(mapAudit).filter((a): a is UserAudit => a !== null);
}

export async function fetchUserAudits(): Promise<UserAudit[]> {
  let res: Response;
  try {
    res = await fetch("/api/v2/user/audits", {
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  return mapUserAudits(await res.json().catch(() => null));
}
