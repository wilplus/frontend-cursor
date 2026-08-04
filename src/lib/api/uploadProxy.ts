/**
 * Cloudflare upload-proxy opt-in (founder decision 2026-08-04: no Vercel Pro,
 * ever — long uploads route around the 300s Hobby ceiling through the Worker
 * in cloudflare/upload-proxy/).
 *
 * Unset env = fully inert: every caller keeps using the Vercel BFF lane.
 * When set, upload clients TRY the Worker first and fall back to the BFF on
 * any network-level failure (CORS, DNS, offline), so enabling it can degrade
 * only to exactly today's behavior.
 *
 * Value is either the Worker origin (workers.dev mode) or origin + route
 * prefix (route mode, e.g. https://willpowerlab.com/cf-upload). Callers
 * append backend paths like /v2/lab/recordings directly.
 */
export function uploadProxyBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_UPLOAD_PROXY_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}
