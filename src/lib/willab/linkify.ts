/* -------------------------------------------------------------------------- */
/*  linkify (FE-13) — find the URLs in a chat message                          */
/*                                                                            */
/*  Will replies with booking links, and they arrived as dead text. This is    */
/*  the pure half: splitting a message into text and link runs. The rendering  */
/*  half builds React nodes from these, which is how "escape first, linkify    */
/*  second" is satisfied — chat content is user- AND model-authored, so it is  */
/*  never assembled into an HTML string. There is no innerHTML on this path    */
/*  and there must not be one: React escapes text children and attribute       */
/*  values by construction, and that guarantee is the whole defence.           */
/*                                                                            */
/*  Scope, per the story: http:// and https:// only. Bare "www." and raw       */
/*  email addresses are deliberately out until the founder says otherwise.     */
/* -------------------------------------------------------------------------- */

/** A URL runs to the next whitespace. "<" is excluded so a URL pasted inside
 *  angle brackets does not swallow them. Everything else — "&", "=", "?", "#",
 *  a trailing slash — is part of the URL, which is what keeps a query string
 *  intact instead of truncating it at the first "&". */
const URL_RE = /https?:\/\/[^\s<]+/g;

/** Sentence punctuation that is never part of a URL when it lands at the end.
 *  The screenshot's link ends in a full stop, and linking it breaks the URL. */
const TRAILING = new Set([".", ",", "!", "?", ":", ";"]);

const count = (s: string, ch: string) => s.split(ch).length - 1;

/** Trim what belongs to the sentence rather than the link, and return both. */
export function trimTrailingPunctuation(url: string): [string, string] {
  let end = url.length;
  for (;;) {
    const last = url[end - 1];
    if (last === undefined) break;
    if (TRAILING.has(last)) {
      end--;
      continue;
    }
    // A ")" is only dropped when it CANNOT belong to the URL — a wiki-style
    // link legitimately ends in one, so balance decides rather than a rule.
    if (last === ")") {
      const slice = url.slice(0, end);
      if (count(slice, ")") > count(slice, "(")) {
        end--;
        continue;
      }
    }
    break;
  }
  return [url.slice(0, end), url.slice(end)];
}

export interface LinkPart {
  type: "text" | "link";
  value: string;
}

/** Split a message into plain-text and link runs, in order. Concatenating
 *  every `value` reproduces the input exactly — nothing is dropped, nothing is
 *  escaped here, and nothing is re-encoded. */
export function splitLinks(text: string): LinkPart[] {
  if (!text) return [];
  const parts: LinkPart[] = [];
  let at = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const [url, tail] = trimTrailingPunctuation(m[0]);
    // A match that is nothing but punctuation after the scheme is not a link.
    if (!url || url === "http://" || url === "https://") continue;
    if (start > at) parts.push({ type: "text", value: text.slice(at, start) });
    parts.push({ type: "link", value: url });
    if (tail) parts.push({ type: "text", value: tail });
    at = start + m[0].length;
  }
  if (at < text.length) parts.push({ type: "text", value: text.slice(at) });
  return parts;
}
