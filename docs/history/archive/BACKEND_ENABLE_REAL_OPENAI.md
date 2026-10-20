# Backend Fix: Enable Real OpenAI Analysis (Remove Mock Data)

> **💡 For a complete dev/prod workflow with toggleable mock/real modes, see `BACKEND_DEV_PROD_WORKFLOW.md`**

## 🎯 Problem

Your Flask backend is returning **mock/placeholder data** instead of calling OpenAI for transcription and analysis.

**Current behavior:**
- Transcription: "This is a mock transcription for development purposes..."
- Analysis: Mock/placeholder text
- No OpenAI credits being used

**Expected behavior:**
- Real transcription from OpenAI Whisper
- Real analysis from OpenAI GPT-4
- OpenAI credits being consumed

---

## 🔍 Step 1: Find Where Mock Data Is Generated

### Search Your Flask Backend Code

Look for these patterns in your Flask backend:

```bash
# Search for mock/placeholder patterns
grep -r "mock\|placeholder\|sample\|test transcription" your-flask-backend/
```

### Common Locations:

1. **`/recordings/upload` endpoint** - Where transcription happens
2. **Analysis function** - Where GPT analysis happens
3. **Dev mode checks** - Code that skips OpenAI in development

---

## 🔧 Step 2: Remove Dev Mode Skips

### ❌ BAD: Dev Mode Skip Pattern

```python
# ❌ REMOVE THIS PATTERN
import os

def transcribe_audio(audio_file):
    if os.getenv('ENV') == 'development':
        return "This is a mock transcription for development purposes..."
    
    # Real OpenAI call
    transcription = openai.Audio.transcribe("whisper-1", audio_file)
    return transcription.text
```

### ✅ GOOD: Always Call OpenAI

```python
# ✅ USE THIS INSTEAD
import openai
import os

def transcribe_audio(audio_file):
    """
    Transcribe audio using OpenAI Whisper.
    Always calls OpenAI (no dev mode skip).
    """
    try:
        # Ensure API key is set
        if not os.getenv('OPENAI_API_KEY'):
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        # Call OpenAI Whisper
        transcription = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file
        )
        
        return transcription.text
    except Exception as e:
        # Log error but don't return mock data
        logger.error(f"OpenAI transcription failed: {e}")
        raise  # Let the error propagate
```

---

## 🔧 Step 3: Fix Transcription Function

### Complete Transcription Implementation

```python
# In your Flask backend (e.g., app/services/openai_service.py)
import openai
import os
import logging

logger = logging.getLogger(__name__)

def transcribe_audio(audio_file_path: str) -> str:
    """
    Transcribe audio file using OpenAI Whisper API.
    
    Args:
        audio_file_path: Path to audio file (or file-like object)
    
    Returns:
        Transcribed text as string
    
    Raises:
        ValueError: If OPENAI_API_KEY not set
        openai.error.OpenAIError: If OpenAI API call fails
    """
    # Check API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    # Initialize OpenAI client
    openai.api_key = api_key
    
    # Open audio file
    with open(audio_file_path, 'rb') as audio_file:
        # Call OpenAI Whisper
        logger.info(f"Calling OpenAI Whisper API for transcription...")
        
        transcription = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file
        )
        
        text = transcription.text.strip()
        logger.info(f"Transcription successful: {len(text)} characters")
        
        return text
```

---

## 🔧 Step 4: Fix Analysis Function

### Complete Analysis Implementation

