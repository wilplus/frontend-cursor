"use client";

import { useEffect, useRef, useState } from "react";
import { getDrafts, sendDraft, type Draft } from "@/services/api/hostSetup";
import { W } from "./hostSetupCopy";
import { Btn, Card, Frame, Say, Two } from "./SetupBits";

/* -------------------------------------------------------------------------- */
/*  Drafted answers, one per screen (backend N618 item 9, "I draft, you      */
/*  send"; N629 item 3): "{name} asked:" with their message, "I'd answer:"   */
/*  with the draft and each model's line under it, then Change and Send.     */
/*  Change opens the words in place and Send sends the host's own. After the */
/*  last: "All sent.", "Each one you changed teaches me to answer like you." */
/*  and Done. Back goes one draft back and never sends a sent one again.     */
/* -------------------------------------------------------------------------- */

export default function HostDrafts({ onClose }: { onClose: () => void }) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [at, setAt] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(new Set<string>());
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    let alive = true;
    void getDrafts().then((got) => {
      if (!alive) return;
      if (!got) return closeRef.current();
      setDrafts(got);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!drafts) return null;
  if (at >= drafts.length) {
    return (
      <Frame onBack={() => drafts.length && setAt(drafts.length - 1)} foot={<Btn label={W.done} onClick={onClose} />}>
        <Say>{W.allSent}</Say>
        <Say>{W.eachChanged}</Say>
      </Frame>
    );
  }
  const draft = drafts[at];
  const next = () => {
    setEditing(null);
    setAt(at + 1);
  };
  const send = () => {
    if (busy) return;
    // Sent before (Back, then Send again): on, never a second time.
    if (sent.current.has(draft.message_id)) return next();
    const own = editing !== null && editing.trim() !== draft.answer ? editing.trim() : null;
    if (editing !== null && !editing.trim()) return;
    setBusy(true);
    void sendDraft(draft.message_id, own).then((ok) => {
      setBusy(false);
      if (!ok) return;
      sent.current.add(draft.message_id);
      next();
    });
  };
  const back = () => {
    if (editing !== null) return setEditing(null);
    if (at > 0) return setAt(at - 1);
    onClose();
  };
  return (
    <Frame
      onBack={back}
      foot={
        <Two
          left={<Btn out label={W.change} disabled={editing !== null || sent.current.has(draft.message_id)} onClick={() => setEditing(draft.answer)} />}
          right={<Btn label={W.send} disabled={busy} onClick={send} />}
        />
      }
    >
      <Say>{W.asked(draft.from)}</Say>
      <Card b={draft.said} />
      <Say>{W.wouldAnswer}</Say>
      {editing === null ? (
        <Card b={draft.answer} />
      ) : (
        <textarea
          data-draft-words=""
          value={editing}
          rows={4}
          onChange={(e) => setEditing(e.target.value)}
          className="min-h-[96px] w-full resize-y rounded-2xl border-[1.5px] border-foreground bg-background px-3.5 py-3 text-[16px] leading-snug outline-none"
        />
      )}
      {draft.lines.map((l, k) => (
        <Say key={k} by={l.by}>
          {l.body}
        </Say>
      ))}
    </Frame>
  );
}
