/* -------------------------------------------------------------------------- */
/*  One place that says what a UUID is (audit D1, 2026-09-28).                 */
/*                                                                            */
/*  The same check was written out six times in two shapes. Both shapes are    */
/*  kept, because they answer different questions:                            */
/*                                                                            */
/*  - isUuid: is this a UUID at all? Any version, any case. Used where the     */
/*    value came from a URL or the user, and the backend accepts any case and  */
/*    stores lowercase.                                                        */
/*  - isCanonicalUuid: is this exactly the id the server wrote? Version 1-5,   */
/*    RFC variant, lowercase. Used by the strict wire-contract validators,     */
/*    where any other form means the payload is not the one we asked for.      */
/* -------------------------------------------------------------------------- */

const ANY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Any 8-4-4-4-12 hex UUID, in any case. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && ANY_UUID.test(value);
}

/** A lowercase version 1-5 UUID with the RFC 4122 variant, exactly as the
 *  server writes ids. */
export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}
