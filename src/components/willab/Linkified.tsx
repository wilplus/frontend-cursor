import { Fragment } from "react";
import { splitLinks } from "@/lib/willab/linkify";

/* -------------------------------------------------------------------------- */
/*  Linkified (FE-13) — chat text with its URLs clickable                      */
/*                                                                            */
/*  Will replies with booking links and they rendered as dead text. Both       */
/*  bubbles use this, so a link works whichever side of the thread it is on.   */
/*                                                                            */
/*  ESCAPE FIRST, LINKIFY SECOND: chat content is user- and model-authored, so */
/*  this returns React NODES and never builds an anchor by injecting message   */
/*  text into an HTML string. React escapes text children and the href by      */
/*  construction — there is no innerHTML anywhere on this path, and there must */
/*  not be one. A query string therefore survives verbatim rather than being   */
/*  entity-mangled or cut at its first "&".                                    */
/* -------------------------------------------------------------------------- */

export default function Linkified({ text }: { text: string }) {
  const parts = splitLinks(text);
  // No URL in the message: hand back the string itself, so the overwhelmingly
  // common bubble pays nothing for this.
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            // A long URL wraps inside the bubble instead of widening it.
            className="underline underline-offset-2 [overflow-wrap:anywhere]"
          >
            {part.value}
          </a>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        )
      )}
    </>
  );
}
