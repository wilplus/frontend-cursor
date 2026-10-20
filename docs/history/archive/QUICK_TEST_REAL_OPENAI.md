# Quick Guide: Test Real OpenAI (No Mock Data)

## 🎯 Goal

Temporarily disable mock data and test real OpenAI API calls to verify everything works.

---

## Step 1: Find Where Mock Data Is Generated

### Search Your Flask Backend

```bash
# In your Flask backend directory
grep -r "mock\|placeholder\|sample\|test transcription" . --include="*.py"
```

**Look for patterns like:**
- `"This is a mock transcription"`
- `"mock transcription for development"`
- `if os.getenv('ENV') == 'development':`
- `return "Mock analysis..."`

---

## Step 2: Temporarily Disable Mock Data

### Option A: Comment Out Mock Return

Find the function that returns mock data and comment it out:

```python
# BEFORE (with mock)
def transcribe_audio(audio_file_path):
    if os.getenv('ENV') == 'development':
        return "This is a mock transcription..."  # ❌ Comment this out
    
    # Real OpenAI call
    transcription = openai.Audio.transcribe("whisper-1", audio_file)
    return transcription.text
```

```python
# AFTER (real OpenAI)
def transcribe_audio(audio_file_path):
    # if os.getenv('ENV') == 'development':
    #     return "This is a mock transcription..."  # ✅ Commented out
    
    # Real OpenAI call
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    
    openai.api_key = api_key
    transcription = openai.Audio.transcribe("whisper-1", audio_file)
    return transcription.text
```

### Option B: Force Real Mode with Environment Variable

Add a temporary check that forces real OpenAI:

```python
def transcribe_audio(audio_file_path):
    # Force real OpenAI if TEST_REAL_OPENAI is set
    force_real = os.getenv('TEST_REAL_OPENAI', 'false') == 'true'
    
    if not force_real and os.getenv('ENV') == 'development':
        return "This is a mock transcription..."
    
    # Real OpenAI call
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    
    openai.api_key = api_key
    transcription = openai.Audio.transcribe("whisper-1", audio_file)
    return transcription.text
```

Then set:
```bash
export TEST_REAL_OPENAI=true
```

---

## Step 3: Verify OpenAI API Key

```bash
# Check if API key is set
echo $OPENAI_API_KEY

# If empty, set it:
export OPENAI_API_KEY="sk-your-actual-key-here"

# Or add to .env file:
echo "OPENAI_API_KEY=sk-your-actual-key-here" >> .env
```

**Verify in Python:**
```python
import os
api_key = os.getenv('OPENAI_API_KEY')
if api_key:
    print(f"✅ API Key set: {api_key[:10]}...")
else:
    print("❌ OPENAI_API_KEY not set!")
```

---

## Step 4: Test Transcription Function

### Quick Test Script

Create `test_transcription.py`:

```python
import openai
import os

# Set API key
openai.api_key = os.getenv('OPENAI_API_KEY')

if not openai.api_key:
    print("❌ OPENAI_API_KEY not set!")
    exit(1)

# Test with a sample audio file
audio_path = "test_audio.webm"  # Use a real audio file

print("🎤 Testing OpenAI Whisper transcription...")

try:
    with open(audio_path, 'rb') as audio_file:
        transcription = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file
        )
        print("✅ Transcription successful!")
        print(f"Text: {transcription.text[:200]}...")
except Exception as e:
    print(f"❌ Error: {e}")
```

Run it:
```bash
python test_transcription.py
```

---

## Step 5: Test Analysis Function

Create `test_analysis.py`:

```python
import openai
import os

openai.api_key = os.getenv('OPENAI_API_KEY')

if not openai.api_key:
    print("❌ OPENAI_API_KEY not set!")
    exit(1)

# Test with sample transcription
test_transcription = "Hello, this is a test recording. I'm testing the OpenAI integration."

print("🤖 Testing OpenAI GPT-4 analysis...")

try:
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": "You are an expert speech coach."
            },
            {
                "role": "user",
                "content": f"Analyze this speech: {test_transcription}"
            }
        ],
        temperature=0.7,
        max_tokens=500
    )
    
    analysis = response.choices[0].message.content
    print("✅ Analysis successful!")
    print(f"Analysis: {analysis[:200]}...")
except Exception as e:
    print(f"❌ Error: {e}")
```

