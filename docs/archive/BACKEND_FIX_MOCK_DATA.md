# Fix Mock Data in Your Backend

## 🎯 Found Mock Data Locations

Based on your grep results, mock data is in:

1. **`routes/recordings.py`** - Dev mode checks and mock transcription
2. **`services/openai_service.py`** - Mock transcription return

---

## Step 1: Fix `routes/recordings.py`

### Find and Comment Out Dev Mode Check

Look for this pattern in `routes/recordings.py`:

```python
# In dev: skip storage and OpenAI, use mock data
if os.getenv('ENV') == 'development':
    # Dev mode: mock data
    transcript_text = "This is a mock transcription for development purposes..."
    # ... more mock code ...
```

### Solution: Comment Out the Dev Mode Block

```python
# TEMPORARILY DISABLED FOR TESTING REAL OPENAI
# if os.getenv('ENV') == 'development':
#     # Dev mode: mock data
#     transcript_text = "This is a mock transcription for development purposes. The user spoke about their presentation and how they felt nervous but prepared."
#     # ... rest of mock code ...
#     return jsonify({...})

# REAL OPENAI CODE (uncomment or ensure this runs)
# Your real transcription and analysis code here
```

### Or: Force Real Mode

Add a check at the top:

```python
# Force real OpenAI for testing
FORCE_REAL_OPENAI = os.getenv('FORCE_REAL_OPENAI', 'false') == 'true'

# In dev: skip storage and OpenAI, use mock data
if not FORCE_REAL_OPENAI and os.getenv('ENV') == 'development':
    # Dev mode: mock data
    transcript_text = "This is a mock transcription..."
    # ... mock code ...
    return jsonify({...})

# Real OpenAI code continues here...
```

Then set:
```bash
export FORCE_REAL_OPENAI=true
```

---

## Step 2: Fix `services/openai_service.py`

### Find Mock Transcription Function

Look for this in `services/openai_service.py`:

```python
# Return deterministic placeholder
"text": "This is a mock transcription for development purposes. The user spoke about their presentation and how they felt nervous but prepared.",
```

### Solution: Comment Out Mock Return

```python
def transcribe_audio(audio_file_path):
    # TEMPORARILY DISABLED FOR TESTING
    # if os.getenv('ENV') == 'development':
    #     return {
    #         "text": "This is a mock transcription for development purposes..."
    #     }
    
    # REAL OPENAI CODE
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    
    openai.api_key = api_key
    
    with open(audio_file_path, 'rb') as audio_file:
        transcription = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file
        )
        return transcription.text
```

---

## Step 3: Quick Fix Script

Create a simple script to help you toggle:

```python
# scripts/toggle_real_openai.py
import os
import re

def toggle_real_openai(enable_real=True):
    """Toggle between real OpenAI and mock data."""
    
    files_to_fix = [
        'routes/recordings.py',
        'services/openai_service.py'
    ]
    
    for file_path in files_to_fix:
        if not os.path.exists(file_path):
            print(f"⚠️  File not found: {file_path}")
            continue
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        if enable_real:
            # Comment out dev mode checks
            content = re.sub(
                r'if\s+os\.getenv\([\'"]ENV[\'"]\)\s*==\s*[\'"]development[\'"]:',
                r'# TEMP DISABLED FOR REAL OPENAI TESTING\n        # if os.getenv(\'ENV\') == \'development\':',
                content
            )
            print(f"✅ Disabled mock data in {file_path}")
        else:
            # Uncomment dev mode checks
            content = re.sub(
                r'# TEMP DISABLED FOR REAL OPENAI TESTING\n\s*# if os\.getenv\([\'"]ENV[\'"]\)\s*==\s*[\'"]development[\'"]:',
                r'if os.getenv(\'ENV\') == \'development\':',
                content
            )
            print(f"✅ Re-enabled mock data in {file_path}")
        
        with open(file_path, 'w') as f:
            f.write(content)

if __name__ == '__main__':
    import sys
    enable = sys.argv[1] == 'true' if len(sys.argv) > 1 else True
    toggle_real_openai(enable)
```

---

## Step 4: Manual Fix (Recommended)

### File 1: `routes/recordings.py`

Find the section that looks like:

