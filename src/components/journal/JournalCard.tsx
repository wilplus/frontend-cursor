import Link from "next/link";
import { Play, Volume2 } from "lucide-react";
import {
  categoryLabel,
  formatDuration,
  type JournalPostSummary,
} from "@/services/api/journal";

/* -------------------------------------------------------------------------- */
/*  JournalCard — one post in the index grid (and in a post's "related" row)   */
/*                                                                            */
/*  Deliberately hook-free and handler-free so it renders from BOTH the client  */
/*  index (search/filter state) and the server post page (related posts).      */
/*                                                                            */
/*  Palette: neutral only. `primary` (orange) is reserved for live-action       */
/*  signals elsewhere in the app and must never appear in the Journal.         */
/* -------------------------------------------------------------------------- */

/** Decorative stand-in for an audio-only cover. Heights are DETERMINISTIC (a
 *  fixed formula, never Math.random) so server and client markup agree. */
function Waveform() {
  const bars = Array.from({ length: 40 }, (_, i) => {
    // Two out-of-phase sines: an organic-looking but stable envelope.
    const wave = Math.sin(i * 0.55) * 0.5 + Math.sin(i * 0.23) * 0.5;
    return Math.round(24 + ((wave + 1) / 2) * 56); // 24% … 80%
  });
  return (
    <div
      className="flex h-full w-full items-center justify-center gap-[3px] px-6"
      aria-hidden
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-foreground/60"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export default function JournalCard({ post }: { post: JournalPostSummary }) {
  const duration = formatDuration(post.mediaDurationSec);
  const isAudio = post.coverKind === "audio";
  const isVideo = post.coverKind === "video";
  const showWaveform = isAudio && !post.coverImageUrl;

  return (
    <Link href={`/blog/${post.slug}`} className="group block no-underline">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
        {post.coverImageUrl ? (
          // Plain <img>: covers are arbitrary remote URLs and next.config sets
          // no image domains, so next/image would reject them at runtime.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.coverAlt ?? ""}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : showWaveform ? (
          <div className="h-full w-full bg-journal-media">
            <Waveform />
          </div>
        ) : null}

        {isVideo || isAudio ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] text-foreground shadow-sm">
            {isVideo ? (
              <Play className="h-3 w-3" aria-hidden />
            ) : (
              <Volume2 className="h-3 w-3" aria-hidden />
            )}
            {isVideo ? "Video" : duration ? `Audio · ${duration}` : "Audio"}
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {categoryLabel(post.category)}
        {post.readTimeMin ? ` · ${post.readTimeMin} min read` : ""}
      </p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-foreground underline-offset-4 group-hover:underline">
        {post.title}
      </h3>
      {post.excerpt ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
          {post.excerpt}
        </p>
      ) : null}
    </Link>
  );
}
