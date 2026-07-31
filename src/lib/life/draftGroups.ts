/* -------------------------------------------------------------------------- */
/*  The order the drafted rows are grouped in — which is the SERVER'S order     */
/*                                                                            */
/*  A hinted draft comes back with the hinted rows FIRST (BE 2026-07-31),      */
/*  deliberately, because that is the kind held by the view the person is      */
/*  standing on. So the frontend groups by first appearance and re-sorts       */
/*  nothing.                                                                   */
/*                                                                            */
/*  This is a module rather than four lines inline because of what it          */
/*  replaced. `DraftList` used to lead with a fixed                            */
/*  ["bet", "goal", "habit", "distraction"], which was harmless while those    */
/*  were the only kinds a document could yield and wrong the moment there were */
/*  more: a document opened from Phrases that also held goals rendered its     */
/*  GOALS first, on the Phrases screen, burying the rows the backend had put   */
/*  at the top for exactly that reason. A hardcoded order cannot know which    */
/*  view asked, and the next person to add a kind would have had to know to    */
/*  edit a list in a component to find out.                                    */
/* -------------------------------------------------------------------------- */

/** The distinct kinds in `draft`, in the order they first appear. */
export function draftKindsInOrder<T extends { kind: string }>(
  draft: readonly T[]
): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const item of draft) {
    if (seen.has(item.kind)) continue;
    seen.add(item.kind);
    order.push(item.kind);
  }
  return order;
}
