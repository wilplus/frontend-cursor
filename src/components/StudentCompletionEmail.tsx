"use client";

/**
 * Email 3 — Student Congratulations: Homework Submitted
 *
 * Recipient: student
 * Trigger:   student completes and submits homework recording
 *
 * Used as a visual preview at /admin/email-preview.
 * Backend generates the same HTML structure for actual sending.
 */

export type StudentCompletionEmailProps = {
  studentFirstName?: string;
  score?: number;
  recordingUrl?: string;
  transcriptExcerpt?: string;
  fillerTotal?: number;
  fillerBreakdown?: string;
  aiInsight?: string;
  reportUrl?: string;
  coachName?: string;
  coachInitials?: string;
  coachRole?: string;
};

export function StudentCompletionEmail({
  studentFirstName = "Sarah",
  score = 74,
  recordingUrl = "https://app.willonski.com/recordings/demo",
  transcriptExcerpt = "Today I'd like to share…",
  fillerTotal = 6,
  fillerBreakdown = "um 3, like 2, you know 1",
  aiInsight = "You had strong energy and clear intent. Focus next on slowing transitions between points and reducing filler words in openings.",
  reportUrl = "https://app.willonski.com/report/demo",
  coachName = "Laura Chen",
  coachInitials = "LC",
  coachRole = "Public Speaking Coach",
}: StudentCompletionEmailProps) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#fafafa", padding: "48px 16px" }}>
      <tbody>
        <tr>
          <td align="center">
            <table cellPadding={0} cellSpacing={0} style={{ maxWidth: 520, width: "100%" }}>
              <tbody>

                {/* Logo */}
                <tr>
                  <td style={{ paddingBottom: 40 }}>
                    <span style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 20, fontWeight: 700, color: "#1e293b", letterSpacing: "-0.3px" }}>
                      Willab<span style={{ color: "#f97316" }}>.</span>
                    </span>
                  </td>
                </tr>

                {/* Card */}
                <tr>
                  <td style={{ backgroundColor: "#ffffff", borderRadius: 8 }}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tbody>

                        {/* Header */}
                        <tr>
                          <td style={{ padding: "36px 36px 0" }}>
                            <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>
                              Great work, {studentFirstName}!
                            </p>
                            <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                              Your coach will contact you soon with feedback.
                            </p>
                          </td>
                        </tr>

                        {/* Performance score block */}
                        <tr>
                          <td style={{ padding: "28px 36px 0" }}>
                            <table cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#fafafa", borderRadius: 6, width: "100%" }}>
                              <tbody>
                                <tr>
                                  <td style={{ padding: "20px 24px", textAlign: "center" }}>
                                    <p style={{ margin: "0 0 4px", fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Performance score</p>
                                    <p style={{ margin: 0, fontSize: 32, fontWeight: 600, color: "#f97316" }}>{score}%</p>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>

                        {/* Divider */}
                        <tr>
                          <td style={{ padding: "28px 36px 0" }}>
                            <div style={{ borderTop: "1px solid #f1f5f9" }} />
                          </td>
                        </tr>

                        {/* Report table */}
                        <tr>
                          <td style={{ padding: "24px 36px 0" }}>
                            <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Your report</p>
                            <table width="100%" cellPadding={0} cellSpacing={0} style={{ fontSize: 14, color: "#64748b" }}>
                              <tbody>
                                <tr>
                                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>Playback</td>
                                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                                    <a href={recordingUrl} style={{ color: "#f97316", textDecoration: "none" }}>Open recording →</a>
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>Transcript</td>
                                  <td style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontStyle: "italic", color: "#94a3b8" }}>
                                    &ldquo;{transcriptExcerpt}&rdquo;
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ padding: "10px 0" }}>Filler words</td>
                                  <td style={{ padding: "10px 0", textAlign: "right" }}>
                                    {fillerTotal} <span style={{ color: "#cbd5e1" }}>· {fillerBreakdown}</span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>

                        {/* AI Coach Insight */}
                        <tr>
                          <td style={{ padding: "24px 36px 0" }}>
                            <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#fafafa", borderRadius: 6, borderLeft: "2px solid #f97316" }}>
                              <tbody>
                                <tr>
                                  <td style={{ padding: "16px 20px" }}>
                                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>AI Coach Insight</p>
                                    <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                                      &ldquo;{aiInsight}&rdquo;
                                    </p>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>

                        {/* CTA — dark */}
                        <tr>
                          <td style={{ padding: "28px 36px" }}>
                            <a
                              href={reportUrl}
                              style={{ display: "inline-block", backgroundColor: "#1e293b", color: "#ffffff", fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "12px 28px", borderRadius: 6 }}
                            >
                              View full report
                            </a>
                          </td>
                        </tr>

                        {/* Divider */}
                        <tr>
                          <td style={{ padding: "0 36px" }}>
                            <div style={{ borderTop: "1px solid #f1f5f9" }} />
                          </td>
                        </tr>

                        {/* Coach signature */}
                        <tr>
                          <td style={{ padding: "24px 36px 32px" }}>
                            <table cellPadding={0} cellSpacing={0}>
                              <tbody>
                                <tr>
                                  <td style={{ width: 36, verticalAlign: "top" }}>
                                    <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#1e293b", color: "#ffffff", fontSize: 12, fontWeight: 600, textAlign: "center", lineHeight: "32px" }}>
                                      {coachInitials}
                                    </div>
                                  </td>
                                  <td style={{ paddingLeft: 10 }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{coachName}</p>
                                    <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{coachRole}</p>
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

                {/* Footer */}
                <tr>
                  <td style={{ padding: "32px 0", textAlign: "center" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 12, color: "#cbd5e1" }}>Willab</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#e2e8f0" }}>You received this because you&apos;re enrolled in coaching.</p>
                  </td>
                </tr>

              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