```python
# In your Flask backend (e.g., app/services/openai_service.py)
import openai
import os
import logging

logger = logging.getLogger(__name__)

def analyze_recording(
    transcription: str,
    user_id: str = None,
    admin_notes: str = None,
    custom_instructions: str = None
) -> str:
    """
    Analyze transcription using OpenAI GPT-4.
    
    Args:
        transcription: Transcribed text from recording
        user_id: Optional user ID for context
        admin_notes: Optional admin notes to include
        custom_instructions: Optional custom analysis instructions
    
    Returns:
        Analysis report as string
    
    Raises:
        ValueError: If OPENAI_API_KEY not set
        openai.error.OpenAIError: If OpenAI API call fails
    """
    # Check API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    # Initialize OpenAI client
    openai.api_key = api_key
    
    # Build prompt
    prompt = f"""Analyze this speech recording and provide coaching feedback.

Transcription:
{transcription}

"""
    
    # Add admin context if available
    if admin_notes:
        prompt += f"""
Admin Observations:
{admin_notes}

"""
    
    if custom_instructions:
        prompt += f"""
Custom Analysis Instructions:
{custom_instructions}

"""
    
    prompt += """
Provide:
1. Overall assessment
2. Key strengths
3. Areas for improvement
4. Specific actionable recommendations

Be specific, constructive, and encouraging.
"""
    
    # Call OpenAI GPT-4
    logger.info("Calling OpenAI GPT-4 for analysis...")
    
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": "You are an expert speech coach providing personalized, constructive feedback."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.7,
        max_tokens=1000
    )
    
    analysis = response.choices[0].message.content.strip()
    logger.info(f"Analysis successful: {len(analysis)} characters")
    
    return analysis
```

---

## 🔧 Step 5: Update Upload Endpoint

### Complete Upload Endpoint (No Mock Data)

```python
# In your Flask backend (e.g., app/routes/recordings.py)
from flask import Blueprint, request, jsonify
from app.services.openai_service import transcribe_audio, analyze_recording
from app.services.storage_service import upload_to_supabase_storage
from app.models import Recording, RecordingSession
import logging

logger = logging.getLogger(__name__)

recordings_bp = Blueprint('recordings', __name__)

@recordings_bp.route('/upload', methods=['POST'])
def upload_recording():
    """
    Upload recording, transcribe, analyze, and save to database.
    NO MOCK DATA - Always calls OpenAI.
    """
    try:
        # Get user from JWT token
        user_id = get_user_id_from_token(request.headers.get('Authorization'))
        
        # Get session_id from request
        session_id = request.form.get('session_id')
        if not session_id:
            return jsonify({"error": "session_id required"}), 400
        
        # Get audio file
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({"error": "audio file required"}), 400
        
        # Save audio file temporarily
        temp_path = f"/tmp/{session_id}.webm"
        audio_file.save(temp_path)
        
        # ✅ STEP 1: Upload to Supabase Storage
        logger.info(f"Uploading audio to Supabase Storage for session {session_id}")
        audio_url = upload_to_supabase_storage(
            file_path=temp_path,
            bucket="recordings",
            file_name=f"{session_id}.webm"
        )
        
        # ✅ STEP 2: Transcribe with OpenAI Whisper (NO MOCK)
        logger.info(f"Transcribing audio with OpenAI Whisper...")
        transcription_text = transcribe_audio(temp_path)
        
        # ✅ STEP 3: Analyze with OpenAI GPT-4 (NO MOCK)
        logger.info(f"Analyzing transcription with OpenAI GPT-4...")
        analysis_report = analyze_recording(transcription_text, user_id=user_id)
        
        # ✅ STEP 4: Calculate metrics
        words = transcription_text.split()
        duration_seconds = get_audio_duration(temp_path)  # Use your audio library
        wpm = (len(words) / duration_seconds) * 60 if duration_seconds > 0 else 0
        
        filler_words = detect_filler_words(transcription_text)  # Your filler detection logic
        filler_count = sum(filler_words.values())
        
        # ✅ STEP 5: Save to database
        recording = Recording(
            id=generate_uuid(),
            user_id=user_id,
            session_id=session_id,
            audio_url=audio_url,
            duration_seconds=duration_seconds,
            transcription_text=transcription_text,
            analysis_report=analysis_report,
            coaching_report=analysis_report,  # Same as analysis_report
            words_per_minute=wpm,
            filler_words_count=filler_words,
            created_at=datetime.utcnow()
        )
        
        db.session.add(recording)
        db.session.commit()
        
        # ✅ STEP 6: Update session status
        session = db.session.query(RecordingSession).filter_by(id=session_id).first()
        if session:
            session.recording_id = recording.id
            session.status = 'recording_uploaded'
            session.recording_completed = True
            db.session.commit()
        
        # Clean up temp file
        os.remove(temp_path)
        
        # ✅ STEP 7: Return response with post-questions
        post_questions = get_post_questions_for_session(session_id)
        
        return jsonify({
            "recording_id": recording.id,
            "session_id": session_id,
            "transcription_text": transcription_text,
            "analysis": {
                "report": analysis_report,
                "trend_sentence": extract_trend_sentence(analysis_report)
            },
            "metrics": {
                "wpm": wpm,
                "filler_count": filler_count,
                "filler_breakdown": filler_words,
                "duration_seconds": duration_seconds
            },
            "post_questions": post_questions  # Return questions for post-recording
        }), 200
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        return jsonify({"error": "Failed to process recording"}), 500
```

