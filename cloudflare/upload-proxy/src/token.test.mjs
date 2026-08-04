import { describe, expect, it } from "vitest";
import {
  accessTokenFromCookieHeader,
  accessTokenFromRequestParts,
  bearerFromHeader,
} from "./token.mjs";

/* -------------------------------------------------------------------------- */
/*  Locks the Worker's token extraction — the same two defects the BFF fix     */
/*  was about (chunk reassembly, junk bearer strings) must not regress in the  */
/*  Cloudflare lane. Pure functions, so no Workers runtime needed.             */
/* -------------------------------------------------------------------------- */

function toBase64Url(s) {
  const b64 = Buffer.from(s, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const SESSION = { access_token: "jwt-abc.def.ghi", refresh_token: "r1" };
const SESSION_JSON = JSON.stringify(SESSION);

describe("bearerFromHeader", () => {
  it("extracts a plain bearer and rejects junk the clients have really sent", () => {
    expect(bearerFromHeader("Bearer jwt-abc")).toBe("jwt-abc");
    expect(bearerFromHeader("Bearer undefined")).toBeNull();
    expect(bearerFromHeader("Bearer null")).toBeNull();
    expect(bearerFromHeader("Bearer ")).toBeNull();
    expect(bearerFromHeader("Basic dXNlcg==")).toBeNull();
    expect(bearerFromHeader(null)).toBeNull();
  });
});

describe("accessTokenFromCookieHeader", () => {
  it("reads a whole URI-encoded JSON cookie", () => {
    const header = `sb-projref-auth-token=${encodeURIComponent(SESSION_JSON)}; other=1`;
    expect(accessTokenFromCookieHeader(header)).toBe("jwt-abc.def.ghi");
  });

  it("reads a whole base64url cookie (@supabase/ssr 'base64-' format)", () => {
    const header = `sb-projref-auth-token=base64-${toBase64Url(SESSION_JSON)}`;
    expect(accessTokenFromCookieHeader(header)).toBe("jwt-abc.def.ghi");
  });

  it("reassembles chunked cookies IN ORDER before decoding", () => {
    const encoded = `base64-${toBase64Url(SESSION_JSON)}`;
    const mid = Math.floor(encoded.length / 2);
    // Deliberately out of order in the header — order comes from the .N index.
    const header = [
      `sb-projref-auth-token.1=${encoded.slice(mid)}`,
      `sb-projref-auth-token.0=${encoded.slice(0, mid)}`,
    ].join("; ");
    expect(accessTokenFromCookieHeader(header)).toBe("jwt-abc.def.ghi");
  });

  it("skips a stale unparseable ref and finds the good one", () => {
    const header = [
      "sb-oldref-auth-token=base64-!!!notbase64!!!",
      `sb-newref-auth-token=${encodeURIComponent(SESSION_JSON)}`,
    ].join("; ");
    expect(accessTokenFromCookieHeader(header)).toBe("jwt-abc.def.ghi");
  });

  it("returns null on junk, foreign cookies, or no cookies at all", () => {
    expect(accessTokenFromCookieHeader("theme=dark; _ga=GA1.1")).toBeNull();
    expect(accessTokenFromCookieHeader("sb-projref-auth-token=%7Bnope")).toBeNull();
    expect(accessTokenFromCookieHeader("")).toBeNull();
    expect(accessTokenFromCookieHeader(null)).toBeNull();
  });
});

describe("accessTokenFromRequestParts", () => {
  it("prefers the Authorization header over cookies", () => {
    const cookie = `sb-projref-auth-token=${encodeURIComponent(SESSION_JSON)}`;
    expect(accessTokenFromRequestParts("Bearer header-token", cookie)).toBe(
      "header-token"
    );
  });

  it("falls back to cookies when the header is absent or junk", () => {
    const cookie = `sb-projref-auth-token=${encodeURIComponent(SESSION_JSON)}`;
    expect(accessTokenFromRequestParts(null, cookie)).toBe("jwt-abc.def.ghi");
    expect(accessTokenFromRequestParts("Bearer undefined", cookie)).toBe(
      "jwt-abc.def.ghi"
    );
  });
});
