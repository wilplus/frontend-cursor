"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { VoiceMark } from "@/components/willab/LoadingState";
import { fetchUserAudits, type UserAudit } from "@/services/api/userAudits";

function auditDateLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AuditsPageClient() {
  const [audits, setAudits] = useState<UserAudit[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    void fetchUserAudits().then((a) => {
      setAudits(a);
      setStatus("ready");
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center border-b border-border px-4">
        <Link
          href="/chat"
          className="flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <span className="ml-4 text-[15px] font-semibold text-foreground">
          Audits
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {status === "loading" ? (
          <div className="flex items-center justify-center py-16">
            <VoiceMark size={40} />
          </div>
        ) : audits.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {audits.map((audit) => (
              <li key={audit.id}>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <FileText
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {audit.name}
                    </p>
                    {auditDateLabel(audit.date) ? (
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {auditDateLabel(audit.date)}
                      </p>
                    ) : null}
                  </div>
                  {audit.pdfUrl ? (
                    <a
                      href={audit.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-primary/50"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
