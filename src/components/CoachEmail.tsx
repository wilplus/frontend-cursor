"use client";

/**
 * Email 2 — Coach to Student: New Homework Available
 *
 * Recipient: student
 * Trigger:   coach assigns new homework via admin panel
 *
 * Used as a visual preview at /admin/email-preview.
 * Backend generates the same HTML structure for actual sending.
 */

export type CoachEmailProps = {
  studentFirstName?: string;
  coachMessage?: string;
  coachName?: string;
  coachInitials?: string;
  coachRole?: string;
  homeworkUrl?: string;
};

export function CoachEmail({
  studentFirstName = "Sarah",
  coachMessage = "Good work. It is a small step for you, but a huge step for your progress!",
  coachName = "Artur",
  coachInitials = "AR",
  coachRole = "Public Speaking Coach",
  homeworkUrl = "https://app.willonski.com",
}: CoachEmailProps) {
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

                        {/* Greeting */}
                        <tr>
                          <td style={{ padding: "36px 36px 0" }}>
                            <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1e293b", lineHeight: 1.4 }}>
                              Great progress, {studentFirstName}!
                            </p>
                          </td>
                        </tr>

                        {/* Coach message highlight */}
                        <tr>
                          <td style={{ padding: "20px 36px 0" }}>
                            <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#fafafa", borderRadius: 6, borderLeft: "2px solid #f97316" }}>
                              <tbody>
                                <tr>
                                  <td style={{ padding: "16px 20px" }}>
                                    <p style={{ margin: 0, fontSize: 14, color: "#1e293b", lineHeight: 1.6, fontStyle: "italic" }}>
                                      &ldquo;{coachMessage}&rdquo;
                                    </p>
                                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>— {coachName}, your coach</p>
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

                        {/* Homework info */}
                        <tr>
                          <td style={{ padding: "28px 36px 0" }}>
                            <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>New homework available</p>
                            <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                              Your next assignment is ready. You have an exercise assigned — it will appear on the main screen after you follow the link below.
                            </p>
                          </td>
                        </tr>

                        {/* CTA — orange */}
                        <tr>
                          <td style={{ padding: "28px 36px" }}>
                            <a
                              href={homeworkUrl}
                              style={{ display: "inline-block", backgroundColor: "#f97316", color: "#ffffff", fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "12px 28px", borderRadius: 6 }}
                            >
                              View homework →
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
