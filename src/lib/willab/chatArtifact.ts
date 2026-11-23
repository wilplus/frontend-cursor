/** Optional content delivered with a reply. Audio, actions and saved results
 *  that require authorization use the conversation's existing controls. */
export type ChatArtifactContent = {
  version: 1;
  title: string;
  preview?: string;
  moment?: string;
  intervention?: string;
  output?: string;
};

export function chatArtifactContent(raw: unknown): ChatArtifactContent | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== 1) return null;
  const words = (key: string, limit: number) => {
    const value = record[key];
    if (typeof value !== "string") return undefined;
    const clean = value.split("\u0000").join("").replace(/[\uD800-\uDFFF]/gu, "").trim();
    return Array.from(clean).slice(0, limit).join("") || undefined;
  };
  const title = words("title", 120);
  const moment = words("moment", 3000);
  const intervention = words("intervention", 3000);
  const output = words("output", 3000);
  if (!title || (!moment && !intervention && !output)) return null;
  return { version: 1, title, preview: words("preview", 240), moment, intervention, output };
}
