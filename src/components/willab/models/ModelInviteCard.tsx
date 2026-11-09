"use client";

import { useEffect, useState } from "react";
import { getModelInvite, type ModelInvite } from "@/services/api/models";

/* -------------------------------------------------------------------------- */
/*  An invite to teach, as it stays in the chat (backend N528 item 3,         */
/*  MOD-49; the locked prototype's p:1): "Maya invited you to teach Pitch     */
/*  Coach with them." and, after Not now, "You said not now. The invite stays */
/*  here; open it whenever you like." with "Open". Every word is the          */
/*  backend's (invite_card). Nothing below ring 6, and nothing for anyone     */
/*  but the person invited (both answer 404).                                 */
/*                                                                            */
/*  A chat's messages do not carry an invite yet; the chat draws this once    */
/*  they do (the backend's invites table, migration 0516).                    */
/* -------------------------------------------------------------------------- */

export default function ModelInviteCard({ inviteId, onOpen }: { inviteId: string; onOpen: () => void }) {
  const [invite, setInvite] = useState<ModelInvite | null>(null);
  useEffect(() => {
    let alive = true;
    void getModelInvite(inviteId).then((got) => {
      if (alive) setInvite(got);
    });
    return () => {
      alive = false;
    };
  }, [inviteId]);
  if (!invite) return null;
  const [first, ...rest] = invite.lines;
  return (
    <div data-model-invite className="flex max-w-[86%] flex-col gap-1.5 self-start px-1 py-1">
      <p className="m-0 text-[16px] leading-snug text-foreground">{first}</p>
      {rest.map((line) => (
        <p key={line} className="m-0 text-[14px] leading-snug text-muted-foreground">{line}</p>
      ))}
      <button type="button" onClick={onOpen} className="mt-1 self-start rounded-full bg-primary px-5 py-2.5 text-[16px] font-semibold text-primary-foreground">
        {invite.action}
      </button>
    </div>
  );
}
