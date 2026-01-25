# How to See Real OpenAI Analysis (Not Mock Data)

## 🔍 Current Situation

The **frontend displays whatever the backend returns**. If you're seeing mock data, it means your **Flask backend is returning mock/placeholder data** instead of calling OpenAI.

## ⚠️ **YOU ARE SEEING MOCK DATA**

If you see "This is a mock transcription..." in your recordings, your **Flask backend needs to be fixed**.

👉 **See `BACKEND_ENABLE_REAL_OPENAI.md` for step-by-step instructions to remove mock data and enable real OpenAI analysis.**

---

## ✅ Frontend: Already Shows Real Data

The frontend (`CompletedCard.tsx`) displays:
- `analysis.report` - Whatever backend returns
- `transcription_text` - Whatever backend returns
- `metrics` - Whatever backend returns

**The frontend doesn't generate mock data** - it just displays what the backend sends.

---

## 🔧 How to Verify Real Analysis

### Step 1: Check Browser Console

I've added debug logging to `CompletedCard.tsx`. After completing a recording:

1. Open Browser DevTools (F12)
2. Go to Console tab
3. Look for `[CompletedCard] Recording data received:`
4. Check the logged data:
   - `has_transcription: true/false`
   - `transcription_length: number`
   - `has_analysis_report: true/false`
   - `analysis_report_length: number`

### Step 2: Check for Mock Data Warnings

The console will warn if data looks like mock/placeholder:
```
⚠️ Transcription appears to be mock/placeholder data
⚠️ Analysis report appears to be mock/placeholder data
```

### Step 3: Check Backend Logs

In your Flask backend logs, look for:
- OpenAI API calls
- Transcription results
- Analysis generation

```bash
# In your Flask terminal/logs, look for:
grep -i "openai\|whisper\|gpt\|transcription\|analysis" flask.log
```

### Step 4: Check Database Directly

Query Supabase to see what's actually stored:

```sql
-- Check a recent recording
SELECT 
    id,
    transcription_text,
    analysis_report,
    coaching_report,
    words_per_minute,
    filler_words_count,
    created_at
FROM recordings
ORDER BY created_at DESC
LIMIT 1;
```

**If you see:**
- `transcription_text` = "This is a mock transcription..." → Backend is using mock data
- `transcription_text` = Real transcribed text → Backend is calling OpenAI ✅
- `analysis_report` = "Mock analysis..." → Backend is using mock data
- `analysis_report` = Real AI-generated analysis → Backend is calling OpenAI ✅

---

## 🐛 Why You Might See Mock Data

### Backend Dev Mode Skip

Your Flask backend might have code like:

```python
# ❌ BAD - Skips OpenAI in dev mode
if os.getenv('ENV') == 'development':
    transcription = "This is a mock transcription for development..."
    analysis = "Mock analysis report..."
    return

# ✅ GOOD - Always calls OpenAI
transcription = openai.Audio.transcribe("whisper-1", audio_file)
analysis = openai.ChatCompletion.create(...)
```

### Backend Error Handling

Backend might be catching OpenAI errors and returning mock data:

```python
# ❌ BAD - Returns mock on error
try:
    transcription = openai.Audio.transcribe(...)
except Exception as e:
    transcription = "Mock transcription (error: {e})"
    return transcription

# ✅ GOOD - Logs error but doesn't hide it
try:
    transcription = openai.Audio.transcribe(...)
except Exception as e:
    logger.error(f"OpenAI transcription failed: {e}")
    raise  # Let the error propagate
```

---

## 🚀 How to Enable Real Analysis

### 1. Check Backend Environment Variables

```bash
# In your Flask backend, verify:
echo $OPENAI_API_KEY
# Should show your actual API key (not empty)

echo $ENV
# If this is 'development', backend might skip OpenAI
```

### 2. Update Backend Code

Remove any dev mode skips:

```python
# Remove this pattern:
if os.getenv('ENV') == 'development':
    return mock_data()

# Always call OpenAI:
transcription = openai.Audio.transcribe("whisper-1", audio_file)
analysis = generate_analysis_with_openai(transcription)
```

### 3. Test Backend Directly

Test if your backend actually calls OpenAI:

```python
# In Flask backend, add test endpoint:
@app.route('/test-openai', methods=['POST'])
def test_openai():
    try:
        # Test transcription
        audio_file = open("test_audio.webm", "rb")
        transcription = openai.Audio.transcribe("whisper-1", audio_file)
        
        # Test analysis
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "Analyze this: " + transcription.text}]
        )
        
        return jsonify({
            "transcription": transcription.text,
            "analysis": response.choices[0].message.content,
            "openai_working": True
        })
    except Exception as e:
        return jsonify({"error": str(e), "openai_working": False}), 500
```

Then test:
```bash
curl -X POST http://localhost:5000/test-openai \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 What Real Analysis Looks Like

### Real Transcription:
```
"I was thinking about how to improve my speaking skills today. 
I noticed that I tend to rush when I'm nervous, and I want to 
work on slowing down and being more intentional with my words."
```

### Real Analysis Report:
```
"Your recording shows strong self-awareness and a clear focus on 
improvement. Your pacing was slightly rushed in the beginning, 
but you found a more comfortable rhythm as you continued. The 
content was thoughtful and well-structured. To improve, try 
incorporating more intentional pauses to give your ideas space 
to land."
```

### Mock Data (What You DON'T Want):
```
"This is a mock transcription for development purposes..."
"Mock analysis report. This would contain real analysis in production."
```

---

## 🔍 Quick Check: Is Backend Using OpenAI?

### Method 1: Check OpenAI Dashboard
1. Go to https://platform.openai.com/usage
2. Check if credits are being used
3. If no credits used → Backend isn't calling OpenAI

### Method 2: Check Flask Logs
```bash
# Look for OpenAI API calls
grep -i "openai\|whisper\|gpt" your-flask-logs.log

# Should see:
# "Calling OpenAI Whisper API..."
# "OpenAI transcription successful"
# "Calling OpenAI GPT-4 for analysis..."
```

### Method 3: Check Database
```sql
-- See what's actually stored
SELECT 
    transcription_text,
    analysis_report,
    created_at
FROM recordings
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

If you see real transcribed text and analysis → Backend is working ✅
If you see "mock" or "placeholder" → Backend needs to be fixed

---

## 💡 Frontend Debug Feature

I've added debug logging to `CompletedCard.tsx`. When you view a completed recording:

1. **Open Browser Console** (F12)
2. **Look for `[CompletedCard]` logs**
3. **Check the data**:
   - Transcription length
   - Analysis report length
   - Warnings if mock data detected

The frontend will also show a debug box in development mode with data summary.

---

## 🎯 Next Steps

1. **Check Flask backend logs** when uploading a recording
2. **Verify OpenAI API key** is set in backend
3. **Remove dev mode skips** if they exist
4. **Test with a real recording** and check console/database
5. **Verify OpenAI dashboard** shows API usage

The frontend is ready - it will display real analysis as soon as your backend provides it!
