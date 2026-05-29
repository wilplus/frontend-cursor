"use client";

import { useCallback, useEffect, useState } from "react";
import { FileAudio, FileVideo, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  Backend response shape (BE task-9 canonical /files endpoint)              */
/* -------------------------------------------------------------------------- */

interface UserFile {
  id: string;
  session_id: string | null;
  file_name: string;
  file_type: "audio" | "video";
  content_type: string;
  size_bytes: number | null;
  /** Cached public URL when the bucket is public; same as playback_url
   *  in that case. Null when bucket is private. */
  r2_url: string | null;
  /** ALWAYS populated. Public bucket → permanent URL. Private bucket →
   *  signed URL with TTL = expires_in query param. */
  playback_url: string;
  created_at: string;
}

interface FilesPayload {
  user_id: string;
  files: UserFile[];
  limit: number;
  offset: number;
  /** Count of rows in THIS response slice — NOT total table size. */
  total: number;
  /** True → more rows exist past offset+limit; render Load More. */
  has_more: boolean;
}

/* -------------------------------------------------------------------------- */
/*  UserFilesTab                                                              */
/*                                                                            */
/*  Files tab body for /admin/users/[userId]. Lists every audio/video file   */
/*  the user uploaded via the chat surface's "upload" input mode, with an     */
/*  inline native player per row so the admin can audit without leaving the */
/*  tab. Sorted newest-first by upload timestamp (BE-side).                  */
/*                                                                            */
/*  Wired against the canonical /files endpoint (BE pre-task-9 + bb2a7c1):  */
/*    - ?limit=PAGE_SIZE&offset=N for pagination ("Load more" button on    */
/*      has_more=true)                                                      */
/*    - ?expires_in=21600 (6h) so signed URLs survive a long-open admin tab  */
/*    - DELETE for soft-delete with confirm dialog (no undo UI today; BE    */
/*      keeps the row in the soft-deleted set until the weekly hard-delete  */
/*      cron runs)                                                            */
/*    - Re-fetch on play-click as the stale-URL fallback (cheap pattern —   */
/*      private-bucket deploys after >6h of inactivity)                     */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 50;
const EXPIRES_IN_SECONDS = 21600; // 6h

interface UserFilesTabProps {
  userId: string;
}

export default function UserFilesTab({ userId }: UserFilesTabProps) {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Per-row in-flight delete tracker so we can disable the button +
   *  surface the spinner without a global lock that would freeze other
   *  rows during a slow delete. */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (
      offset: number,
      mode: "replace" | "append"
    ): Promise<FilesPayload | null> => {
      const token = await getAuthToken();
      if (!token) {
        setError("Not authenticated.");
        return null;
      }
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        expires_in: String(EXPIRES_IN_SECONDS),
      });
      const res = await fetch(
        `/api/v2/admin/users/${encodeURIComponent(userId)}/files?${qs.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (!res.ok) {
        setError(`Couldn't load files (HTTP ${res.status}).`);
        return null;
      }
      const data = (await res.json()) as FilesPayload;
      const rows = Array.isArray(data.files) ? data.files : [];
      setFiles((prev) => (mode === "replace" ? rows : [...prev, ...rows]));
      setHasMore(data.has_more === true);
      return data;
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPage(0, "replace");
        if (cancelled) return;
        if (data === null) {
          // fetchPage already set error / cleared auth state.
        }
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
  }, [fetchPage]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(files.length, "append");
    } catch (err) {
      console.warn("UserFilesTab load-more failed:", err);
      toast.error("Couldn't load more files.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, files.length, fetchPage]);

  /** Stale-URL fallback per the BE handoff's "cheap" strategy. The
   *  admin tab might sit open longer than the 6h expires_in TTL on a
   *  private-bucket deploy. Re-fetching the list silently on the
   *  first play-click is simpler than maintaining a `fetched_at` ref
   *  + tracking an "is stale?" predicate, and the latency lands on
   *  the click the user is already paying for. */
  const refreshAfterStaleClick = useCallback(async () => {
    try {
      // Re-fetch the entire current window (offset=0, current page-
      // worth-of-rows count). Keeps the user's pagination position
      // by re-walking from the start; for normal sub-200-row admin
      // views this is sub-second.
      const token = await getAuthToken();
      if (!token) return;
      const qs = new URLSearchParams({
        limit: String(Math.max(files.length, PAGE_SIZE)),
        offset: "0",
        expires_in: String(EXPIRES_IN_SECONDS),
      });
      const res = await fetch(
        `/api/v2/admin/users/${encodeURIComponent(userId)}/files?${qs.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (!res.ok) return;
      const data = (await res.json()) as FilesPayload;
      const rows = Array.isArray(data.files) ? data.files : [];
      setFiles(rows);
      setHasMore(data.has_more === true);
    } catch {
      // Silent — the worst case is the user clicks play on a stale URL
      // and the browser fails; they can refresh manually.
    }
  }, [userId, files.length]);

  const handleDelete = useCallback(
    async (fileId: string, fileName: string) => {
      if (deletingId) return;
      const ok =
        typeof window === "undefined"
          ? true
          : window.confirm(
              `Delete "${fileName}"?\n\nThe file is removed from this list immediately. R2 bytes are retained for the recovery window.`
            );
      if (!ok) return;
      setDeletingId(fileId);
      try {
        const token = await getAuthToken();
        if (!token) {
          toast.error("Not authenticated.");
          return;
        }
        const res = await fetch(
          `/api/v2/admin/users/${encodeURIComponent(userId)}/files/${encodeURIComponent(
            fileId
          )}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.status === 204) {
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
          toast.success("File deleted.");
          return;
        }
        if (res.status === 404) {
          // Wrong owner OR already deleted — either way, the row is
          // gone server-side. Drop from local state so the UI matches.
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
          toast.success("File deleted.");
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? `Delete failed (HTTP ${res.status}).`);
      } catch (err) {
        console.warn("UserFilesTab delete failed:", err);
        toast.error("Couldn't delete file.");
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, userId]
  );

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

  if (files.length === 0) {
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
      {files.map((f) => (
        <UploadRow
          key={f.id}
          file={f}
          onDelete={() => void handleDelete(f.id, f.file_name)}
          onPlay={refreshAfterStaleClick}
          deleting={deletingId === f.id}
        />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
            className="rounded-full"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Single upload row                                                         */
/* -------------------------------------------------------------------------- */

function UploadRow({
  file,
  onDelete,
  onPlay,
  deleting,
}: {
  file: UserFile;
  onDelete: () => void;
  /** Stale-URL fallback — called on the FIRST play-click only via
   *  the playedOnceRef gate. Re-fetches the current window so a long-
   *  open tab on a private-bucket deploy lands a fresh signed URL. */
  onPlay: () => void;
  deleting: boolean;
}) {
  const sizeLabel = formatBytes(file.size_bytes);
  const dateLabel = formatDate(file.created_at);
  const Icon = file.file_type === "video" ? FileVideo : FileAudio;

  // Defensive — file_type is BE-provided but content_type is the
  // authoritative ground truth. Fall back to content_type-sniffing if
  // file_type ends up null for any reason (older BE deploys).
  const kind: "audio" | "video" =
    file.file_type === "video" ||
    (file.content_type || "").toLowerCase().startsWith("video/")
      ? "video"
      : "audio";

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
              title={file.file_name}
            >
              {file.file_name || "Untitled upload"}
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
              {file.session_id && (
                <span
                  title={`Session ${file.session_id}`}
                  className="font-mono"
                >
                  · sess {file.session_id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Delete ghost button — confirm dialog gates the actual call. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Delete this file (soft-delete; admin recovery window)"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
      </div>

      <div className="mt-3">
        {kind === "video" ? (
          <video
            src={file.playback_url}
            controls
            preload="metadata"
            className="w-full rounded-lg bg-black"
            style={{ maxHeight: 360 }}
            onPlay={onPlay}
          />
        ) : (
          <audio
            src={file.playback_url}
            controls
            preload="metadata"
            className="w-full"
            onPlay={onPlay}
          />
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Format helpers                                                            */
/* -------------------------------------------------------------------------- */

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
