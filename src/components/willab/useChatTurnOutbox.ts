"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { postChatQuery, type ChatQueryResponse } from "@/services/api/chatQuery";
import { attachChatVoice } from "@/services/api/willQuestion";
import { dropNote, readChatReplyAudio } from "@/lib/willab/voiceNoteOutbox";
import {
  newestStamp, stampLoungeMessage, type LoungeMessage, type LoungeMessageDraft,
} from "@/services/api/loungeMessages";
import { LOUNGE_LOCAL_TTL_MS, LOUNGE_THREAD_MERGED_EVENT } from "@/lib/funnel/loungeLocalThread";
import type { RecoverableAppend, UseLoungeThreadReturn } from "./useLoungeThread";

import {
  chatTurnKey, chatTurnRevision, notifyChatTurns, readChatTurns, replaceChatTurn, subscribeToChatTurns,
  type ChatTurnRequest, type PendingChatTurn,
} from "@/lib/willab/chatTurnOutbox";
export type { PendingChatTurn } from "@/lib/willab/chatTurnOutbox";

const active = new Set<string>();
const serverSnapshot = () => 0;

function exactDraft(message: LoungeMessage): LoungeMessageDraft {
  return { ...message, clientId: message.client_id, clientCreatedAt: message.client_created_at };
}

/** Keep only unfinished requests in this tab. Reading the outbox never sends
 * words to the server. Each retry reuses the history, scope and identity from
 * submission, even if the screen or the selected project has since changed. */
