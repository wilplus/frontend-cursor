/* -------------------------------------------------------------------------- */
/*  SHARING A TAKE, AT THE END OF THE FEEDBACK WALK (build plan D-FW-20;       */
/*  founder lock 2026-10-06, flow 11; N52.4, CM2 B, WQ5 A, WQ6 A, Q-B6 A,       */
/*  S-B6 A).                                                                   */
/*                                                                            */
/*  Pure: what the ticks and fields on the sharing screen ask the server to   */
/*  do, in order, and which signed message a refusal shows. The screen's     */
/*  words are WALK_COPY's; this file only names the version of them the      */
/*  speaker saw, which every share records (take_shares.share_words_version, */
/*  migration 0443; the server accepts only Config.SHARE_WORDS_VERSIONS).    */
/*                                                                            */
/*    general  share with the general community.                             */
/*    mine     join a community by its pass code, then share with it.        */
/*    own      set up a community with a name and a pass code, then share    */
/*             with it.                                                      */
/*    none     stands alone: takes the share back from every community.     */
/*                                                                            */
/*  A community set up or joined here is remembered for the screen's next   */
/*  try, so a share refused after it (the Terms) does not set it up twice.  */
/*  No number reaches a screen (AC-9).                                       */
/* -------------------------------------------------------------------------- */

import type { Outcome } from "@/services/api/practiceCheck";

/** The version of the sharing screen's words this build shows: the
 *  founder's signed words of 2026-10-06 (N54, WQ5 A / WQ6 A; "None" S-B6 A).
 *  Change it only together with the words, and with the server's list. */
export const SHARE_WORDS_VERSION = "sharing-screen-2026-10-06";

/** The server's shortest pass code (services/communities.PASS_CODE_MIN). */
export const SHARE_PASS_CODE_MIN = 6;

export type ShareTick = "general" | "mine" | "own" | "none";

export type ShareFields = {
  /** "Only my community": its pass code. */
  minePassCode: string;
  /** "Set up my own community": its name and pass code. */
  ownName: string;
  ownPassCode: string;
};

export const EMPTY_SHARE_FIELDS: ShareFields = { minePassCode: "", ownName: "", ownPassCode: "" };

/** Which signed message a refusal shows (WQ6 A). */
export type ShareRefusal = "passCodeTaken" | "passCodeUnknown" | "acceptTerms" | "failed";

export type ShareRunResult = { ok: true } | { ok: false; refusal: ShareRefusal };

/** The calls a share makes; the screen's host gives the real ones. */
export type ShareIO = {
  join: (passCode: string) => Promise<Outcome<{ id: string }>>;
  create: (name: string, passCode: string) => Promise<Outcome<{ id: string }>>;
  share: (choice: {
    general: boolean;
    communityIds: string[];
    none: boolean;
    shareWordsVersion: string | null;
  }) => Promise<Outcome<unknown>>;
};

/** What this screen has already set up or joined, by the code typed. */
export type ShareMemo = {
  joined: Record<string, string>;
  created: Record<string, string>;
};

export const newShareMemo = (): ShareMemo => ({ joined: {}, created: {} });

const filled = (value: string) => value.trim().length > 0;
const longEnough = (value: string) => value.trim().length >= SHARE_PASS_CODE_MIN;

/** Continue is on when something is ticked and every ticked field is
 *  filled; a pass code has the server's six characters. Pure. */
export function shareReady(ticks: readonly string[], fields: ShareFields): boolean {
  if (ticks.length === 0) return false;
  if (ticks.includes("mine") && !longEnough(fields.minePassCode)) return false;
  if (ticks.includes("own") && (!filled(fields.ownName) || !longEnough(fields.ownPassCode))) return false;
  return true;
}

const memoKey = (name: string, passCode: string) => `${name.trim()}\u0000${passCode.trim()}`;

/** Run the speaker's choice: join, set up, then one share that names every
 *  community chosen; "None" alone takes the share back. Stops at the first
 *  refusal with the message it shows. */
export async function runShare(
  io: ShareIO,
  ticks: readonly string[],
  fields: ShareFields,
  memo: ShareMemo,
): Promise<ShareRunResult> {
  if (ticks.includes("none")) {
    const res = await io.share({ general: false, communityIds: [], none: true, shareWordsVersion: null });
    return res.ok ? { ok: true } : { ok: false, refusal: "failed" };
  }
  const ids: string[] = [];
  if (ticks.includes("mine")) {
    const code = fields.minePassCode.trim();
    let id = memo.joined[code];
    if (!id) {
      const res = await io.join(code);
      if (!res.ok || !res.data.id) {
        const unknown = !res.ok && (res.status === 404 || res.code === "PASS_CODE_INVALID");
        return { ok: false, refusal: unknown ? "passCodeUnknown" : "failed" };
      }
      id = res.data.id;
      memo.joined[code] = id;
    }
    ids.push(id);
  }
  if (ticks.includes("own")) {
    const key = memoKey(fields.ownName, fields.ownPassCode);
    let id = memo.created[key];
    if (!id) {
      const res = await io.create(fields.ownName.trim(), fields.ownPassCode.trim());
      if (!res.ok || !res.data.id) {
        return { ok: false, refusal: !res.ok && res.code === "PASS_CODE_TAKEN" ? "passCodeTaken" : "failed" };
      }
      id = res.data.id;
      memo.created[key] = id;
    }
    if (!ids.includes(id)) ids.push(id);
  }
  const res = await io.share({
    general: ticks.includes("general"),
    communityIds: ids,
    none: false,
    shareWordsVersion: SHARE_WORDS_VERSION,
  });
  if (res.ok) return { ok: true };
  return { ok: false, refusal: res.code === "TERMS_REACCEPT_REQUIRED" ? "acceptTerms" : "failed" };
}
