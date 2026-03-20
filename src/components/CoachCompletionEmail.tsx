"use client";

type CoachCompletionEmailProps = {
  studentEmail?: string;
  scorePercent?: number;
  reportPreview?: string;
  paceLabel?: string;
  fillerWordsCount?: number;
  strengthLabel?: string;
  profileUrl?: string;
  copyLinkUrl?: string;
  brandLogoUrl?: string;
};

/**
 * Coach completion email preview (frontend reference for backend HTML template).
 * Matches the compact card style shared by product.
 */
export default function CoachCompletionEmail({
  studentEmail = "a.willonski@gmail.com",
  scorePercent = 74,
  reportPreview = `"When I'm sad I usually just go on with my life and I, you know, I'm just chilling on the sofa. Sometimes I talk to someone, sometimes I watch movies..."`,
  paceLabel = "119 WPM",
  fillerWordsCount = 1,
  strengthLabel = "Loudness (pending)",
  profileUrl = "https://app.willonski.com/admin/students",
  copyLinkUrl = "https://app.willonski.com/admin/students",
  brandLogoUrl = "https://app.willonski.com/icon",
}: CoachCompletionEmailProps) {
  return (
    <div className="min-h-screen bg-[#f4f5f7] px-4 py-8 text-[#243044]">
      <div className="mx-auto w-full max-w-[680px]">
        <div className="mb-4 flex items-center gap-2 text-[#243044]">
          <img
            src={brandLogoUrl}
            alt="Willab logo"
            width={24}
            height={24}
            className="h-6 w-6 rounded-sm"
          />
          <p className="text-[34px] font-semibold leading-none tracking-tight">Willab.</p>
        </div>

        <div className="rounded-2xl bg-white p-9 shadow-[0_1px_10px_rgba(17,24,39,0.05)]">
          <h1 className="text-[44px] font-semibold leading-[1.2] text-[#202b3d]">
            A student has completed a homework lesson.
          </h1>

          <div className="mt-8 space-y-0">
            <div className="grid grid-cols-[120px_1fr] border-t border-[#e8edf3] py-4">
              <p className="text-[24px] text-[#8fa0ba]">Student</p>
              <p className="text-[24px] text-[#29354a]">{studentEmail}</p>
            </div>
            <div className="grid grid-cols-[120px_1fr] border-y border-[#e8edf3] py-4">
              <p className="text-[24px] text-[#8fa0ba]">Score</p>
              <p className="text-[42px] font-semibold leading-none text-[#ea6a0a]">{scorePercent}%</p>
            </div>
          </div>

          <a
            href={profileUrl}
            className="mt-7 inline-block rounded-lg bg-[#1f2a44] px-8 py-4 text-[24px] font-semibold text-white no-underline"
          >
            View profile &amp; send homework
          </a>

          <div className="mt-5">
            <a href={copyLinkUrl} className="text-[24px] text-[#8fa0ba] no-underline">
              Copy link →
            </a>
          </div>

          <div className="mt-8 rounded-xl bg-[#f7f8fa] p-6">
            <p className="text-[18px] uppercase tracking-[0.12em] text-[#8fa0ba]">Report preview</p>
            <p className="mt-3 text-[21px] italic leading-[1.4] text-[#5e6f89]">{reportPreview}</p>

            <div className="mt-6 space-y-2 text-[20px] text-[#5e6f89]">
              <p>
                Pace: {paceLabel} <span className="text-[#c2cbd8]">(target 120-160)</span>
              </p>
              <p>Filler words: {fillerWordsCount}</p>
              <p>
                Strength: {strengthLabel.includes("(") ? (
                  <>
                    {strengthLabel.split("(")[0].trim()}{" "}
                    <span className="text-[#c2cbd8]">
                      ({strengthLabel.split("(").slice(1).join("(")}
                    </span>
                  </>
                ) : (
                  strengthLabel
                )}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[22px] text-[#c2cbd8]">Willab</p>
      </div>
    </div>
  );
}

