# Backend Development vs Production Workflow

## 🎯 Goal

Design a workflow where:
- **Development Mode**: Can use mock data (fast, no cost) OR real OpenAI (for testing)
- **Production Mode**: Always uses real OpenAI (no mock data)

This allows you to:
- ✅ Test quickly in dev with mock data
- ✅ Test OpenAI integration in dev when needed
- ✅ Ensure production always uses real analysis

---

## 🔧 Implementation: Environment-Based Configuration

### Step 1: Environment Variables

Create a `.env` file in your Flask backend:

```bash
# Environment
ENV=development  # or "production"

# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-key-here

# Development Mode: Use real OpenAI or mock data?
USE_REAL_OPENAI_IN_DEV=false  # Set to "true" to test OpenAI in dev mode

# Alternative: More explicit control
OPENAI_MODE=mock  # Options: "real" | "mock" | "auto"
# - "real": Always use OpenAI (even in dev)
# - "mock": Use mock data (dev only, production ignores this)
# - "auto": Use real in production, mock in dev
```

### Step 2: Configuration Helper Function

```python
# In your Flask backend: app/config.py
import os
from typing import Literal

def get_openai_mode() -> Literal["real", "mock"]:
    """
    Determine whether to use real OpenAI or mock data.
    
    Returns:
        "real" - Use OpenAI API
        "mock" - Use mock/placeholder data
    """
    env = os.getenv('ENV', 'development').lower()
    openai_mode = os.getenv('OPENAI_MODE', 'auto').lower()
    use_real_in_dev = os.getenv('USE_REAL_OPENAI_IN_DEV', 'false').lower() == 'true'
    
    # Production always uses real OpenAI
    if env == 'production':
        return "real"
    
    # Development mode logic
    if openai_mode == "real":
        # Explicitly set to use real OpenAI
        return "real"
    elif openai_mode == "mock":
        # Explicitly set to use mock data
        return "mock"
    elif use_real_in_dev:
        # USE_REAL_OPENAI_IN_DEV=true means test OpenAI in dev
        return "real"
    else:
        # Default: use mock in dev
        return "mock"
```

---

## 🔧 Step 3: Updated Transcription Function

```python
# In your Flask backend: app/services/openai_service.py
import openai
import os
import logging
from app.config import get_openai_mode

logger = logging.getLogger(__name__)

def transcribe_audio(audio_file_path: str) -> str:
    """
    Transcribe audio file using OpenAI Whisper API or mock data.
    
    Args:
        audio_file_path: Path to audio file
    
    Returns:
        Transcribed text as string
    
    Raises:
        ValueError: If OPENAI_API_KEY not set when using real OpenAI
        openai.error.OpenAIError: If OpenAI API call fails
    """
    mode = get_openai_mode()
    
    if mode == "mock":
        # Development mode: return mock data
        logger.info("🔧 DEV MODE: Using mock transcription")
        return "This is a mock transcription for development purposes. The user spoke about their goals and challenges. In production, this would be the actual transcribed text from OpenAI Whisper."
    
    # Real OpenAI mode
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    openai.api_key = api_key
    
    logger.info("✅ Using real OpenAI Whisper API for transcription...")
    
    with open(audio_file_path, 'rb') as audio_file:
        transcription = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file
        )
        
        text = transcription.text.strip()
        logger.info(f"✅ Transcription successful: {len(text)} characters")
        
        return text
```

---

## 🔧 Step 4: Updated Analysis Function

