# Backend Email Link Fix: Production URL Issue

## 🐛 Problem

The email link doesn't work after being sent to admin. The backend has `FRONTEND_URL` set to both `app.willonski.com` and `localhost:3000`, which is causing issues.

---

## ✅ Solution: Use Single Production URL

### 1. Update Railway Environment Variables

**Remove the duplicate `localhost:3000` value.** Keep only the production URL:

```bash
FRONTEND_URL=https://app.willonski.com
```

**NOT:**
```bash
FRONTEND_URL=app.willonski.com,localhost:3000  # ❌ Wrong - multiple values
```

**OR:**
```bash
FRONTEND_URL=https://app.willonski.com  # ✅ Correct - single production URL
```

### 2. Backend Code: Construct Link Correctly

Make sure your Flask backend constructs the link like this:

```python
import os

def send_admin_notification(...):
    # Get frontend URL from environment
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Ensure it has https:// protocol
    if not FRONTEND_URL.startswith('http://') and not FRONTEND_URL.startswith('https://'):
        FRONTEND_URL = f"https://{FRONTEND_URL}"
    
    # Construct feedback link
    feedback_link = f"{FRONTEND_URL}/recordings/{recording_id}/feedback?user_id={user_id}"
    
    # Use in email
    email_body = f"""
    ...
    Provide Feedback: {feedback_link}
    ...
    """
```

### 3. Verify Link Format

The link should be:
```
https://app.willonski.com/recordings/{recording_id}/feedback?user_id={user_id}
```

**Example:**
```
https://app.willonski.com/recordings/dfc436db-c73c-49de-a3c3-d308674ff611/feedback?user_id=5402278f-38f6-4538-8c1b-b65c6912f5da
```

---

## 🔍 Debugging Steps

### Step 1: Check What URL Backend is Using

Add temporary logging in your Flask backend:

```python
def send_admin_notification(...):
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    feedback_link = f"{FRONTEND_URL}/recordings/{recording_id}/feedback?user_id={user_id}"
    
    # Temporary debug logging
    print(f"[DEBUG] FRONTEND_URL: {FRONTEND_URL}")
    print(f"[DEBUG] Feedback link: {feedback_link}")
    
    # Send email with link
    ...
```

### Step 2: Check Email Content

When you receive the email, check:
1. **What URL is in the email?** (Right-click link → Copy link address)
2. **Does it have `https://`?**
3. **Is it `app.willonski.com` or `localhost:3000`?**

### Step 3: Test the Link Directly

1. Copy the link from the email
2. Open it in a browser
3. Check browser console for errors
4. Check Network tab for failed requests

---

## 🐛 Common Issues

### Issue 1: Using localhost in Production

**Problem:**
```python
FRONTEND_URL=localhost:3000  # ❌ Won't work in production
```

**Fix:**
```python
FRONTEND_URL=https://app.willonski.com  # ✅ Correct
```

### Issue 2: Missing Protocol

**Problem:**
```python
FRONTEND_URL=app.willonski.com  # ❌ Missing https://
```

**Fix:**
```python
FRONTEND_URL=https://app.willonski.com  # ✅ Correct
```

Or handle in code:
```python
FRONTEND_URL = os.getenv('FRONTEND_URL')
if not FRONTEND_URL.startswith('http'):
    FRONTEND_URL = f"https://{FRONTEND_URL}"
```

### Issue 3: Multiple Values in Environment Variable

**Problem:**
```bash
FRONTEND_URL=app.willonski.com,localhost:3000  # ❌ Multiple values
```

**Fix:**
```bash
FRONTEND_URL=https://app.willonski.com  # ✅ Single value
```

---

## ✅ Correct Backend Implementation

```python
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
    """
    # Get frontend URL from environment
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Ensure protocol is included
    if not FRONTEND_URL.startswith('http://') and not FRONTEND_URL.startswith('https://'):
        # Default to https for production
        FRONTEND_URL = f"https://{FRONTEND_URL}"
    
    # Construct feedback link
    feedback_link = f"{FRONTEND_URL}/recordings/{recording_id}/feedback?user_id={user_id}"
    
    # Get all active admin users
    admins = db.session.query(AdminUser).filter_by(is_active=True).all()
    
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
        
        # Format email with feedback link
        email_body = format_admin_email(
            user_id=user_id,
            recording_id=recording_id,
            transcription=payload.get('transcription', ''),
            analysis=payload.get('analysis', ''),
            metrics=payload.get('metrics', {}),
            feedback_link=feedback_link  # ✅ Use constructed link
        )
        
        # Send email
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
                    feedback_link=feedback_link  # ✅ Use in HTML too
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

## 🧪 Testing

### Test Link Construction

```python
# Test in Python shell or Flask route
import os

FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
recording_id = "dfc436db-c73c-49de-a3c3-d308674ff611"
user_id = "5402278f-38f6-4538-8c1b-b65c6912f5da"

# Ensure protocol
if not FRONTEND_URL.startswith('http'):
    FRONTEND_URL = f"https://{FRONTEND_URL}"

feedback_link = f"{FRONTEND_URL}/recordings/{recording_id}/feedback?user_id={user_id}"
print(feedback_link)
# Should output: https://app.willonski.com/recordings/dfc436db-c73c-49de-a3c3-d308674ff611/feedback?user_id=5402278f-38f6-4538-8c1b-b65c6912f5da
```

### Test Link in Browser

1. Copy the link from email
2. Open in browser
3. Should redirect to login if not authenticated
4. After login, should show feedback form

---

## 📋 Checklist

- [ ] Remove `localhost:3000` from Railway `FRONTEND_URL`
- [ ] Set `FRONTEND_URL=https://app.willonski.com` in Railway
- [ ] Ensure backend code adds `https://` if missing
- [ ] Test link construction in backend
- [ ] Send test email and verify link
- [ ] Click link and verify it works
- [ ] Check browser console for errors if link doesn't work

---

## 🎯 Summary

**The Issue:**
- Railway has `FRONTEND_URL` with multiple values or wrong value
- Backend might not be adding `https://` protocol
- Link might be pointing to `localhost:3000` instead of production

**The Fix:**
1. Set `FRONTEND_URL=https://app.willonski.com` in Railway (single value)
2. Ensure backend adds protocol if missing
3. Test the link after sending email

The frontend route is ready - it just needs the correct URL from the backend! 🚀
