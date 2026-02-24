"""
Reference implementation for the Willab assignment email.
Copy this into your backend (e.g. email_service.py) and adapt to your Resend/Flask setup.

Usage:
  html = build_assignment_email_html(
      video_url=body.get("video_url"),
      coach_message=body.get("video_description"),
      has_assigned_exercise=bool(student_overrides.get("assigned_next_exercise_id")),
      homework_link=FRONTEND_URL + "/dashboard",  # or your homework route
      student_name=student.get("full_name") or "there",
  )
  # Then send via Resend:
  # resend.Emails.send({"from": "...", "to": student_email, "subject": "New homework", "html": html})
"""

import re
from html import escape

# Default message when coach does not set one
DEFAULT_COACH_MESSAGE = (
    "Good work. It is a small step for you, but a huge step for your progress!"
)

# Design tokens (hex for email clients)
PRIMARY = "#f97316"       # orange
FOREGROUND = "#1b2236"    # dark navy
BACKGROUND = "#ffffff"
MUTED_FG = "#6b7280"
SECONDARY_BG = "#f3f4f6"
BORDER = "#e5e7eb"
EMAIL_BG = "#f3f4f6"
# Gradient for "no video" block (orange → amber)
GRADIENT_START = "#f97316"
GRADIENT_END = "#ea580c"


def _paragraphs(text: str) -> list[str]:
    """Split into paragraphs (double newline), escape HTML."""
    if not (text and text.strip()):
        return []
    return [
        escape(p.strip()).replace("\n", "<br>\n")
        for p in re.split(r"\n\n+", text.strip())
        if p.strip()
    ]