```python
# In dev: skip storage and OpenAI, use mock data
if os.getenv('ENV') == 'development':
    # Dev mode: mock data
    transcript_text = "This is a mock transcription for development purposes. The user spoke about their presentation and how they felt nervous but prepared."
    
    # ... more mock code ...
    
    audio_url = f"dev-placeholder://{user_id}/{session_id}{ext}"
    
    # ... return mock response ...
```

**Change to:**

```python
# TEMPORARILY DISABLED FOR TESTING REAL OPENAI
# In dev: skip storage and OpenAI, use mock data
# if os.getenv('ENV') == 'development':
#     # Dev mode: mock data
#     transcript_text = "This is a mock transcription for development purposes. The user spoke about their presentation and how they felt nervous but prepared."
#     
#     # ... comment out rest of mock code ...
#     
#     audio_url = f"dev-placeholder://{user_id}/{session_id}{ext}"
#     
#     # ... comment out return ...
#     # return jsonify({...})

# REAL OPENAI CODE CONTINUES HERE
# (Make sure your real OpenAI transcription and analysis code runs)
```

### File 2: `services/openai_service.py`

Find the section that returns mock transcription:

```python
# Return deterministic placeholder
"text": "This is a mock transcription for development purposes. The user spoke about their presentation and how they felt nervous but prepared.",
```

**Change to:**

```python
# TEMPORARILY DISABLED FOR TESTING
# if os.getenv('ENV') == 'development':
#     return {
#         "text": "This is a mock transcription for development purposes. The user spoke about their presentation and how they felt nervous but prepared.",
#     }

# REAL OPENAI CODE
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    raise ValueError("OPENAI_API_KEY not set")

openai.api_key = api_key

with open(audio_file_path, 'rb') as audio_file:
    transcription = openai.Audio.transcribe(
        model="whisper-1",
        file=audio_file
    )
    return transcription.text
```

---

## Step 5: Verify OpenAI API Key

```bash
# Check if set
echo $OPENAI_API_KEY

# If not set, set it:
export OPENAI_API_KEY="sk-your-actual-key-here"

# Or add to .env file in backend directory
echo "OPENAI_API_KEY=sk-your-actual-key-here" >> .env
```

---

## Step 6: Test

### 1. Restart Flask Server

```bash
# Stop current server (Ctrl+C)
# Restart
python app.py
# or
flask run
```

### 2. Check Logs

Look for:
- ✅ `Calling OpenAI Whisper API...`
- ✅ `Transcription successful`
- ✅ `Calling OpenAI GPT-4...`

**NOT:**
- ❌ `Dev mode: mock data`
- ❌ `Using placeholder`

### 3. Upload a Recording

1. Go to frontend
2. Record a short test (10-30 seconds)
3. Upload
4. Check Flask logs for OpenAI calls

### 4. Verify Database

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

**Should see:**
- Real transcribed words (not "mock transcription...")
- Real analysis (not mock text)

---

## Step 7: Verify OpenAI Dashboard

1. Go to https://platform.openai.com/usage
2. Check for:
   - Whisper API calls
   - Chat Completion calls
   - Credits being used

---

## Quick Checklist

- [ ] Commented out dev mode check in `routes/recordings.py`
- [ ] Commented out mock return in `services/openai_service.py`
- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Restarted Flask server
- [ ] Uploaded test recording
- [ ] Checked Flask logs for real API calls
- [ ] Verified database has real data
- [ ] Checked OpenAI dashboard for API usage

---

## After Testing

Once you've verified OpenAI works:

1. **Keep real OpenAI** - Remove mock code completely
2. **Restore mock data** - Uncomment for faster development
3. **Use toggle system** - See `BACKEND_DEV_PROD_WORKFLOW.md`

---

## Troubleshooting

### Still seeing mock data?

1. **Check you saved files** - Make sure changes were saved
2. **Restart Flask** - Changes require server restart
3. **Check logs** - Look for "mock" or "dev mode" messages
4. **Verify code** - Make sure you commented out the right sections

### OpenAI not working?

1. **Test API key**:
   ```python
   import os
   print(os.getenv('OPENAI_API_KEY'))
   ```

2. **Check Flask logs** - Look for error messages
3. **Verify audio file** - Make sure it's valid format

---

## Summary

**Files to edit:**
1. `routes/recordings.py` - Comment out dev mode block
2. `services/openai_service.py` - Comment out mock return

**Then:**
- Set `OPENAI_API_KEY`
- Restart Flask
- Test upload
- Verify results

That's it! You should now see real OpenAI transcription and analysis.
