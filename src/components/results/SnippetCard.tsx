"use client";

interface SnippetData {
  id: string;
  session_id: string;
  user_id: string;
  recording_id: string;
  start_offset_ms: number;
  duration_ms: number;
  audio_segment_path: string;
  snippet_type: string;
  admin_comment: string | null;
  admin_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SnippetCardProps {
  snippet: SnippetData;
}

export default function SnippetCard({ snippet }: SnippetCardProps) {
  const durationSeconds = (snippet.duration_ms / 1000).toFixed(1);
  const typeColor =
    snippet.snippet_type === "charisma"
      ? "bg-green-100 text-green-800"
      : snippet.snippet_type === "stress"
        ? "bg-amber-100 text-amber-800"
        : "bg-gray-100 text-gray-800";

  const typeLabel =
    snippet.snippet_type === "charisma"
      ? "Charisma Moment"
      : snippet.snippet_type === "stress"
        ? "Stress Pattern"
        : "Unlabeled";

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      {/* Audio Player */}
      <div>
        <audio
          src={snippet.audio_segment_path}
          controls
          className="w-full"
          controlsList="nodownload"
        />
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}>{typeLabel}</span>
        <p className="text-xs text-muted-foreground">
          {durationSeconds}s · Offset {(snippet.start_offset_ms / 1000).toFixed(1)}s
        </p>
      </div>

      {/* Admin Comment */}
      {snippet.admin_comment && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-4">
          <p className="text-xs font-semibold text-muted-foreground">Feedback</p>
          <p className="text-sm text-foreground">{snippet.admin_comment}</p>
        </div>
      )}
    </div>
  );
}