export function useChatTurnOutbox(thread: UseLoungeThreadReturn, userId: string | null, conversation: string) {
  const owner = thread.signedIn ? userId : "guest";
  const key = owner ? chatTurnKey(owner, conversation) : null;
  const current = useRef(key);
  current.current = key;
  useEffect(() => {
    current.current = key;
    return () => { current.current = null; };
  }, [key]);
  const version = useSyncExternalStore(subscribeToChatTurns, chatTurnRevision, serverSnapshot);
  const saved = useMemo(() => key ? readChatTurns(key) : [], [key, version]);
  const writes = useRef(new Map<string, RecoverableAppend>());
  const settled = useMemo(() => {
    const localReplies = new Set(saved.map((turn) => turn.confirmedReply?.client_id));
    const bots = thread.messages.filter((row) => row.role === "bot" && (row.id || !localReplies.has(row.client_id)));
    const ids = new Set(bots.map((m) => m.metadata?.reply_to_client_id));
    const persisted = new Set(bots.filter((m) => m.id).map((m) => m.client_id));
    return saved.filter((t) => ids.has(t.user.client_id) ||
      (t.confirmedReply && persisted.has(t.confirmedReply.client_id)) ||
      (!thread.signedIn && Date.parse(t.user.client_created_at) < Date.now() - LOUNGE_LOCAL_TTL_MS));
  }, [saved, thread.messages, thread.signedIn]);
  useEffect(() => {
    if (!key) return;
    for (const turn of settled) {
      writes.current.delete(turn.user.client_id);
      if (turn.user.metadata?.voice_clip === true) void dropNote(turn.user.client_id);
      replaceChatTurn(key, turn.user.client_id);
    }
  }, [key, settled]);
  const kept = useMemo(() => saved.filter((t) => !settled.includes(t)), [saved, settled]);
  const turns = useMemo(() => kept.filter((t) => !t.confirmedReply), [kept]);
  const messages = useMemo(() => {
    const ids = new Set(thread.messages.map((m) => m.client_id));
    const missing = kept.flatMap((t) => t.confirmedReply ? [t.user, t.confirmedReply] : [t.user])
      .filter((m) => !ids.has(m.client_id));
    return missing.length ? [...thread.messages, ...missing] : thread.messages;
  }, [thread.messages, kept]);

  function begin(draft: string, userDraft: LoungeMessageDraft, question: LoungeMessage | null, request: ChatTurnRequest) {
    if (!key) throw new Error("Chat owner is still loading");
    const user = thread.appendRecoverable(userDraft);
    writes.current.set(user.message.client_id, user);
    const turn = { user: user.message, draft, question, request };
    replaceChatTurn(key, user.message.client_id, turn);
    return turn;
  }

  function forget(turn: PendingChatTurn) {
    writes.current.delete(turn.user.client_id);
    if (turn.user.metadata?.voice_clip === true) void dropNote(turn.user.client_id);
    if (key) replaceChatTurn(key, turn.user.client_id);
  }

  async function deliver(turn: PendingChatTurn, replyOf: (response: ChatQueryResponse) => LoungeMessageDraft) {
    const id = turn.user.client_id;
    if (!key || active.has(id)) return null;
    active.add(id);
    notifyChatTurns();
    try {
      let user = writes.current.get(id);
      if (!user) {
        user = thread.appendRecoverable(exactDraft(turn.user));
        writes.current.set(id, user);
      }
      // The signed-in query commits both rows. Its acknowledgement is
      // sufficient even if the parallel optimistic append is still waiting.
      const stored = user.retry();
      if (turn.user.metadata?.voice_clip === true) {
        if (!(await stored) || !owner || !turn.request.voiceReceipt) throw new Error("Spoken message was not kept");
        const audio = await readChatReplyAudio(id, owner);
        if (!audio || !await attachChatVoice(id, audio, turn.request.voiceReceipt)) {
          throw new Error("Spoken recording was not attached");
        }
      }
      const response: ChatQueryResponse = turn.reply ? {} : await postChatQuery({
        ...turn.request, clientId: id, clientCreatedAt: turn.user.client_created_at,
      });
      if (response.outcome === "recoverable_error" || response.failure) {
        throw new Error(response.failure?.code ?? "Chat reply could not complete");
      }
      if (thread.signedIn && response.persisted !== true) throw new Error("Chat turn was not persisted");
      if (current.current !== key) {
        // The server may have answered during navigation. The current view
        // reconciles from its own authenticated history.
        if (response.persisted) window.dispatchEvent(new Event(LOUNGE_THREAD_MERGED_EVENT));
        return null;
      }
      let reply: LoungeMessage;
      if (thread.signedIn) {
        const draft = replyOf(response);
        reply = thread.appendLocalOnly({ ...draft, clientId: response.persisted_client_id,
          metadata: { ...draft.metadata, reply_to_client_id: id } });
      } else {
        reply = turn.reply ?? stampLoungeMessage(replyOf(response), newestStamp([...messages, turn.user]));
        replaceChatTurn(key, id, { ...turn, reply });
        const written = await thread.appendRecoverable(exactDraft(reply)).stored;
        if (!written || !(await stored)) throw new Error("Local chat turn was not persisted");
      }
      if (response.persisted_client_id) {
        if (turn.user.metadata?.voice_clip === true) void dropNote(id);
        writes.current.delete(id);
        replaceChatTurn(key, id, { ...turn, request: { question: turn.request.question }, confirmedReply: reply });
      } else {
        forget(turn);
      }
      return { response, reply };
    } finally {
      active.delete(id);
      notifyChatTurns();
    }
  }

  return {
    ready: key !== null, messages, turns, begin, deliver, forget,
    processingVoice: turns.some((t) => t.user.metadata?.voice_clip === true && active.has(t.user.client_id)),
    waitingForHistory: thread.loading && kept.length === 0,
    readingHistory: thread.loading && !thread.unanswered,
    busy: (local: boolean) => local || turns.some((t) => active.has(t.user.client_id)),
    isSending: (t: PendingChatTurn) => active.has(t.user.client_id),
    isPending: (t: PendingChatTurn) => key !== null && current.current === key &&
      readChatTurns(key).some((savedTurn) => savedTurn.user.client_id === t.user.client_id && !savedTurn.confirmedReply),
    isCurrent: () => key !== null && current.current === key,
  };
}
