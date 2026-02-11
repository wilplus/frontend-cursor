/**
 * Fire-and-forget debug ingest. Only runs when NODE_ENV is "development".
 * Never awaited; never blocks user flows. Use for session/debug logging only.
 */
export function debugIngest(url: string, payload?: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload != null ? JSON.stringify(payload) : "{}",
  }).catch(() => {});
}