def build_assignment_email_html(
    *,
    video_url: str | None = None,
    coach_message: str | None = None,
    has_assigned_exercise: bool = False,
    homework_link: str,
    student_name: str = "there",
    meta_label: str = "Session Recap",
    homework_title: str = "New Homework Available",
    homework_subtitle: str = "Your next assignment is ready.",
    coach_name: str = "Your Coach",
    coach_role: str = "Public Speaking Coach",
    unsubscribe_link: str = "#",
    preferences_link: str = "#",
) -> str:
    """
    Build the full HTML for the assignment email.
    """
    has_video = bool(video_url and video_url.strip())
    body_paragraphs = _paragraphs(coach_message) if coach_message and coach_message.strip() else []
    if not body_paragraphs:
        body_paragraphs = [escape(DEFAULT_COACH_MESSAGE)]

    title = f"Great progress, {escape(student_name)}!" if student_name and student_name != "there" else "Great progress this week!"

    # ---- Video block (table-based for email client compatibility) ----
    if has_video:
        # Centered play button over dark area; whole area links to video_url
        video_block = f"""
        <tr>
          <td style="background: #1b2236; padding: 80px 24px; text-align: center;">
            <a href="{escape(video_url)}" style="display: inline-block; text-decoration: none;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="width: 80px; height: 80px; border-radius: 50%; background: {PRIMARY}; text-align: center; vertical-align: middle;">
                    <span style="display: inline-block; width: 0; height: 0; margin-left: 8px; border-style: solid; border-width: 14px 0 14px 24px; border-color: transparent transparent transparent #fff;"></span>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
        """
    else:
        # Orange gradient block (no link)
        video_block = f"""
        <tr>
          <td style="padding: 80px 24px; background: {PRIMARY}; background: linear-gradient(135deg, {GRADIENT_START} 0%, #ea580c 50%, #d97706 100%);"></td>
        </tr>
        """

    # ---- Body paragraphs ----
    body_html = "".join(
        f'<p style="margin: 0 0 1rem; font-size: 15px; line-height: 1.6; color: {FOREGROUND}; opacity: 0.9;">{p}</p>'
        for p in body_paragraphs
    )

    # ---- Assigned exercise line ----
    exercise_line = ""
    if has_assigned_exercise:
        exercise_line = f"""
        <p style="margin: 0.5rem 0 0; font-size: 14px; color: {MUTED_FG};">
          You have an exercise assigned — it will appear on the main screen after you follow the link below.
        </p>
        """

    # ---- Full HTML ----
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>New homework</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 2rem 1rem; font-family: 'DM Sans', sans-serif; background: {EMAIL_BG}; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto;">
    <!-- Brand header -->
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: {FOREGROUND};">
        Willab<span style="color: {PRIMARY};">.</span>
      </p>
      <p style="margin: 0.25rem 0 0; font-size: 14px; color: {MUTED_FG};">
        Homework tool for public speaking
      </p>
    </div>

    <!-- Main card -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: {BACKGROUND}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 16px -4px rgba(27, 34, 54, 0.07);">
      <!-- Video block -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        {video_block}
      </table>

      <!-- Body -->
      <tr>
        <td style="padding: 2.5rem 2.5rem 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 500; color: {MUTED_FG};">{escape(meta_label)}</p>
          <h1 style="margin: 0.25rem 0 1.5rem; font-family: 'DM Serif Display', serif; font-size: 28px; font-weight: 400; color: {FOREGROUND};">{title}</h1>
          {body_html}
        </td>
      </tr>
      <tr>
        <td style="padding: 0 2.5rem; height: 1px; background: {BORDER};"></td>
      </tr>
      <tr>
        <td style="padding: 2rem 2.5rem;">
          <!-- Homework CTA card -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: {SECONDARY_BG}; border-radius: 8px;">
            <tr>
              <td style="padding: 1.5rem; vertical-align: top;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width: 40px; height: 40px; border-radius: 8px; background: rgba(249, 115, 22, 0.1); vertical-align: top; padding-top: 8px; padding-left: 8px;">
                      <span style="color: {PRIMARY}; font-size: 20px;">📖</span>
                    </td>
                    <td style="padding-left: 1rem;">
                      <h2 style="margin: 0; font-family: 'DM Serif Display', serif; font-size: 18px; font-weight: 600; color: {FOREGROUND};">{escape(homework_title)}</h2>
                      <p style="margin: 0.25rem 0 0; font-size: 14px; color: {MUTED_FG};">{escape(homework_subtitle)}</p>
                      {exercise_line}
                      <a href="{escape(homework_link)}" style="display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; padding: 0.625rem 1.5rem; font-size: 14px; font-weight: 500; color: #fff; background: {PRIMARY}; border-radius: 6px; text-decoration: none;">View Homework →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Coach footer -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid {BORDER};">
            <tr>
              <td style="width: 36px; height: 36px; border-radius: 50%; background: rgba(249, 115, 22, 0.15); text-align: center; vertical-align: middle; font-size: 12px; font-weight: 600; color: {PRIMARY};">
                {escape(coach_name[:2].upper() if len(coach_name) >= 2 else coach_name.upper())}
              </td>
              <td style="padding-left: 0.75rem;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: {FOREGROUND};">{escape(coach_name)}</p>
                <p style="margin: 0; font-size: 12px; color: {MUTED_FG};">{escape(coach_role)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Footer links -->
    <p style="text-align: center; font-size: 12px; color: {MUTED_FG}; margin-top: 1.5rem;">
      You received this because you're enrolled in a coaching program.
    </p>
    <p style="text-align: center; font-size: 12px; color: {MUTED_FG}; margin-top: 0.25rem;">
      <a href="{escape(unsubscribe_link)}" style="color: {MUTED_FG}; text-decoration: underline;">Unsubscribe</a>
      &nbsp;·&nbsp;
      <a href="{escape(preferences_link)}" style="color: {MUTED_FG}; text-decoration: underline;">Preferences</a>
    </p>
  </div>
</body>
</html>
"""
    return html


# ---- Example: how to call from your Flask send-assignment route ----
"""
def send_assignment_email(student_id: str, body: dict) -> None:
    student = get_student(student_id)  # your DB lookup
    overrides = student.get("overrides") or {}
    homework_link = os.getenv("FRONTEND_URL", "https://app.willonski.com") + "/dashboard"

    html = build_assignment_email_html(
        video_url=body.get("video_url"),
        coach_message=body.get("video_description"),
        has_assigned_exercise=bool(overrides.get("assigned_next_exercise_id")),
        homework_link=homework_link,
        student_name=student.get("full_name") or student.get("email", "there"),
        unsubscribe_link=homework_link + "?unsubscribe=1",
        preferences_link=homework_link + "?preferences=1",
    )

    resend.Emails.send({
        "from": "Willab <homework@yourdomain.com>",
        "to": [student["email"]],
        "subject": "New homework for you",
        "html": html,
    })
"""
