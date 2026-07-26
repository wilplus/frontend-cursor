"use client";

import Link from "next/link";
import { filterPicker, pickerQuery } from "@/lib/life/hashtags";
import { mapChatCard } from "@/lib/life/mappers";
import { CARDS } from "@/lib/life/copy";

/* -------------------------------------------------------------------------- */
/*  FE-5 — the chat # layer                                                    */
/*                                                                            */
/*  Everything else about the chat stays exactly as it is. This adds two       */
/*  things, both of which render NOTHING when they have nothing to say:        */
/*                                                                            */
/*    LifeTagPicker — opens on a leading "#". Four aliases per route are easy  */
/*      to build and impossible to memorise, so the picker is what makes       */
/*      discovery work and keeps the guide page off the critical path.         */
/*      `#sin` routes but is not listed: right for the founder, wrong as a     */
/*      public category in a speaking product.                                 */
/*                                                                            */
/*    LifeChatCard — the answer card for a # turn. It carries at most ONE wall */
/*      phrase, the user's own words returned at the moment they apply. If the */
/*      backend attached none, because nothing cleared its relevance floor, we */
/*      render none. NEVER a placeholder: a mismatched aphorism on a note      */
/*      about something painful is worse than silence.                         */
/* -------------------------------------------------------------------------- */

export function LifeTagPicker({
  draft,
  entries,
  onPick,
}: {
  draft: string;
  entries: Array<{ tag: string; label: string }>;
  onPick: (tag: string) => void;
}) {
  const query = pickerQuery(draft);
  if (query === null) return null;
  const matches = filterPicker(entries, query);
  if (matches.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label="Tags"
      className="mb-2 overflow-hidden rounded-2xl border border-border bg-background shadow-sm"
    >
      {matches.map((entry) => (
        <li key={entry.tag}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            // onMouseDown, not onClick: the composer keeps focus, so picking a
            // tag does not close the keyboard on a phone mid-sentence.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(entry.tag);
            }}
            className="block w-full px-4 py-2.5 text-left hover:bg-muted"
          >
            <span className="text-[15px] font-medium text-foreground">
              #{entry.tag}
            </span>
            {entry.label ? (
              <span className="ml-2 text-[13px] text-muted-foreground">
                {entry.label}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Rendered under a bot bubble when the turn carried a life card in its
 *  metadata. `raw` is `message.metadata?.life_card`; anything else returns
 *  null and the bubble renders exactly as it does today. */
export function LifeChatCard({ raw }: { raw: unknown }) {
  const card = mapChatCard(raw);
  if (!card) return null;

  return (
    <div className="mt-2 max-w-[85%] rounded-2xl border border-border bg-background p-3.5">
      {card.title ? (
        <p className="text-[15px] font-medium text-foreground">{card.title}</p>
      ) : null}

      {card.lines.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {card.lines.map((line, i) => (
            <li key={i} className="text-[15px] leading-relaxed text-foreground/90">
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {/* N5 — a derivation lands in triage and needs an approve. The card says
          so rather than letting it read as already accepted. */}
      {card.awaitingApproval ? (
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {CARDS.proposedBadge}
        </p>
      ) : null}

      {card.phrase ? (
        <p className="mt-3 border-t border-border pt-3 text-[15px] italic leading-relaxed text-foreground/80">
          {card.phrase}
        </p>
      ) : null}

      <Link
        href={card.view.startsWith("/") ? card.view : `/panel/${card.view}`}
        className="mt-3 inline-block text-xs uppercase tracking-[0.14em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Open
      </Link>
    </div>
  );
}
