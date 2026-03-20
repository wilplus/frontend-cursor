"use client";

import WillabLogo from "@/components/WillabLogo";

type StudentCompletionEmailProps = {
  studentName?: string;
  scorePercent?: number;
  playbackUrl?: string;
  transcriptPreview?: string;
  fillerWordsTotal?: number;
  fillerWordsBreakdownText?: string;
  coachInsight?: string;
  coachName?: string;
  coachRole?: string;
  coachInitials?: string;
  /** Deep link to dashboard step 0 with reports visible + target report modal opened. */
  viewFullReportUrl?: string;
};

/**
 * Student completion email (reference layout for backend implementation).
 */
export default function StudentCompletionEmail({
  studentName = "there",
  scorePercent = 74,
  playbackUrl = "https://app.willonski.com/dashboard?showReports=1",
  transcriptPreview = '"Today I\'d like to share..."',
  fillerWordsTotal = 6,
  fillerWordsBreakdownText = "um 3, like 2, you know 1",
  coachInsight = "You had strong energy and clear intent. Focus next on slowing transitions between points and reducing filler words in openings.",
  coachName = "Laura Chen",
  coachRole = "Public Speaking Coach",
  coachInitials = "LC",
  viewFullReportUrl = "https://app.willonski.com/dashboard?showReports=1&openReportSessionId=SESSION_ID",
}: StudentCompletionEmailProps) {
  return (
    <div className="min-h-screen bg-[#f3f4f6] px-4 py-8">
      <div className="mx-auto max-w-[640px]">
        <div className="mb-6">
          <WillabLogo size="sm" />
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-[0_1px_16px_rgba(15,23,42,0.06)]">
          <h1 className="text-[36px] font-semibold leading-tight text-[#1f2a44]">
            Great work, {studentName}!
          </h1>
          <p className="mt-2 text-[28px] text-[#607089]">
            Your coach will contact you soon with feedback.
          </p>

          <div className="mt-6 rounded-xl bg-[#f8f9fb] p-6 text-center">
            <p className="text-[18px] uppercase tracking-[0.14em] text-[#8ea0ba]">Performance score</p>
            <p className="mt-2 text-[56px] font-semibold leading-none text-[#f97316]">{scorePercent}%</p>
          </div>

          <div className="my-7 h-px bg-[#e7edf3]" />

          <h2 className="text-[33px] font-semibold text-[#1f2a44]">Your report</h2>

          <div className="mt-4 space-y-0 text-[30px] text-[#607089]">
            <div className="grid grid-cols-[150px_1fr] items-center border-b border-[#e7edf3] py-3">
              <p>Playback</p>
              <a href={playbackUrl} className="text-right text-[#f97316] no-underline">
                Open recording →
              </a>
            </div>
            <div className="grid grid-cols-[150px_1fr] items-center border-b border-[#e7edf3] py-3">
              <p>Transcript</p>
              <p className="text-right italic text-[#90a0b5]">{transcriptPreview}</p>
            </div>
            <div className="grid grid-cols-[150px_1fr] items-center py-3">
              <p>Filler words</p>
              <p className="text-right">
                {fillerWordsTotal} <span className="text-[#b6c0cf]">· {fillerWordsBreakdownText}</span>
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border-l-2 border-l-[#f97316] bg-[#f8f9fb] p-5">
            <p className="text-[18px] uppercase tracking-[0.08em] text-[#8ea0ba]">AI Coach Insight</p>
            <p className="mt-2 text-[32px] leading-[1.4] text-[#607089]">&quot;{coachInsight}&quot;</p>
          </div>

          <a
            href={viewFullReportUrl}
            className="mt-7 inline-block rounded-lg bg-[#1f2a44] px-7 py-4 text-[30px] font-semibold text-white no-underline"
          >
            View full report
          </a>

          <div className="mt-7 h-px bg-[#e7edf3]" />

          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1f2a44] text-[18px] font-semibold text-white">
              {coachInitials}
            </div>
            <div>
              <p className="text-[30px] font-semibold leading-none text-[#1f2a44]">{coachName}</p>
              <p className="text-[24px] text-[#8ea0ba]">{coachRole}</p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[28px] text-[#c3ccda]">Willab</p>
        <p className="mt-1 text-center text-[22px] text-[#d4dce8]">
          You received this because you&apos;re enrolled in coaching.
        </p>
      </div>
    </div>
  );
}

