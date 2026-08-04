/**
 * Supabase access-token extraction for the upload proxy — pure functions,
 * no Workers APIs, so vitest can lock the fiddly parts (chunk reassembly,
 * base64url decoding) without a Workers runtime.
 *
 * Trust model matches the BFF exactly: the token is EXTRACTED and FORWARDED,
 * never verified or minted here — the backend validates every bearer it gets.
 */

/** `Authorization: Bearer …` → token, with the same junk guards as
 *  src/app/api/_lib/backend.ts (clients have sent literal "undefined"). */
export function bearerFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

function decodeBase64Url(input) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** One reassembled @supabase/ssr cookie value → access_token | null.
 *  Values are URI-encoded JSON, or "base64-" + base64url(JSON); the session
 *  object carries `access_token`. */
function accessTokenFromValue(rawValue) {
  let value = rawValue;
  try {
    value = decodeURIComponent(rawValue);
  } catch {
    // Raw base64url never needs decoding; keep as-is.
  }
  try {
    const json = value.startsWith("base64-")
      ? decodeBase64Url(value.slice("base64-".length))
      : value;
    const session = JSON.parse(json);
    const token = session && typeof session === "object" ? session.access_token : null;
    return typeof token === "string" && token ? token : null;
  } catch {
    return null;
  }
}

/**
 * Cookie header → access_token | null.
 *
 * Supabase stores the session as `sb-<project-ref>-auth-token`, CHUNKED into
 * `…-auth-token.0`, `…-auth-token.1`, … when it outgrows one cookie — the
 * encoded string splits across chunks, so reassembly happens BEFORE decoding
 * (the same reason the BFF had to move to getAll). Multiple project refs can
 * coexist (stale cookies from another environment); the first ref that yields
 * a parseable session wins.
 *
 * Only reachable in same-origin (route) deployments — browsers don't send the
 * app's host-only cookies to a foreign workers.dev origin. Cross-origin
 * callers authenticate via the Authorization header instead.
 */
export function accessTokenFromCookieHeader(cookieHeader) {
  if (!cookieHeader) return null;

  /** ref → { whole: string | null, chunks: Map<index, value> } */
  const groups = new Map();
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const m = /^sb-(.+?)-auth-token(?:\.(\d+))?$/.exec(name);
    if (!m) continue;
    const ref = m[1];
    const group = groups.get(ref) ?? { whole: null, chunks: new Map() };
    if (m[2] === undefined) group.whole = value;
    else group.chunks.set(Number(m[2]), value);
    groups.set(ref, group);
  }

  for (const group of groups.values()) {
    const candidates = [];
    if (group.chunks.size > 0) {
      const ordered = [...group.chunks.entries()].sort((a, b) => a[0] - b[0]);
      candidates.push(ordered.map(([, v]) => v).join(""));
    }
    if (group.whole !== null) candidates.push(group.whole);
    for (const candidate of candidates) {
      const token = accessTokenFromValue(candidate);
      if (token) return token;
    }
  }
  return null;
}

/** Header first (both upload clients attach it), cookies as the same-origin
 *  fallback. */
export function accessTokenFromRequestParts(authHeader, cookieHeader) {
  return bearerFromHeader(authHeader) ?? accessTokenFromCookieHeader(cookieHeader);
}