---

## ✅ Step 6: Verify Environment Variables

### Check Your Flask Backend Environment

```bash
# In your Flask backend directory
echo $OPENAI_API_KEY
# Should show: sk-... (your actual API key)

# If empty, set it:
export OPENAI_API_KEY="sk-your-actual-key-here"

# Or in .env file:
echo "OPENAI_API_KEY=sk-your-actual-key-here" >> .env
```

### Verify in Python

```python
import os

# Check if API key is set
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    print("❌ OPENAI_API_KEY not set!")
else:
    print(f"✅ OPENAI_API_KEY is set: {api_key[:10]}...")
```

---

## 🧪 Step 7: Test Real OpenAI

### Test Transcription

```python
# Test script: test_openai.py
import openai
import os

openai.api_key = os.getenv('OPENAI_API_KEY')

# Test with a sample audio file
with open("test_audio.webm", "rb") as audio_file:
    transcription = openai.Audio.transcribe("whisper-1", audio_file)
    print("Transcription:", transcription.text)
```

### Test Analysis

```python
# Test script: test_analysis.py
import openai
import os

openai.api_key = os.getenv('OPENAI_API_KEY')

response = openai.ChatCompletion.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Analyze this speech: 'Hello, this is a test recording.'"}
    ]
)

print("Analysis:", response.choices[0].message.content)
```

---

## 📋 Checklist: Remove All Mock Data

- [ ] **Search codebase** for "mock", "placeholder", "sample", "test transcription"
- [ ] **Remove dev mode skips** that return mock data
- [ ] **Update transcription function** to always call OpenAI Whisper
- [ ] **Update analysis function** to always call OpenAI GPT-4
- [ ] **Verify OPENAI_API_KEY** is set in environment
- [ ] **Test transcription** with real audio file
- [ ] **Test analysis** with real transcription
- [ ] **Check Flask logs** for OpenAI API calls
- [ ] **Verify OpenAI dashboard** shows API usage
- [ ] **Upload a recording** and verify real data in database

---

## 🐛 Common Issues

### Issue 1: "OPENAI_API_KEY not set"

**Fix:**
```bash
export OPENAI_API_KEY="sk-your-key"
# Or add to .env file
```

### Issue 2: "OpenAI API error: Invalid API key"

**Fix:**
- Verify API key is correct
- Check if key has expired
- Ensure key has credits available

### Issue 3: "OpenAI API error: Rate limit exceeded"

**Fix:**
- Add retry logic with exponential backoff
- Check your OpenAI usage limits
- Consider upgrading plan

### Issue 4: Still seeing mock data after changes

**Fix:**
- Restart Flask server after code changes
- Clear any cached responses
- Check if another function is still returning mock data

---

## 🎯 Expected Result

After implementing these changes:

1. **Upload a recording** → Flask calls OpenAI Whisper
2. **Transcription saved** → Real transcribed text in database
3. **Analysis generated** → Real GPT-4 analysis in database
4. **Frontend displays** → Real transcription and analysis (not mock)
5. **OpenAI dashboard** → Shows API usage and credits consumed

---

## 📝 Next Steps

1. **Apply these changes** to your Flask backend
2. **Set OPENAI_API_KEY** environment variable
3. **Test with a real recording**
4. **Check database** to verify real data is stored
5. **Check frontend** to see real analysis displayed

The frontend is ready - it will display real analysis as soon as your backend provides it!

---

## 💡 Recommended: Use Dev/Prod Workflow

Instead of completely removing mock data, consider implementing a **dev/prod workflow** that allows you to:
- Use mock data in development (fast, no cost)
- Toggle to real OpenAI when testing (verify integration works)
- Always use real OpenAI in production (no mock data)

**See `BACKEND_DEV_PROD_WORKFLOW.md` for a complete implementation guide.**
