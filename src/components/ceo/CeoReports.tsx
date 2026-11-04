"use client";

/* -------------------------------------------------------------------------- */
/*  Reports in the CEO panel (backend N466; rules:                            */
/*  docs/flows/customer-requests.md §1 C1). Each report a person made from    */
/*  someone's profile in their chats, newest first: who reported whom, when,  */
/*  🚫 when they blocked them too, and the chat's last five messages (each    */
/*  author with its words, an emoji, a voice note's words, a photo or a       */
/*  file's name). "Mark as read" once a person has read it, within a day.     */
/*  Admin-only words, kept to three: "Reports", "Mark as read", "No reports   */
/*  yet." The backend checks the founder for itself.                         */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PHOTO_LINE, VOICE_MESSAGE_LINE, fileLine } from "@/components/willab/chats/ChatList";
import { getChatReports, markChatReportHandled, type ChatReport, type ChatReportMessage } from "@/services/api/chats";

export const REPORTS = "Reports";
const MARK_AS_READ = "Mark as read";
const NO_REPORTS = "No reports yet.";

const when = (at: string) => {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/** One message as the chat said it: its words, or the line the list uses. */
function said(message: ChatReportMessage): string {
  if (message.kind === "voice") return message.words?.trim() ? `🎤 ${message.words.trim()}` : VOICE_MESSAGE_LINE;
  if (message.kind === "photo") return PHOTO_LINE;
  if (message.kind === "file") return fileLine(message.body);
  return message.body;
}

const newestFirst = (reports: ChatReport[]) => [...reports].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

export default function CeoReports() {
  const [reports, setReports] = useState<ChatReport[] | null>(null);
  useEffect(() => {
    let alive = true;
    void getChatReports().then((got) => {
      if (alive) setReports(newestFirst(got ?? []));
    });
    return () => {
      alive = false;
    };
  }, []);

  const markRead = async (id: string) => {
    const at = await markChatReportHandled(id);
    if (at) setReports((list) => (list ?? []).map((r) => (r.id === id ? { ...r, handled_at: at } : r)));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="border-b border-border pb-4 text-2xl font-semibold tracking-tight">{REPORTS}</h2>
      {reports === null ? null : reports.length === 0 ? (
        <p className="py-14 text-center text-sm text-muted-foreground">{NO_REPORTS}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {reports.map((report) => (
            <article
              key={report.id}
              data-ceo-report={report.id}
              className={cn("rounded-2xl border border-border bg-background p-4", report.handled_at && "opacity-60")}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold leading-snug">
                  {report.reporter} → {report.reported}
                  {report.blocked ? <span className="ml-1.5">🚫</span> : null}
                </h3>
                <span className="text-xs text-muted-foreground">{when(report.created_at)}</span>
              </div>
              <ol className="mt-3 space-y-1.5 text-sm leading-6">
                {report.messages.map((message, i) => (
                  <li key={`${message.created_at}-${i}`} className="flex gap-2">
                    <span className="shrink-0 font-medium">{message.author}:</span>
                    <span className="min-w-0 whitespace-pre-wrap break-words">{said(message)}</span>
                  </li>
                ))}
              </ol>
              {report.handled_at ? null : (
                <div className="mt-4 border-t border-border pt-3">
                  <button
                    type="button"
                    data-ceo-report-read=""
                    onClick={() => void markRead(report.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
                  >
                    {MARK_AS_READ}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
