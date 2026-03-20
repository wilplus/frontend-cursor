"use client";

import { Play, ArrowRight, BookOpen } from "lucide-react";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import WillabLogo from "@/components/WillabLogo";

const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });
const dmSerif = DM_Serif_Display({ weight: "400", subsets: ["latin"], display: "swap" });

const DEFAULT_COACH_MESSAGE =
  "Good work. It is a small step for you, but a huge step for your progress!";

/**
 * Willab assignment email template — design reference for the backend.
 * Backend should replicate this layout and tokens in the HTML email sent on POST send-assignment.
 * - If videoUrl is set: show video thumbnail + play overlay (use videoThumbSrc if provided).
 * - If videoUrl is not set: show orange gradient block only.
 * - If coachMessage is not set: show DEFAULT_COACH_MESSAGE.
 * - If hasAssignedExercise: show line that exercise will be on main screen after following the link.
 */
export default function CoachEmail({
  videoUrl = null,
  videoThumbSrc = "/coach-video-thumb.jpg",
  videoDuration = "4:32",
  metaLabel = "Week 3 · Session Recap",
  title,
  studentName = "there",
  coachMessage = null,
  hasAssignedExercise = false,
  homeworkTitle = "New Homework Available",
  homeworkSubtitle = "Week 3 — Vocal Projection & Pause Technique",
  coachInitials = "LC",
  coachName = "Laura Chen",
  coachRole = "Public Speaking Coach",
}: {
  videoUrl?: string | null;
  videoThumbSrc?: string | null;
  videoDuration?: string | null;
  metaLabel?: string;
  /** Optional explicit title. If omitted, uses "Great progress, <studentName>!" */
  title?: string;
  /** Student name from DB; used in default title. */
  studentName?: string;
  /** Coach message body. If null/empty, shows default: "Good work. It is a small step for you, but a huge step for your progress!" */
  coachMessage?: string | null;
  /** If true, show a line that assigned exercise will appear on the main screen after following the link. */
  hasAssignedExercise?: boolean;
  homeworkTitle?: string;
  homeworkSubtitle?: string;
  coachInitials?: string;
  coachName?: string;
  coachRole?: string;
}) {
  const hasVideo = Boolean(videoUrl?.trim());
  const resolvedTitle = title?.trim() || `Great progress, ${studentName}!`;
  const bodyParagraphs = (coachMessage?.trim() || DEFAULT_COACH_MESSAGE)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className={`coach-email ${dmSans.className} bg-email-bg min-h-screen py-8 px-4`}>
      <div className="mx-auto max-w-[600px]">
        {/* Brand header */}
        <div className="text-center mb-6">
          <p className="text-foreground">
            <WillabLogo size="sm" />
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Homework tool for public speaking
          </p>
        </div>

        {/* Main email card */}
        <div
          className="bg-background rounded-xl overflow-hidden"
          style={{
            boxShadow: "0 1px 16px -4px hsl(var(--foreground) / 0.07)",
          }}
        >
          {/* Video block: thumbnail + play when videoUrl set, else orange gradient */}
          <div className="relative aspect-video w-full overflow-hidden group">
            {hasVideo ? (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: videoThumbSrc
                      ? `url(${videoThumbSrc})`
                      : undefined,
                    backgroundColor: !videoThumbSrc ? "hsl(var(--muted))" : undefined,
                  }}
                />
                <div
                  className="absolute inset-0 bg-foreground/20 group-hover:bg-foreground/35 transition-colors"
                  aria-hidden
                />
                <a
                  href={videoUrl!}
                  className="absolute inset-0 flex items-center justify-center no-underline text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full group"
                  aria-label="Watch video"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg scale-100 group-hover:scale-110 transition-transform">
                    <Play className="h-10 w-10 ml-1" fill="currentColor" />
                  </span>
                </a>
                {videoDuration && (
                  <span className="absolute bottom-2 right-2 rounded px-2 py-1 text-xs font-medium text-white bg-black/50 backdrop-blur-sm">
                    {videoDuration}
                  </span>
                )}
              </>
            ) : (
              <div
                className="absolute inset-0 bg-gradient-to-br from-primary via-orange-500 to-amber-600"
                aria-hidden
              />
            )}
          </div>

          {/* Email body */}
          <div className="px-10 py-10">
            <p className="text-sm font-medium text-muted-foreground">{metaLabel}</p>
            <h1 className={`${dmSerif.className} text-[28px] text-foreground mt-1 mb-6`}>
              {resolvedTitle}
            </h1>
            <div className="space-y-4 text-[15px] text-foreground/80">
              {bodyParagraphs.map((para, i) => (
                <p key={i} className="leading-relaxed">
                  {para.split(/(\d+:\d+)/g).map((part, j) =>
                    /^\d+:\d+$/.test(part) ? (
                      <span key={j} className="font-semibold text-foreground">
                        {part}
                      </span>
                    ) : (
                      part
                    )
                  )}
                </p>
              ))}
            </div>

            <div className="h-px bg-email-divider my-8" aria-hidden />

            {/* Homework CTA card */}
            <div className="bg-secondary rounded-lg p-6 flex gap-4 items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={`${dmSerif.className} text-lg font-semibold text-foreground`}>
                  {homeworkTitle}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {homeworkSubtitle}
                </p>
                {hasAssignedExercise && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You have an exercise assigned — it will appear on the main screen after you follow the link below.
                  </p>
                )}
                <a
                  href="#homework"
                  className="inline-flex items-center gap-2 mt-3 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground no-underline hover:bg-primary/90 transition-colors hover:gap-3"
                >
                  View Homework
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Coach footer */}
            <div className="flex items-center gap-3 pt-8 mt-8 border-t border-email-divider">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {coachInitials}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{coachName}</p>
                <p className="text-xs text-muted-foreground">{coachRole}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Email footer links */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          You received this because you&apos;re enrolled in a coaching program.
        </p>
        <p className="text-center text-xs text-muted-foreground mt-1">
          <a href="#unsubscribe" className="underline hover:text-foreground">
            Unsubscribe
          </a>
          {" · "}
          <a href="#preferences" className="underline hover:text-foreground">
            Preferences
          </a>
        </p>
      </div>
    </div>
  );
}
