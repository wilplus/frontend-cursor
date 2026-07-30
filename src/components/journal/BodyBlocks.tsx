import { Download } from "lucide-react";
import { parseBodyBlocks } from "@/services/api/journal";

/* -------------------------------------------------------------------------- */
/*  BodyBlocks — THE Journal body renderer                                     */
/*                                                                            */
/*  One component for both mounts: the public post page (/blog/[slug], a       */
/*  server component) and the CMS's live preview (a client tree). It has no    */
/*  hooks and no state on purpose, so it can be either without a "use client"  */
/*  directive — whichever tree imports it decides.                             */
/*                                                                            */
/*  Input is the PLAIN TEXT body; `parseBodyBlocks` owns the token spec (see   */
/*  services/api/journal.ts) and has already refused unsafe URLs, so nothing   */
/*  here needs to sanitize and dangerouslySetInnerHTML is never used.          */
/*                                                                            */
/*  The parent supplies vertical rhythm (the article uses `space-y-6`);        */
/*  blocks only size themselves horizontally.                                  */
/* -------------------------------------------------------------------------- */

export default function BodyBlocks({ body }: { body: string }) {
  const blocks = parseBodyBlocks(body);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "image") {
          return (
            <figure key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.url}
                alt={b.alt}
                loading="lazy"
                // Centered at the standard content width: never wider than
                // the reading column, natural height (an inline figure is
                // not a hero, so no fixed aspect box here).
                className="mx-auto w-full max-w-[680px] rounded-2xl"
              />
            </figure>
          );
        }
        if (b.type === "file") {
          return (
            <a
              key={i}
              href={b.url}
              // New tab: these are PDFs/downloads, and navigating the reader
              // away mid-article is the one thing a file row must not do.
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 no-underline transition hover:bg-muted/40"
            >
              <Download
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {b.label}
              </span>
            </a>
          );
        }
        return (
          <p
            key={i}
            // whitespace-pre-line: single newlines INSIDE a paragraph (a
            // list, an address) must survive instead of collapsing to spaces.
            className="whitespace-pre-line text-[17px] leading-[1.75] text-foreground/90"
          >
            {b.text}
          </p>
        );
      })}
    </>
  );
}
