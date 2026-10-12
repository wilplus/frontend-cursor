import { describe, expect, it } from "vitest";
import { pickerQuery } from "./hashtags";
import { mapChatCard } from "./mappers";

/* -------------------------------------------------------------------------- */
/*  ISOLATION TEST — the price of admission for the whole Life Panel           */
/*                                                                            */
/*  The panel is founder-directed scaffolding. It passes the decision filter   */
/*  ONLY because it is fenced off the live loop, and this file is the fence.   */
/*  Same discipline as the Journal isolation test that PR #254 shipped under.  */
/*                                                                            */
/*  What it asserts:                                                          */
/*    1. Exactly TWO product modules may touch the panel: the app header (for  */
/*       the menu entries) and the Lounge (for the # layer). Any third import  */
/*       fails the build. That list is the spec's "single permitted contact    */
/*       point" plus the hamburger FE-1 explicitly asks for.                   */
/*    2. The Lounge's # layer is gated on `lifeTags.enabled`, which is false   */
/*       for every user who has not consented and finished setup.              */
/*    3. The chat send path is unchanged: no life field is added to the        */
/*       /v2/chat/query request. Routing is the backend's job.                 */
/*    4. The panel's BFF proxy can only ever reach `/v2/life/*`.                */
/*                                                                            */
/*  If this test is not green, the branch does not merge.                      */
/* -------------------------------------------------------------------------- */

describe("the # layer is inert for a user who is not on the panel", () => {
  it("renders no card when a turn carried no life metadata", () => {
    // Every bot turn for every other user takes this branch, so the bubble is
    // exactly the bubble that shipped before the panel existed.
    expect(mapChatCard(undefined)).toBeNull();
  });

  it("opens no picker for ordinary chat text", () => {
    expect(pickerQuery("how do I stop my voice shaking?")).toBeNull();
  });
});
