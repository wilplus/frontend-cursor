/* -------------------------------------------------------------------------- */
/*  life/hashtags — the # routing layer for the chat composer (spec §5, FE-5)  */
/*                                                                            */
/*  Routing is by HASHTAG, not by classifier. The user declares the intent;    */
/*  the system does not guess. Deterministic, free, and never wrong about what */
/*  was meant.                                                                */
/*                                                                            */
/*  Two rules the parser encodes, both from the spec:                          */
/*    1. Matching is on the FIRST TOKEN only. "#lift me up" is `#lift` plus    */
/*       prose, which is not a tag, so it falls through to capture-only. That  */
/*       is why the win alias is the single word `#liftmeup`.                  */
/*    2. An unknown tag is NOT an error. It captures. Every note lands in      */
/*       life_notes regardless of tag; capture never fails and never blocks.   */
/*                                                                            */
/*  The FE does not execute any route — the backend does. This module only     */
/*  decides what the composer shows and what the picker offers.               */
/* -------------------------------------------------------------------------- */

import type { LifeTagDescriptor } from "./types";

/** Where a tag sends the note. `capture` is the no-tag / unknown-tag fallback:
 *  the note is stored and surfaced in the weekly untagged review, nothing more. */
export type LifeTagRoute =
  | "case"
  | "goal_diff"
  | "win"
  | "phrase_add"
  | "day_edit"
  | "capture";

export interface LifeTagSpec {
  /** The canonical tag, without the "#". First alias is the canonical one. */
  tag: string;
  route: LifeTagRoute;
  /** One line, shown in the picker. */
  label: string;
  aliases: string[];
  /** Hidden tags route normally but never appear in the picker or the guide.
   *  `#sin` is right for the founder and wrong as a public category in a
   *  speaking product (spec §5), so it works and stays unlisted. */
  hiddenAliases?: string[];
}

/** The registry, in picker order. */
export const LIFE_TAGS: readonly LifeTagSpec[] = [
  {
    tag: "mistake",
    route: "case",
    label: "A case to reflect on, and the principle it earns",
    aliases: ["mistake", "principle", "error", "problem"],
    hiddenAliases: ["sin"],
  },
  {
    tag: "observation",
    route: "goal_diff",
    label: "Something you noticed, checked against your strategy",
    aliases: ["observation", "data", "reflection", "idea", "finding"],
  },
  {
    tag: "win",
    route: "win",
    label: "A win, kept",
    aliases: ["win", "wins", "wygrane", "liftmeup"],
  },
  {
    tag: "add",
    route: "phrase_add",
    label: "Add what follows to your phrase wall",
    aliases: ["add"],
  },
  {
    tag: "edit",
    route: "day_edit",
    label: "Edit today's card, and say why",
    aliases: ["edit"],
  },
];

/** alias → spec, including hidden aliases. Built once. */
const ALIAS_INDEX: ReadonlyMap<string, LifeTagSpec> = (() => {
  const m = new Map<string, LifeTagSpec>();
  for (const spec of LIFE_TAGS) {
    for (const a of spec.aliases) m.set(a, spec);
    for (const a of spec.hiddenAliases ?? []) m.set(a, spec);
  }
  return m;
})();

/** What the picker offers: canonical tags only, hidden aliases excluded. */
export function pickerEntries(
  override?: LifeTagDescriptor[] | null
): Array<{ tag: string; label: string }> {
  if (override && override.length > 0) {
    return override
      .filter((t) => !t.hidden && typeof t.tag === "string" && t.tag.trim())
      .map((t) => ({ tag: t.tag.replace(/^#/, ""), label: t.label ?? "" }));
  }
  return LIFE_TAGS.map((s) => ({ tag: s.tag, label: s.label }));
}

export interface ParsedTag {
  /** The alias the user actually typed, lowercased, without "#". */
  alias: string;
  /** Canonical tag for that alias. */
  tag: string;
  route: LifeTagRoute;
  /** The message with the tag token removed. May be empty. */
  rest: string;
}

/**
 * Parse the FIRST token of a message.
 *
 * Returns null when there is no leading hashtag at all — that is the ordinary
 * chat path and the caller must leave it completely alone.
 *
 * Returns a `capture` route when there IS a leading hashtag but it matches no
 * alias. That is still a life note (it captures), not an error, so the caller
 * must not surface a "no such tag" message.
 */
export function parseLeadingTag(message: string): ParsedTag | null {
  // Match a leading "#word". Unicode letters so "#wygrane" and any future
  // Polish alias behave the same as ASCII ones.
  const m = /^\s*#([\p{L}\p{N}_]+)/u.exec(message);
  if (!m) return null;
  const alias = m[1].toLowerCase();
  const rest = message.slice(m[0].length).trim();
  const spec = ALIAS_INDEX.get(alias);
  if (!spec) return { alias, tag: alias, route: "capture", rest };
  return { alias, tag: spec.tag, route: spec.route, rest };
}

/** True when the message routes somewhere other than plain capture. */
export function isLifeTagged(message: string): boolean {
  const parsed = parseLeadingTag(message);
  return parsed !== null && parsed.route !== "capture";
}

/**
 * Should the composer show the tag picker for this draft, and filtered to what?
 *
 * The picker opens on a leading "#" that is still the only token being typed.
 * A "#" later in the message is deliberately ignored: matching is first-token
 * only, so offering a tag there would offer something that cannot route.
 *
 * Returns null when the picker must not render.
 */
export function pickerQuery(draft: string): string | null {
  const m = /^\s*#([\p{L}\p{N}_]*)$/u.exec(draft);
  if (!m) return null;
  return m[1].toLowerCase();
}

/** Filter the picker list by what has been typed after the "#". */
export function filterPicker(
  entries: Array<{ tag: string; label: string }>,
  query: string
): Array<{ tag: string; label: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  const starts = entries.filter((e) => e.tag.startsWith(q));
  if (starts.length > 0) return starts;
  return entries.filter((e) => e.tag.includes(q));
}

/** Replace the in-progress "#…" token with the chosen tag, ready to type on. */
export function applyPick(draft: string, tag: string): string {
  return draft.replace(/^(\s*)#[\p{L}\p{N}_]*$/u, `$1#${tag} `);
}
