"use client";

const DEFAULT_COACH_MESSAGE =
  "Good work. It is a small step for you, but a huge step for your progress!";

export default function CoachEmail({
  title, // kept for compatibility; spec uses fixed format
  studentName = "there",
  coachMessage = null,
  hasAssignedExercise = false, // kept for compatibility
  homeworkTitle = "New homework available",
  homeworkSubtitle = "Your next assignment is ready. You have an exercise assigned — it will appear on the main screen after you follow the link below.",
  coachInitials = "LC",
  coachName = "Artur",
  coachRole = "Public Speaking Coach",
  homeworkUrl = "https://app.willonski.com/dashboard",
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
  homeworkUrl?: string;
}) {
  const resolvedTitle = title?.trim() || `Great progress, ${studentName}!`;
  const resolvedCoachMessage = coachMessage?.trim() || DEFAULT_COACH_MESSAGE;
  const resolvedHomeworkCopy = hasAssignedExercise
    ? homeworkSubtitle
    : "Your next assignment is ready. It will appear on the main screen after you follow the link below.";

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
                            <td style={{ padding: "36px 36px 0", fontSize: "18px", fontWeight: 600, color: "#1e293b" }}>
                              {resolvedTitle}
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "20px 36px 0" }}>
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
                                      <div style={{ fontSize: "14px", color: "#1e293b", fontStyle: "italic", lineHeight: 1.6 }}>
                                        "{resolvedCoachMessage}"
                                      </div>
                                      <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8" }}>
                                        — {coachName}, your coach
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
                            <td style={{ padding: "28px 36px 0" }}>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "6px" }}>
                                {homeworkTitle}
                              </div>
                              <div style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
                                {resolvedHomeworkCopy}
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td style={{ padding: "28px 36px" }}>
                              <a
                                href={homeworkUrl}
                                style={{
                                  backgroundColor: "#f97316",
                                  color: "#ffffff",
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  padding: "12px 28px",
                                  borderRadius: "6px",
                                  textDecoration: "none",
                                  display: "inline-block",
                                }}
                              >
                                View homework →
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
