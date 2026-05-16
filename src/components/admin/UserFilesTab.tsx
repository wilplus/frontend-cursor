"use client";

import { useEffect, useState } from "react";
import { FileAudio, FileVideo, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  Backend response shape                                                    */
/* -------------------------------------------------------------------------- */

interface UserUpload {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number | null;
  file_url: string;
  duration_seconds: number | null;
  session_id: string | null;
  created_at: string;
}

interface UploadsPayload {
  uploads: UserUpload[];
}

/* -------------------------------------------------------------------------- */
/*  UserFilesTab                                                              */
/*                                                                            */
/*  Files tab body for /admin/users/[userId]. Lists every audio/video file   */
/*  the user uploaded via the chat surface's "upload" input mode, with an     */
/*  inline native player per row so the admin can audit the file without     */
/*  leaving the tab. Sorted newest-first by upload timestamp (assumes the    */
/*  backend already orders the list; falls back to a client sort).           */
/* -------------------------------------------------------------------------- */

interface UserFilesTabProps {
  userId: string;
}

export default function UserFilesTab({ userId }: UserFilesTabProps) {
  const [uploads, setUploads] = useState<UserUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getAuthToken();
        if (!token) {
          setError("Not authenticated.");
          return;
        }
        const res = await fetch(
          `/api/v2/admin/users/${encodeURIComponent(userId)}/uploads`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(`Couldn't load files (HTTP ${res.status}).`);
          return;
        }
        const data = (await res.json()) as UploadsPayload;
        if (cancelled) return;
        const rows = Array.isArray(data.uploads) ? data.uploads : [];
        // Defensive sort: newest first by ISO timestamp.
        rows.sort((a, b) => {
          const ta = new Date(a.created_at || 0).getTime();
          const tb = new Date(b.created_at || 0).getTime();
          return tb - ta;
        });
        setUploads(rows);
      } catch (err) {
        if (!cancelled) {
          console.warn("UserFilesTab load failed:", err);
          setError("Couldn't load files.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          This user hasn&apos;t uploaded any files yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {uploads.map((u) => (
        <UploadRow key={u.id} upload={u} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Single upload row                                                         */
/* -------------------------------------------------------------------------- */

function UploadRow({ upload }: { upload: UserUpload }) {
  const kind = classifyContentType(upload.content_type);
  const sizeLabel = formatBytes(upload.size_bytes);
  const dateLabel = formatDate(upload.created_at);
  const Icon = kind === "video" ? FileVideo : FileAudio;

  return (
    <Card className="rounded-2xl border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              kind === "video"
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold text-foreground"
              title={upload.filename}
            >
              {upload.filename || "Untitled upload"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <Badge
                variant="outline"
                className={
                  kind === "video"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "bg-muted"
                }
              >
                {kind === "video" ? "Video" : "Audio"}
              </Badge>
              <span>{dateLabel}</span>
              {sizeLabel && <span>· {sizeLabel}</span>}
              {upload.session_id && (
                <span
                  title={`Session ${upload.session_id}`}
                  className="font-mono"
                >
                  · sess {upload.session_id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        {kind === "video" ? (
          <video
            src={upload.file_url}
            controls
            preload="metadata"
            className="w-full rounded-lg bg-black"
            style={{ maxHeight: 360 }}
          />
        ) : (
          <audio
            src={upload.file_url}
            controls
            preload="metadata"
            className="w-full"
          />
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Format helpers                                                            */
/* -------------------------------------------------------------------------- */

function classifyContentType(ct: string | null | undefined): "audio" | "video" {
  const lower = (ct || "").toLowerCase();
  if (lower.startsWith("video/")) return "video";
  return "audio";
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
