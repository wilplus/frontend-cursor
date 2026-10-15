/** Privacy section 4a, the training choice, as the stored bytes hold it: from
 *  the line that starts "4a." up to the line that starts "4b.". Read more on
 *  every training ask opens exactly this (training wording v4, 2026-10-15).
 *  A copy without those headings is shown whole rather than not at all. */
export function trainingSection(privacyCopy: string): string {
  const start = privacyCopy.search(/^4a\./m);
  if (start < 0) return privacyCopy;
  const rest = privacyCopy.slice(start);
  const end = rest.slice(1).search(/^4b\./m);
  return (end < 0 ? rest : rest.slice(0, end + 1)).trimEnd();
}
