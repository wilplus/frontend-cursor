/**
 * Debug ingest: fire-and-forget POST to a local debug server.
 * Only runs when NODE_ENV === "development"; no-op in production (no request made).
 * Never awaited — does not block user flows.
 */
export function debugIngest(url: string, payload?: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload != null ? JSON.stringify(payload) : undefined,
  }).catch(() => {});
}