```python
# In your Flask backend: app/services/openai_service.py
import openai
import os
import logging
from app.config import get_openai_mode

logger = logging.getLogger(__name__)

def analyze_recording(
    transcription: str,
    user_id: str = None,
    admin_notes: str = None,
    custom_instructions: str = None
) -> str:
    """
    Analyze transcription using OpenAI GPT-4 or mock data.
    
    Args:
        transcription: Transcribed text from recording
        user_id: Optional user ID for context
        admin_notes: Optional admin notes to include
        custom_instructions: Optional custom analysis instructions
    
    Returns:
        Analysis report as string
    """
    mode = get_openai_mode()
    
    if mode == "mock":
        # Development mode: return mock analysis
        logger.info("🔧 DEV MODE: Using mock analysis")
        return """This is a mock analysis report for development purposes.

Overall Assessment:
Your recording shows good structure and clear communication. You maintained a steady pace throughout.

Key Strengths:
- Clear articulation
- Good use of pauses
- Well-organized thoughts

Areas for Improvement:
- Consider reducing filler words
- Work on varying your pace for emphasis

Recommendations:
1. Practice with longer pauses between ideas
2. Focus on eliminating "um" and "uh" patterns
3. Record yourself more frequently to track progress

In production, this would be a personalized analysis generated by OpenAI GPT-4 based on your actual recording."""
    
    # Real OpenAI mode
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    
    openai.api_key = api_key
    
    # Build prompt
    prompt = f"""Analyze this speech recording and provide coaching feedback.

Transcription:
{transcription}

"""
    
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
    
    logger.info("✅ Using real OpenAI GPT-4 for analysis...")
    
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
    logger.info(f"✅ Analysis successful: {len(analysis)} characters")
    
    return analysis
```

---

## 🧪 Step 5: Testing Workflow

### Scenario 1: Development with Mock Data (Default)

```bash
# .env file
ENV=development
OPENAI_API_KEY=sk-your-key-here
USE_REAL_OPENAI_IN_DEV=false
# or
OPENAI_MODE=mock
```

**Result:**
- ✅ Fast development (no API calls)
- ✅ No OpenAI costs
- ✅ Mock data returned
- ✅ Logs show: `🔧 DEV MODE: Using mock transcription`

### Scenario 2: Development with Real OpenAI (Testing)

```bash
# .env file
ENV=development
OPENAI_API_KEY=sk-your-key-here
USE_REAL_OPENAI_IN_DEV=true
# or
OPENAI_MODE=real
```

**Result:**
- ✅ Real OpenAI API calls
- ✅ Real transcription and analysis
- ✅ OpenAI credits consumed
- ✅ Logs show: `✅ Using real OpenAI Whisper API...`
- ✅ Can verify OpenAI integration works

### Scenario 3: Production (Always Real)

```bash
# .env file
ENV=production
OPENAI_API_KEY=sk-your-key-here
# USE_REAL_OPENAI_IN_DEV is ignored in production
```

**Result:**
- ✅ Always uses real OpenAI
- ✅ Mock data never returned
- ✅ Production-ready

---

## 🔍 Step 6: Add Logging to Show Current Mode

```python
# In your Flask backend startup (e.g., app/__init__.py)
import logging
from app.config import get_openai_mode

logger = logging.getLogger(__name__)

def log_startup_config():
    """Log the current OpenAI configuration on startup."""
    env = os.getenv('ENV', 'development')
    mode = get_openai_mode()
    
    logger.info("=" * 60)
    logger.info("🚀 Flask Backend Starting")
    logger.info(f"   Environment: {env.upper()}")
    logger.info(f"   OpenAI Mode: {mode.upper()}")
    
    if mode == "mock":
        logger.info("   ⚠️  Using MOCK data (no OpenAI API calls)")
        logger.info("   💡 Set USE_REAL_OPENAI_IN_DEV=true to test OpenAI")
    else:
        logger.info("   ✅ Using REAL OpenAI API")
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            logger.info(f"   ✅ API Key: {api_key[:10]}...")
        else:
            logger.warning("   ⚠️  OPENAI_API_KEY not set!")
    
    logger.info("=" * 60)

# Call on startup
log_startup_config()
```

---

## 📋 Step 7: Quick Toggle Script

Create a helper script to toggle between modes:

