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

describe("accessTokenFromRequestParts", () => {
  it("prefers the Authorization header over cookies", () => {
    const cookie = `sb-projref-auth-token=${encodeURIComponent(SESSION_JSON)}`;
    expect(accessTokenFromRequestParts("Bearer header-token", cookie)).toBe(
      "header-token"
    );
  });
});
