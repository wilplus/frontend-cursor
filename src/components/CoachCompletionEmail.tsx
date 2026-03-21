"use client";

/**
 * Email 1 — Admin Notification: Student Homework Completed
 *
 * Recipient: admin / coach
 * Trigger:   student submits homework recording
 *
 * Used as a visual preview at /admin/email-preview.
 * Backend generates the same HTML structure for actual sending.
 */

export type CoachCompletionEmailProps = {
  studentEmail?: string;
  score?: number;
  profileUrl?: string;
  transcriptExcerpt?: string;
  paceWpm?: number | null;
  fillerCount?: number;
  strength?: string;
};

export function CoachCompletionEmail({
  studentEmail = "a.willonski@gmail.com",
  score = 74,
  profileUrl = "https://app.willonski.com/admin/students/5e33e0f1-0945-458c-8987-eadf43acf955",
  transcriptExcerpt = "When I'm sad I usually just go on with my life and I, you know, I'm just chilling on the sofa. Sometimes I talk to someone, sometimes I watch movies…",
  paceWpm = 119,
  fillerCount = 1,
  strength = "Loudness",
}: CoachCompletionEmailProps) {
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

                        {/* Heading + data table */}
                        <tr>
                          <td style={{ padding: "36px 36px 0" }}>
                            <p style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>
                              A student has completed a homework lesson.
                            </p>
                            <table width="100%" cellPadding={0} cellSpacing={0}>
                              <tbody>
                                <tr>
                                  <td style={{ padding: "14px 0", borderTop: "1px solid #f1f5f9", fontSize: 14, color: "#94a3b8", width: 100 }}>Student</td>
                                  <td style={{ padding: "14px 0", borderTop: "1px solid #f1f5f9", fontSize: 14, color: "#1e293b" }}>{studentEmail}</td>
                                </tr>
                                <tr>
                                  <td style={{ padding: "14px 0", borderTop: "1px solid #f1f5f9", fontSize: 14, color: "#94a3b8" }}>Score</td>
                                  <td style={{ padding: "14px 0", borderTop: "1px solid #f1f5f9", fontSize: 24, fontWeight: 600, color: "#f97316" }}>{score}%</td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>

                        {/* CTA */}
                        <tr>
                          <td style={{ padding: "28px 36px" }}>
                            <a
                              href={profileUrl}
                              style={{ display: "inline-block", backgroundColor: "#1e293b", color: "#ffffff", fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "12px 28px", borderRadius: 6 }}
                            >
                              View profile &amp; send homework
                            </a>
                            <p style={{ margin: "12px 0 0", fontSize: 12, color: "#cbd5e1" }}>
                              <a href={profileUrl} style={{ color: "#94a3b8", wordBreak: "break-all", textDecoration: "none" }}>Copy link →</a>
                            </p>
                          </td>
                        </tr>

                        {/* Report preview */}
                        <tr>
                          <td style={{ padding: "0 36px 36px" }}>
                            <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#fafafa", borderRadius: 6 }}>
                              <tbody>
                                <tr>
                                  <td style={{ padding: "20px 24px" }}>
                                    <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Report preview</p>
                                    <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b", lineHeight: 1.6, fontStyle: "italic" }}>
                                      &ldquo;{transcriptExcerpt}&rdquo;
                                    </p>
                                    <table cellPadding={0} cellSpacing={0} style={{ fontSize: 14, color: "#64748b", lineHeight: 2 }}>
                                      <tbody>
                                        <tr><td>Pace: {paceWpm ?? "—"} WPM <span style={{ color: "#cbd5e1" }}>(target 120–160)</span></td></tr>
                                        <tr><td>Filler words: {fillerCount}</td></tr>
                                        <tr><td>Strength: {strength} <span style={{ color: "#cbd5e1" }}>(pending)</span></td></tr>
                                      </tbody>
                                    </table>
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
                    <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1" }}>Willab</p>
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
