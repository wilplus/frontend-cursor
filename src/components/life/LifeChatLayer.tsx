"use client";

import Link from "next/link";
import { mapChatCard } from "@/lib/life/mappers";
import { CARDS } from "@/lib/life/copy";

/* -------------------------------------------------------------------------- */
/*  FE-5 — the chat's Life Panel card                                        */
/*                                                                            */
/*    LifeChatCard — the answer card for a Life Panel turn. It carries at most */
/*      ONE wall phrase, the user's own words returned at the moment they      */
/*      apply. If the backend attached none, because nothing cleared its       */
/*      relevance floor, we render none. NEVER a placeholder: a mismatched     */
/*      aphorism on a note about something painful is worse than silence.     */
/*                                                                            */
/*  The # tag picker that lived here is gone: typing "#" offers one option,   */
/*  "# note", from the voice notebook (useVoiceNotebook, backend N253).       */
/* -------------------------------------------------------------------------- */

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
