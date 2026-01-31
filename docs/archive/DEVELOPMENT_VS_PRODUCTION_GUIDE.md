# Development vs Production: OpenAI Analysis & Email Flow

## 🔍 Is OpenAI Analyzing Recordings in Development?

### Short Answer: **It depends on your Flask backend configuration**

The **frontend** doesn't call OpenAI directly - it's your **Flask backend** that does the analysis. Whether OpenAI is being used depends on:

1. **Backend environment variables** - Is `OPENAI_API_KEY` set?
2. **Backend code** - Does it skip analysis in dev mode?
3. **Backend logs** - Check if OpenAI API calls are being made

### How to Check

1. **Check Flask backend logs** when you upload a recording:
   ```bash
   # Look for OpenAI API calls
   grep -i "openai\|gpt\|transcription\|analysis" your-flask-logs.log
   ```

2. **Check OpenAI dashboard** - If credits aren't being used, either:
   - Backend isn't calling OpenAI (dev mode skip)
   - Backend is using mock/placeholder data
   - Backend has an error before reaching OpenAI

3. **Check backend code** - Look for:
   ```python
   # Common dev mode patterns
   if os.getenv('ENV') == 'development':
       # Return mock data instead of calling OpenAI
       return mock_transcription()
   ```

---

## 📧 Email Notification Flow

### When Emails Are Sent

Based on your schema, emails are sent via the `admin_notifications` table. The flow should be:

### 1. **After Recording Upload & Analysis**

```python
# In your Flask backend /recordings/upload endpoint
@recordings_bp.route('/upload', methods=['POST'])
def upload_recording():
    # ... upload audio to Supabase Storage ...
    # ... transcribe with OpenAI Whisper ...
    # ... analyze with OpenAI GPT ...
    # ... save recording to database ...
    
    # ✅ Send email notification to admin
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
```

### 2. **Email Notification Function**

```python
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
        
        # Send email (using your email service: SendGrid, AWS SES, etc.)
        try:
            send_email(
                to=admin.email,
                subject=subject,
                body=format_email_body(payload)  # Format the email
            )
            notification.status = 'sent'
            notification.sent_at = datetime.utcnow()
        except Exception as e:
            notification.status = 'failed'
            notification.error = str(e)
        
        db.session.commit()
```

### 3. **Email Content Format**

The email should include:
- **User information** (email, name if available)
- **Recording summary** (duration, WPM, filler count)
- **Transcription preview** (first 200-300 words)
- **Analysis highlights** (key insights from GPT analysis)
- **Link to view full recording** (if you have an admin dashboard)

---

## 🚀 Should You Deploy to Vercel?

### **Yes, but with caveats:**

### ✅ Deploy Frontend to Vercel

**Benefits:**
- Test real production environment
- Verify Supabase auth works in production
- Test API routes (BFF layer)
- See if environment variables work correctly

**Steps:**
1. Push code to GitHub
2. Connect to Vercel
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (your Flask backend URL)
4. Deploy

### ⚠️ But Your Flask Backend Must Also Be Running

**Important:** The frontend on Vercel will still call your Flask backend. So:

1. **Flask backend must be deployed** (Railway, Render, Heroku, etc.)
2. **Flask backend must have OpenAI API key** set
3. **Flask backend must process recordings** (transcription, analysis)

---

## 🔄 Complete Flow: Development vs Production

### Development Mode

```
User uploads recording
  ↓
Frontend (localhost:3000)
  ↓
Next.js BFF (/api/recording/upload)
  ↓
Flask Backend (localhost:5000)
  ↓
❓ Does backend call OpenAI?
  - If YES → Uses OpenAI credits
  - If NO → Returns mock data
  ↓
Returns response to frontend
```

### Production Mode

```
User uploads recording
  ↓
Frontend (Vercel)
  ↓
Next.js BFF (/api/recording/upload)
  ↓
Flask Backend (Railway/Render/etc.)
  ↓
✅ Should call OpenAI (if configured)
  - Transcribe with Whisper
  - Analyze with GPT-4
  - Generate feedback
  ↓
Send email to admin
  ↓
Returns response to frontend
```

---

## 📋 Next Steps

### 1. **Check Your Flask Backend**

Look for these files/functions:
- `transcribe_audio()` - Should call OpenAI Whisper
- `analyze_recording()` - Should call OpenAI GPT
- `send_admin_notification()` - Should send emails

### 2. **Verify Environment Variables**

In your Flask backend:
```bash
# Check if these are set
echo $OPENAI_API_KEY
echo $ENV  # Should be 'production' for real analysis
```

### 3. **Check Backend Logs**

When you upload a recording, check Flask logs for:
- OpenAI API calls
- Transcription results
- Analysis results
- Email sending attempts

### 4. **Test Email Flow**

1. Upload a recording
2. Check `admin_notifications` table in Supabase
3. Verify email was sent (check your email service logs)
4. Check if `status = 'sent'` or `status = 'failed'`

---

## 🐛 Common Issues

### Issue 1: No OpenAI Credits Used

**Possible causes:**
- Backend has dev mode that skips OpenAI
- Backend has error before reaching OpenAI
- OpenAI API key not set
- Backend using mock data

**Fix:** Check Flask backend logs and code

### Issue 2: No Emails Sent

**Possible causes:**
- Email service not configured (SendGrid, AWS SES, etc.)
- `send_admin_notification()` not called
- Email service credentials not set
- Emails going to spam

**Fix:** Check `admin_notifications` table and email service logs

### Issue 3: Analysis Not Working

**Possible causes:**
- OpenAI API key invalid
- Audio file not being sent to OpenAI
- Backend error during analysis
- Rate limits exceeded

**Fix:** Check Flask backend logs for OpenAI errors

---

## 📝 Backend Implementation Checklist

Your Flask backend should:

- [ ] Call OpenAI Whisper for transcription
- [ ] Call OpenAI GPT for analysis
- [ ] Store results in database
- [ ] Send email notification to admin
- [ ] Log all OpenAI API calls
- [ ] Handle errors gracefully
- [ ] Use environment variables for API keys

---

## 💡 Recommendation

**Before deploying to Vercel:**

1. **Test Flask backend locally first:**
   - Upload a recording
   - Check if OpenAI is called (check logs)
   - Verify transcription/analysis works
   - Check if email is sent

2. **Then deploy frontend to Vercel:**
   - Frontend will work if backend is working
   - You can test the full flow

3. **Deploy Flask backend:**
   - Use Railway, Render, or similar
   - Set all environment variables
   - Test the full production flow

The frontend is ready - the key is making sure your **Flask backend** is properly configured to call OpenAI and send emails!
