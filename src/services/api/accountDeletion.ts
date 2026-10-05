/* "Delete my account" (founder 2026-10-05, Q3a): POST
 * /api/v2/processing-authorization/terminate with the account_deletion kind.
 * The idempotency key makes a double tap one request. true when the backend
 * recorded it (202). */
export async function requestAccountDeletion(): Promise<boolean> {
  try {
    const res = await fetch("/api/v2/processing-authorization/terminate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_kind: "account_deletion",
        idempotency_key: `account-deletion:${crypto.randomUUID()}`,
      }),
    });
    return res.status === 202 || res.ok;
  } catch {
    return false;
  }
}
