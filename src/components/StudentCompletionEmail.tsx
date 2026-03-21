"use client";

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
    <div
      style={{
        backgroundColor: "#fafafa",
        padding: "48px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ maxWidth: "520px" }}>
                <tbody>
                  <tr>
                    <td style={{ paddingBottom: "40px" }}>
                      <span
                        style={{
                          fontFamily: "Georgia, 'Times New Roman', serif",
                          fontSize: "20px",
                          fontWeight: 700,
                          color: "#1e293b",
                          lineHeight: 1.2,
                        }}
                      >
                        Willab
                        <span style={{ color: "#f97316" }}>.</span>
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td>
                      <table
                        role="presentation"
                        width="100%"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                        style={{ backgroundColor: "#ffffff", borderRadius: "8px" }}
                      >
                        <tbody>
                          <tr>
                            <td style={{ padding: "36px 36px 0" }}>
                              <div style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b", marginBottom: "6px" }}>
                                Great work, {studentName}!
                              </div>
                              <div style={{ fontSize: "14px", color: "#64748b" }}>
                                Your coach will contact you soon with feedback.
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "28px 36px 0" }}>
                              <table
                                role="presentation"
                                width="100%"
                                cellPadding={0}
                                cellSpacing={0}
                                border={0}
                                style={{ backgroundColor: "#fafafa", borderRadius: "6px", textAlign: "center" }}
                              >
                                <tbody>
                                  <tr>
                                    <td style={{ padding: "20px 24px" }}>
                                      <div
                                        style={{
                                          fontSize: "12px",
                                          color: "#94a3b8",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.8px",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        Performance score
                                      </div>
                                      <div style={{ fontSize: "32px", fontWeight: 600, color: "#f97316" }}>
                                        {scorePercent}%
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "28px 36px 0" }}>
                              <div style={{ borderTop: "1px solid #f1f5f9", lineHeight: 0, fontSize: 0 }}>&nbsp;</div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "24px 36px 0" }}>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "16px" }}>
                                Your report
                              </div>
                              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                                <tbody>
                                  <tr>
                                    <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#64748b" }}>
                                      Playback
                                    </td>
                                    <td align="right" style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                                      <a href={playbackUrl} style={{ color: "#f97316", textDecoration: "none" }}>
                                        Open recording →
                                      </a>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#64748b" }}>
                                      Transcript
                                    </td>
                                    <td align="right" style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#94a3b8", fontStyle: "italic" }}>
                                      {transcriptPreview}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style={{ padding: "10px 0", fontSize: "14px", color: "#64748b" }}>
                                      Filler words
                                    </td>
                                    <td align="right" style={{ padding: "10px 0", fontSize: "14px", color: "#64748b" }}>
                                      {fillerWordsTotal}
                                      <span style={{ color: "#cbd5e1" }}> · {fillerWordsBreakdownText}</span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "24px 36px 0" }}>
                              <table
                                role="presentation"
                                width="100%"
                                cellPadding={0}
                                cellSpacing={0}
                                border={0}
                                style={{ backgroundColor: "#fafafa", borderRadius: "6px", borderLeft: "2px solid #f97316" }}
                              >
                                <tbody>
                                  <tr>
                                    <td style={{ padding: "16px 20px" }}>
                                      <div
                                        style={{
                                          fontSize: "12px",
                                          color: "#94a3b8",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.8px",
                                          marginBottom: "6px",
                                        }}
                                      >
                                        AI Coach Insight
                                      </div>
                                      <div style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
                                        {coachInsight}
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "28px 36px" }}>
                              <a
                                href={viewFullReportUrl}
                                style={{
                                  backgroundColor: "#1e293b",
                                  color: "#ffffff",
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  padding: "12px 28px",
                                  borderRadius: "6px",
                                  textDecoration: "none",
                                  display: "inline-block",
                                }}
                              >
                                View full report
                              </a>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "0 36px" }}>
                              <div style={{ borderTop: "1px solid #f1f5f9", lineHeight: 0, fontSize: 0 }}>&nbsp;</div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "24px 36px 32px" }}>
                              <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
                                <tbody>
                                  <tr>
                                    <td
                                      style={{
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "16px",
                                        backgroundColor: "#1e293b",
                                        color: "#ffffff",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        textAlign: "center",
                                        lineHeight: "32px",
                                      }}
                                    >
                                      {coachInitials}
                                    </td>
                                    <td style={{ paddingLeft: "10px" }}>
                                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>{coachName}</div>
                                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>{coachRole}</div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style={{ paddingTop: "32px", fontSize: "12px", color: "#cbd5e1" }}>
                      Willab
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style={{ paddingTop: "4px", fontSize: "11px", color: "#e2e8f0" }}>
                      You received this because you&apos;re enrolled in coaching.
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

