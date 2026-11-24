/* -------------------------------------------------------------------------- */
/*  The chat's one link (backend N691 item 3).                                */
/*                                                                            */
/*  `/chat?take=<session_id>` opens the chat on that Take's coach bubble, or  */
/*  the newest one. It is what the coach's WhatsApp message, push and email   */
/*  send. `session` is its old name. Links already sent keep working: the    */
/*  coach's old `lens` and `idealArc` open the chat on the coach's bubble     */
/*  (their `take`, else the newest), and every old parameter leaves the       */
/*  address. No project is addressed by its arc; no screen opens.             */
/* -------------------------------------------------------------------------- */

/** Parameters of links already sent; read once, then dropped. */
export const OLD_CHAT_PARAMS = ["session", "lens", "idealArc", "arc", "mode", "feedback", "insight"] as const;

/** The coach's old links: they opened the coach's feedback. */
const OLD_COACH_PARAMS = ["lens", "idealArc"] as const;

export type ChatLink = {
  /** The Take the link names, or null. */
  take: string | null;
  /** The link asks for the coach's bubble (the Take's, else the newest). */
  coach: boolean;
};

type Read = (name: string) => string | null;

/** What a /chat address asks for. Pure. */
export function chatLinkOf(read: Read): ChatLink {
  const take = read("take") || read("session") || null;
  const coach = take !== null || OLD_COACH_PARAMS.some((name) => Boolean(read(name)));
  return { take, coach };
}

/** The address with only `take` left of the link's parameters. Pure. */
export function chatLinkHref(href: string): string {
  const url = new URL(href);
  const { take } = chatLinkOf((name) => url.searchParams.get(name));
  for (const name of OLD_CHAT_PARAMS) url.searchParams.delete(name);
  url.searchParams.delete("take");
  if (take) url.searchParams.set("take", take);
  return `${url.pathname}${url.search}${url.hash}`;
}