```bash
# scripts/toggle_openai_mode.sh
#!/bin/bash

ENV_FILE=".env"

if grep -q "USE_REAL_OPENAI_IN_DEV=true" "$ENV_FILE"; then
    echo "Switching to MOCK mode (dev)..."
    sed -i '' 's/USE_REAL_OPENAI_IN_DEV=true/USE_REAL_OPENAI_IN_DEV=false/' "$ENV_FILE"
    echo "✅ Now using mock data"
elif grep -q "USE_REAL_OPENAI_IN_DEV=false" "$ENV_FILE"; then
    echo "Switching to REAL OpenAI mode (dev)..."
    sed -i '' 's/USE_REAL_OPENAI_IN_DEV=false/USE_REAL_OPENAI_IN_DEV=true/' "$ENV_FILE"
    echo "✅ Now using real OpenAI"
else
    echo "Adding USE_REAL_OPENAI_IN_DEV=true to .env..."
    echo "USE_REAL_OPENAI_IN_DEV=true" >> "$ENV_FILE"
    echo "✅ Now using real OpenAI"
fi

echo ""
echo "Restart Flask server to apply changes."
```

Make it executable:
```bash
chmod +x scripts/toggle_openai_mode.sh
```

Usage:
```bash
./scripts/toggle_openai_mode.sh
```

---

## 🎯 Recommended Workflow

### Daily Development (Mock Data)

```bash
# .env
ENV=development
USE_REAL_OPENAI_IN_DEV=false
```

- Fast iteration
- No API costs
- Test frontend/backend integration

### Testing OpenAI Integration (Real API)

```bash
# .env
ENV=development
USE_REAL_OPENAI_IN_DEV=true
```

- Test OpenAI calls
- Verify API key works
- Check transcription quality
- Verify analysis generation

### Production Deployment

```bash
# .env
ENV=production
OPENAI_API_KEY=sk-production-key
```

- Always uses real OpenAI
- Mock data never returned
- Production-ready

---

## ✅ Verification Checklist

### Check Current Mode

```python
# In Flask Python shell or add to a test endpoint
from app.config import get_openai_mode

mode = get_openai_mode()
print(f"Current OpenAI mode: {mode}")
```

### Test Endpoint to Check Mode

```python
# In your Flask backend: app/routes/test.py
from flask import Blueprint, jsonify
from app.config import get_openai_mode
import os

test_bp = Blueprint('test', __name__)

@test_bp.route('/test/openai-mode', methods=['GET'])
def test_openai_mode():
    """Check current OpenAI configuration."""
    return jsonify({
        "environment": os.getenv('ENV', 'development'),
        "openai_mode": get_openai_mode(),
        "use_real_in_dev": os.getenv('USE_REAL_OPENAI_IN_DEV', 'false'),
        "openai_key_set": bool(os.getenv('OPENAI_API_KEY')),
        "openai_key_preview": os.getenv('OPENAI_API_KEY', '')[:10] + "..." if os.getenv('OPENAI_API_KEY') else None
    })
```

Test it:
```bash
curl http://localhost:5000/test/openai-mode
```

---

## 🐛 Troubleshooting

### Issue: Still seeing mock data when USE_REAL_OPENAI_IN_DEV=true

**Fix:**
1. Restart Flask server after changing .env
2. Check logs for mode on startup
3. Verify .env file is being loaded

### Issue: OpenAI calls failing in dev mode

**Fix:**
1. Verify `OPENAI_API_KEY` is set
2. Check API key is valid
3. Check OpenAI dashboard for errors
4. Review Flask logs for error messages

### Issue: Want to test OpenAI but keep costs low

**Solution:**
- Use `USE_REAL_OPENAI_IN_DEV=true` only when testing
- Switch back to `false` for regular development
- Use short test recordings to minimize costs

---

## 📝 Summary

**Development Mode Options:**
- `USE_REAL_OPENAI_IN_DEV=false` → Mock data (fast, free)
- `USE_REAL_OPENAI_IN_DEV=true` → Real OpenAI (for testing)

**Production Mode:**
- Always uses real OpenAI (ignores dev flags)

**Benefits:**
- ✅ Fast development with mock data
- ✅ Easy testing of OpenAI integration
- ✅ Production safety (always real)
- ✅ Clear logging of current mode

This gives you the flexibility to develop quickly with mocks, but easily test real OpenAI when needed!
