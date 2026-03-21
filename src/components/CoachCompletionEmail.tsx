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

export default function CoachCompletionEmail({
  studentEmail = "a.willonski@gmail.com",
  scorePercent = 74,
  reportPreview = `"When I'm sad I usually just go on with my life and I, you know, I'm just chilling on the sofa. Sometimes I talk to someone, sometimes I watch movies..."`,
  paceLabel = "119 WPM",
  fillerWordsCount = 1,
  strengthLabel = "Loudness (pending)",
  profileUrl = "https://app.willonski.com/admin/students",
  copyLinkUrl = "https://app.willonski.com/admin/students",
}: CoachCompletionEmailProps) {
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
                              <div
                                style={{
                                  fontSize: "18px",
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  marginBottom: "24px",
                                  lineHeight: 1.4,
                                }}
                              >
                                A student has completed a homework lesson.
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "0 36px" }}>
                              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
                                <tbody>
                                  <tr>
                                    <td style={{ borderTop: "1px solid #f1f5f9", padding: "14px 0", width: "100px", fontSize: "14px", color: "#94a3b8" }}>
                                      Student
                                    </td>
                                    <td style={{ borderTop: "1px solid #f1f5f9", padding: "14px 0", fontSize: "14px", color: "#1e293b" }}>
                                      {studentEmail}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style={{ borderTop: "1px solid #f1f5f9", padding: "14px 0", width: "100px", fontSize: "14px", color: "#94a3b8" }}>
                                      Score
                                    </td>
                                    <td style={{ borderTop: "1px solid #f1f5f9", padding: "14px 0", fontSize: "24px", fontWeight: 600, color: "#f97316" }}>
                                      {scorePercent}%
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "28px 36px" }}>
                              <a
                                href={profileUrl}
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
                                View profile &amp; send homework
                              </a>
                              <div style={{ marginTop: "12px" }}>
                                <a
                                  href={copyLinkUrl}
                                  style={{ fontSize: "12px", color: "#94a3b8", textDecoration: "none" }}
                                >
                                  Copy link →
                                </a>
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "0 36px 36px" }}>
                              <table
                                role="presentation"
                                width="100%"
                                cellPadding={0}
                                cellSpacing={0}
                                border={0}
                                style={{ backgroundColor: "#fafafa", borderRadius: "6px" }}
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
                                          marginBottom: "12px",
                                        }}
                                      >
                                        Report preview
                                      </div>
                                      <div
                                        style={{
                                          fontSize: "14px",
                                          color: "#64748b",
                                          fontStyle: "italic",
                                          lineHeight: 1.6,
                                          marginBottom: "12px",
                                        }}
                                      >
                                        {reportPreview}
                                      </div>
                                      <div style={{ fontSize: "14px", color: "#64748b", lineHeight: 2 }}>
                                        <div>
                                          Pace: {paceLabel} <span style={{ color: "#cbd5e1" }}>(target 120-160)</span>
                                        </div>
                                        <div>Filler words: {fillerWordsCount}</div>
                                        <div>
                                          Strength: {strengthLabel}
                                        </div>
                                      </div>
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
                    <td align="center" style={{ padding: "32px 0", fontSize: "12px", color: "#cbd5e1" }}>
                      Willab
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

