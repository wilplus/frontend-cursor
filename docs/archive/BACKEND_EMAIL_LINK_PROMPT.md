# Backend Prompt: Admin Email with Correct Feedback Link

## 🎯 Goal

Update the admin email notification to include the correct feedback link that matches the frontend route structure.

---

## 📧 Email Link Format

The feedback link in admin emails should be:

```
https://your-frontend-domain.com/recordings/{recording_id}/feedback?user_id={user_id}
```

**Example:**
```
https://your-admin-dashboard.com/recordings/dfc436db-c73c-49de-a3c3-d308674ff611/feedback?user_id=5402278f-38f6-4538-8c1b-b65c6912f5da
```

---

## 🔧 Backend Implementation

### Update Email Notification Function

In your Flask backend, update the `send_admin_notification()` function to include the correct feedback link:

```python
# In your Flask backend (e.g., app/services/email_service.py or app/utils/notifications.py)

import os
from flask import current_app

def send_admin_notification(
    user_id: str,
    session_id: str,
    recording_id: str,
    subject: str,
    payload: dict
):
    """
    Send email notification to admin users about new recording.
    Includes link to provide feedback.
    """
    # Get frontend URL from environment variable
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Construct feedback link
    feedback_link = f"{FRONTEND_URL}/recordings/{recording_id}/feedback?user_id={user_id}"
    
    # Get all active admin users
    admins = db.session.query(AdminUser).filter_by(
        is_active=True
    ).all()
    
    for admin in admins:
        # Create notification record
        notification = AdminNotification(
            user_id=user_id,
            session_id=session_id,
            recording_id=recording_id,
            sent_to=admin.email,
            subject=subject,
            payload_json=payload,
            status='pending'
        )
        db.session.add(notification)
        
        # Format email body with feedback link
        email_body = format_admin_email(
            user_id=user_id,
            recording_id=recording_id,
            transcription=payload.get('transcription', ''),
            analysis=payload.get('analysis', ''),
            metrics=payload.get('metrics', {}),
            feedback_link=feedback_link  # ✅ Include feedback link
        )
        
        # Send email (using your email service: SendGrid, AWS SES, etc.)
        try:
            send_email(
                to=admin.email,
                subject=subject,
                body=email_body,
                html=format_admin_email_html(
                    user_id=user_id,
                    recording_id=recording_id,
                    transcription=payload.get('transcription', ''),
                    analysis=payload.get('analysis', ''),
                    metrics=payload.get('metrics', {}),
                    feedback_link=feedback_link  # ✅ Include in HTML too
                )
            )
            notification.status = 'sent'
            notification.sent_at = datetime.utcnow()
        except Exception as e:
            notification.status = 'failed'
            notification.error = str(e)
            logger.error(f"Failed to send email to {admin.email}: {e}")
        
        db.session.commit()
```

---

## 📝 Email Body Format

### Plain Text Version

```python
def format_admin_email(user_id, recording_id, transcription, analysis, metrics, feedback_link):
    """
    Format plain text email body for admin notification.
    """
    return f"""
New Recording Requires Feedback

Recording ID: {recording_id}
User ID: {user_id}

Transcription Preview:
{transcription[:300]}...

Analysis Preview:
{analysis[:300]}...

Metrics:
- Words Per Minute: {metrics.get('wpm', 'N/A')}
- Filler Count: {metrics.get('filler_count', 'N/A')}

Provide Feedback:
{feedback_link}

---
This is an automated notification from Willab.
"""
```

### HTML Version (Recommended)

```python
def format_admin_email_html(user_id, recording_id, transcription, analysis, metrics, feedback_link):
    """
    Format HTML email body for admin notification.
    """
    return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
        .button {{ display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .button:hover {{ background-color: #4338CA; }}
        .info {{ background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }}
        .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Recording Requires Feedback</h1>
        </div>
        <div class="content">
            <div class="info">
                <strong>Recording ID:</strong> {recording_id}<br>
                <strong>User ID:</strong> {user_id}
            </div>
            
            <div class="info">
                <strong>Transcription Preview:</strong><br>
                {transcription[:300]}...
            </div>
            
            <div class="info">
                <strong>Analysis Preview:</strong><br>
                {analysis[:300]}...
            </div>
            
            <div class="info">
                <strong>Metrics:</strong><br>
                Words Per Minute: {metrics.get('wpm', 'N/A')}<br>
                Filler Count: {metrics.get('filler_count', 'N/A')}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{feedback_link}" class="button">Provide Feedback</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated notification from Willab.</p>
            <p>Click the button above to provide feedback and improve AI analysis for this user.</p>
        </div>
    </div>
</body>
</html>
"""
```

---

## 🔧 Environment Variable

Add to your Flask backend `.env` file:

```bash
# Frontend URL for email links
FRONTEND_URL=https://your-frontend-domain.com

# For development:
# FRONTEND_URL=http://localhost:3000

# For production:
# FRONTEND_URL=https://your-admin-dashboard.com
```

---

## 📍 Where to Call This

Update your recording upload endpoint to call `send_admin_notification()` with the correct link:

```python
# In your Flask backend /recordings/upload endpoint

@recordings_bp.route('/upload', methods=['POST'])
def upload_recording():
    # ... upload, transcribe, analyze ...
    
    # After saving recording to database
    recording_id = recording.id
    user_id = recording.user_id
    
    # Send email notification with feedback link
    send_admin_notification(
        user_id=user_id,
        session_id=session_id,
        recording_id=recording_id,
        subject=f"New Recording from {user_email}",
        payload={
            "recording_id": recording_id,
            "user_id": user_id,
            "transcription": transcription_text,
            "analysis": analysis_report,
            "metrics": {
                "wpm": words_per_minute,
                "filler_count": filler_count
            }
        }
    )
    
    # ... return response ...
```

---

## ✅ Checklist

- [ ] Add `FRONTEND_URL` environment variable to Flask backend
- [ ] Update `send_admin_notification()` to construct feedback link
- [ ] Include feedback link in email body (plain text)
- [ ] Include feedback link in email HTML (as button)
- [ ] Test email link opens correct page
- [ ] Verify link works in production environment

---

## 🧪 Testing

### Test Email Link Format

```python
# Test script
FRONTEND_URL = "http://localhost:3000"  # or production URL
recording_id = "dfc436db-c73c-49de-a3c3-d308674ff611"
user_id = "5402278f-38f6-4538-8c1b-b65c6912f5da"

feedback_link = f"{FRONTEND_URL}/recordings/{recording_id}/feedback?user_id={user_id}"
print(feedback_link)
# Should output: http://localhost:3000/recordings/dfc436db-c73c-49de-a3c3-d308674ff611/feedback?user_id=5402278f-38f6-4538-8c1b-b65c6912f5da
```

### Verify Link Works

1. Upload a recording
2. Check admin email
3. Click the feedback link
4. Should open: `/recordings/[recordingId]/feedback?user_id=[userId]`
5. Should show feedback form (if admin is logged in)

---

## 📝 Summary

**Key Changes:**
1. Add `FRONTEND_URL` environment variable
2. Construct link: `{FRONTEND_URL}/recordings/{recording_id}/feedback?user_id={user_id}`
3. Include link in email body and HTML
4. Make link clickable (HTML button or plain text URL)

**Link Format:**
```
https://your-frontend-domain.com/recordings/{recording_id}/feedback?user_id={user_id}
```

The frontend route is already set up and ready to receive these links! 🚀
