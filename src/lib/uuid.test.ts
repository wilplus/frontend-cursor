import { describe, expect, it } from "vitest";
import { isCanonicalUuid, isUuid } from "./uuid";

/* Audit D1: the six copies this replaces accepted exactly these values. */

const V4 = "3f2b8c1e-9a4d-4e7f-8b2a-1c0d9e8f7a6b";

describe("isUuid — is it a UUID at all", () => {
  it("accepts any case and any version", () => {
    expect(isUuid(V4)).toBe(true);
    expect(isUuid(V4.toUpperCase())).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("refuses other shapes and non-strings", () => {
    for (const value of [
      "", "not-a-uuid", V4.replace(/-/g, ""), `{${V4}}`, `urn:uuid:${V4}`,
      `${V4} `, 42, null, undefined,
    ]) {
      expect(isUuid(value)).toBe(false);
    }
  });
});

describe("isCanonicalUuid — exactly the id the server wrote", () => {
  it("accepts a lowercase version 1-5 UUID with the RFC variant", () => {
    expect(isCanonicalUuid(V4)).toBe(true);
    expect(isCanonicalUuid("11111111-1111-1111-8111-111111111111")).toBe(true);
  });

  it("refuses uppercase, version 0 or 6+, and a non-RFC variant", () => {
    expect(isCanonicalUuid(V4.toUpperCase())).toBe(false);
    expect(isCanonicalUuid("00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(isCanonicalUuid("3f2b8c1e-9a4d-6e7f-8b2a-1c0d9e8f7a6b")).toBe(false);
    expect(isCanonicalUuid("3f2b8c1e-9a4d-4e7f-cb2a-1c0d9e8f7a6b")).toBe(false);
    expect(isCanonicalUuid(7)).toBe(false);
  });
});