Run it:
```bash
python test_analysis.py
```

---

## Step 6: Test Full Upload Flow

### 1. Restart Flask Server

After making changes, restart your Flask server:

```bash
# Stop current server (Ctrl+C)
# Then restart
python app.py
# or
flask run
```

### 2. Check Flask Logs

Look for these log messages:
- `✅ Using real OpenAI Whisper API...`
- `✅ Transcription successful: X characters`
- `✅ Using real OpenAI GPT-4 for analysis...`
- `✅ Analysis successful: X characters`

**If you see:**
- `🔧 DEV MODE: Using mock...` → Mock data is still being used
- `✅ Using real OpenAI...` → Real API is being called

### 3. Upload a Recording

1. Go to your frontend
2. Start a new recording session
3. Record a short test audio (10-30 seconds)
4. Upload the recording
5. Check Flask logs for OpenAI calls

### 4. Verify Results

**Check Database:**
```sql
-- In Supabase SQL Editor
SELECT 
    transcription_text,
    analysis_report,
    created_at
FROM recordings
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `transcription_text` = Real transcribed words (not "mock transcription...")
- `analysis_report` = Real AI-generated analysis (not "mock analysis...")

**Check Frontend:**
- View the completed recording
- Should see real transcription (your actual words)
- Should see real analysis (personalized feedback)

---

## Step 7: Verify OpenAI Dashboard

1. Go to https://platform.openai.com/usage
2. Check if API calls are being made:
   - **Whisper API** calls (transcription)
   - **Chat Completion** calls (analysis)
3. Check credits being used

**If you see:**
- ✅ API calls and credits used → Real OpenAI is working!
- ❌ No API calls → Still using mock data or API key issue

---

## Step 8: Check for Errors

### Common Errors

**Error: "OPENAI_API_KEY not set"**
```bash
# Fix: Set the environment variable
export OPENAI_API_KEY="sk-your-key"
```

**Error: "Invalid API key"**
- Verify API key is correct
- Check if key has expired
- Ensure key has credits available

**Error: "Rate limit exceeded"**
- Wait a few minutes
- Check your OpenAI usage limits

**Error: "Model not found"**
- Verify model names: `"whisper-1"` and `"gpt-4"`
- Check if you have access to these models

---

## Quick Checklist

- [ ] Found and commented out mock data returns
- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Tested transcription function directly
- [ ] Tested analysis function directly
- [ ] Restarted Flask server
- [ ] Uploaded a test recording
- [ ] Checked Flask logs for real API calls
- [ ] Verified database has real data (not mock)
- [ ] Checked OpenAI dashboard for API usage
- [ ] Frontend displays real transcription/analysis

---

## After Testing

Once you've verified OpenAI works:

1. **Option A: Keep real OpenAI** - Remove mock data completely
2. **Option B: Restore mock data** - Uncomment mock returns for faster development
3. **Option C: Use dev/prod workflow** - See `BACKEND_DEV_PROD_WORKFLOW.md` for toggleable system

---

## Troubleshooting

### Still seeing mock data?

1. **Check Flask logs** - Look for "mock" or "DEV MODE" messages
2. **Verify code changes** - Make sure you saved the file
3. **Restart Flask** - Changes require server restart
4. **Check environment** - Verify `ENV` variable isn't forcing dev mode

### OpenAI not working?

1. **Test API key** - Run `test_transcription.py` and `test_analysis.py`
2. **Check OpenAI dashboard** - Verify API key is valid
3. **Check Flask logs** - Look for error messages
4. **Verify audio file** - Make sure audio file is valid format

### Need help?

- Check Flask backend logs for specific error messages
- Verify OpenAI API key in OpenAI dashboard
- Test functions individually with test scripts above

---

## Summary

**Quick Steps:**
1. Find mock data code → Comment it out
2. Set `OPENAI_API_KEY` → Verify it's set
3. Test functions → Run test scripts
4. Restart Flask → Upload recording
5. Verify results → Check database and frontend

That's it! You should now see real OpenAI transcription and analysis.
