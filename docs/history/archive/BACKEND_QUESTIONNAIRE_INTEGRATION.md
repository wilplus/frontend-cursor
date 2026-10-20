# Backend Integration: Pre-Recording Questionnaire

## Overview

The frontend now sends a 3-question questionnaire before starting a session. Your Flask backend needs to:
1. Receive the questionnaire data
2. Calculate a difficulty cursor (0.0-1.0)
3. Determine the mode (guided vs open)
4. Select appropriate commands based on cursor
5. Generate personalized pre-questions

---

## API Contract

### Request: `POST /session/start`

**Body:**
```json
{
  "questionnaire": {
    "mood": "positive" | "negative",  // 🙂 = "positive", 🙁 = "negative"
    "readiness": 1-10,                 // Integer 1-10
    "inspiration_needed": true | false // YES = true, NO = false
  }
}
```

**Note:** `questionnaire` is optional. If not provided, use default values or skip cursor calculation.

### Response: `POST /session/start`

**Body:**
```json
{
  "session_id": "uuid",
  "pre_questions": [
    {
      "id": "uuid",
      "question_text": "string",
      "order_index": 0
    }
  ],
  "cursor": 0.42,           // Optional: calculated difficulty cursor
  "mode": "guided" | "open" // Optional: structure mode
}
```

---

## Step 1: Calculate Difficulty Cursor

```python
def calculate_cursor(mood: str, readiness: int) -> float:
    """
    Calculate difficulty cursor (0.0 - 1.0)
    
    Formula:
    - mood_multiplier: positive = 1.0, negative = 0.7
    - readiness_score: (readiness - 1) / 9  (normalizes 1-10 to 0.0-1.0)
    - cursor = readiness_score * mood_multiplier
    """
    mood_multiplier = 1.0 if mood == "positive" else 0.7
    readiness_score = (readiness - 1) / 9.0
    cursor = readiness_score * mood_multiplier
    
    # Clamp to 0.0-1.0 range
    return max(0.0, min(1.0, cursor))
```

**Examples:**
- `mood="positive", readiness=10` → `cursor = (10-1)/9 * 1.0 = 1.0`
- `mood="positive", readiness=5` → `cursor = (5-1)/9 * 1.0 = 0.44`
- `mood="negative", readiness=5` → `cursor = (5-1)/9 * 0.7 = 0.31`
- `mood="negative", readiness=1` → `cursor = (1-1)/9 * 0.7 = 0.0`

---

## Step 2: Determine Mode

```python
def determine_mode(inspiration_needed: bool) -> str:
    """
    Determine structure mode based on inspiration need
    """
    return "guided" if inspiration_needed else "open"
```

---

## Step 3: Command Tier Selection

### Command Tiers (20 commands, 5 tiers)

Store these as **intent definitions**, not fixed text:

```python
COMMANDS = [
    # Tier 1: Safety & permission (0.00–0.15)
    {
        "id": 1,
        "tier": 1,
        "cursor_range": (0.00, 0.15),
        "intent": "permission_imperfect",
        "mode": ["guided", "open"],
        "constraints": {"tone": "supportive", "pressure": "none"}
    },
    {
        "id": 2,
        "tier": 1,
        "cursor_range": (0.00, 0.15),
        "intent": "micro_start",
        "mode": ["guided", "open"],
        "constraints": {"length": "one_sentence", "pressure": "none"}
    },
    {
        "id": 3,
        "tier": 1,
        "cursor_range": (0.00, 0.15),
        "intent": "gentle_checkin",
        "mode": ["guided", "open"],
        "constraints": {"scope": "feelings_only", "pressure": "none"}
    },
    {
        "id": 4,
        "tier": 1,
        "cursor_range": (0.00, 0.15),
        "intent": "breath_voice",
        "mode": ["guided", "open"],
        "constraints": {"tone": "calming", "pressure": "none"}
    },
    
    # Tier 2: Low activation (0.15–0.30)
    {
        "id": 5,
        "tier": 2,
        "cursor_range": (0.15, 0.30),
        "intent": "describe_obvious",
        "mode": ["guided", "open"],
        "constraints": {"scope": "immediate_environment"}
    },
    {
        "id": 6,
        "tier": 2,
        "cursor_range": (0.15, 0.30),
        "intent": "simple_opinion",
        "mode": ["guided", "open"],
        "constraints": {"length": "one_thing", "detail": "minimal"}
    },
    {
        "id": 7,
        "tier": 2,
        "cursor_range": (0.15, 0.30),
        "intent": "short_memory",
        "mode": ["guided", "open"],
        "constraints": {"timeframe": "today", "detail": "minimal"}
    },
    {
        "id": 8,
        "tier": 2,
        "cursor_range": (0.15, 0.30),
        "intent": "reading_aloud",
        "mode": ["guided"],
        "constraints": {"length": "short_sentence"}
    },
    
    # Tier 3: Warm-up speaking (0.30–0.45)
    {
        "id": 9,
        "tier": 3,
        "cursor_range": (0.30, 0.45),
        "intent": "explain_simply",
        "mode": ["guided", "open"],
        "constraints": {"audience": "friend", "complexity": "simple"}
    },
    {
        "id": 10,
        "tier": 3,
        "cursor_range": (0.30, 0.45),
        "intent": "list_format",
        "mode": ["guided", "open"],
        "constraints": {"format": "list", "items": 3, "detail": "none"}
    },
    {
        "id": 11,
        "tier": 3,
        "cursor_range": (0.30, 0.45),
        "intent": "slow_clarity",
        "mode": ["guided", "open"],
        "constraints": {"pace": "slower_than_natural"}
    },
    {
        "id": 12,
        "tier": 3,
        "cursor_range": (0.30, 0.45),
        "intent": "neutral_story",
        "mode": ["guided", "open"],
        "constraints": {"tone": "neutral", "emotion": "none"}
    },
    
    # Tier 4: Engagement & structure (0.45–0.60)
    {
        "id": 13,
        "tier": 4,
        "cursor_range": (0.45, 0.60),
        "intent": "personal_reflection",
        "mode": ["guided", "open"],
        "constraints": {"depth": "personal", "scope": "why_matters"}
    },
    {
        "id": 14,
        "tier": 4,
        "cursor_range": (0.45, 0.60),
        "intent": "teach_back",
        "mode": ["guided", "open"],
        "constraints": {"format": "teaching", "clarity": "high"}
    },
    {
        "id": 15,
        "tier": 4,
        "cursor_range": (0.45, 0.60),
        "intent": "contrast",
        "mode": ["guided", "open"],
        "constraints": {"format": "before_vs_after"}
    },
    {
        "id": 16,
        "tier": 4,
        "cursor_range": (0.45, 0.60),
        "intent": "time_constraint",
        "mode": ["guided", "open"],
        "constraints": {"time_limit": 60, "focus": "high"}
    },
    
    # Tier 5: Challenge & edge (0.60–0.80)
    {
        "id": 17,
        "tier": 5,
        "cursor_range": (0.60, 0.80),
        "intent": "strong_opinion",
        "mode": ["guided", "open"],
        "constraints": {"tone": "assertive", "stance": "required"}
    },
    {
        "id": 18,
        "tier": 5,
        "cursor_range": (0.60, 0.80),
        "intent": "energy_push",
        "mode": ["guided", "open"],
        "constraints": {"volume": "higher", "intention": "stronger"}
    },
    {
        "id": 19,
        "tier": 5,
        "cursor_range": (0.60, 0.80),
        "intent": "no_fillers_challenge",
        "mode": ["guided", "open"],
        "constraints": {"challenge": "pause_instead_of_um"}
    },
    {
        "id": 20,
        "tier": 5,
        "cursor_range": (0.60, 0.80),
        "intent": "cheeky_pressure",
        "mode": ["guided", "open"],
        "constraints": {"tone": "playful_pressure", "attempts": 1}
    },
]
```

---

## Step 4: Select Commands Based on Cursor

```python
def select_commands(cursor: float, mode: str, num_questions: int = 3) -> list:
    """
    Select commands based on cursor and mode
    
    Strategy:
    - Find commands where cursor falls within cursor_range
    - Filter by mode compatibility
    - Select num_questions commands (prioritize lower tiers if multiple match)
    - If not enough in exact tier, include adjacent tiers
    """
    # Find commands matching cursor range
    matching = [
        cmd for cmd in COMMANDS
        if cmd["cursor_range"][0] <= cursor <= cmd["cursor_range"][1]
        and mode in cmd["mode"]
    ]
    
    # If not enough, expand to adjacent tiers
    if len(matching) < num_questions:
        # Find tier of matching commands
        tiers = set(cmd["tier"] for cmd in matching) if matching else {1}
        min_tier = min(tiers)
        max_tier = max(tiers)
        
        # Include adjacent tiers
        expanded = [
            cmd for cmd in COMMANDS
            if (min_tier - 1 <= cmd["tier"] <= max_tier + 1)
            and mode in cmd["mode"]
        ]
        matching = expanded
    
    # Sort by tier (lower = easier) and select
    matching.sort(key=lambda x: x["tier"])
    selected = matching[:num_questions]
    
    return selected
```

---

## Step 5: Generate Questions Using AI

**Important:** Don't use fixed text. Generate dynamically based on command intent.

### Option A: Using OpenAI/Anthropic

```python
import openai  # or anthropic

def generate_question_from_command(command: dict, cursor: float, mode: str) -> str:
    """
    Generate a personalized question based on command intent
    """
    prompt = f"""Generate a recording challenge aligned with Command {command['id']}: {command['intent']}.

Context:
- Mode: {mode}
- Difficulty cursor: {cursor:.2f} (0.0 = easiest, 1.0 = hardest)
- Tier: {command['tier']}
- Constraints: {command['constraints']}

Requirements:
- Be supportive, not demanding
- Match the user's readiness level (cursor {cursor:.2f})
- Respect the intent: {command['intent']}
- If mode is "guided", provide more structure
- If mode is "open", allow more freedom
- Keep it conversational and encouraging
- Don't repeat previous questions

Generate ONE question/prompt that fits this command. Be natural and adaptive."""

    response = openai.ChatCompletion.create(
        model="gpt-4",  # or "gpt-3.5-turbo" for cost savings
        messages=[
            {"role": "system", "content": "You are a supportive speaking coach. Generate personalized recording challenges that match the user's readiness level."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=150
    )
    
    return response.choices[0].message.content.strip()
```

### Option B: Using Template System (Simpler, No AI)

```python
TEMPLATES = {
    "permission_imperfect": [
        "You don't need to perform. Just share one thought that's on your mind.",
        "There's no pressure here. Say whatever comes to you naturally.",
        "Take your time. What's one thing you'd like to express right now?",
    ],
    "micro_start": [
        "Say one sentence about how you're feeling.",
        "Share just one thought—nothing more.",
        "One sentence. That's all. What comes to mind?",
    ],
    # ... more templates for each intent
}

def generate_question_from_command(command: dict, cursor: float, mode: str) -> str:
    """
    Generate question using templates (rotates to avoid repetition)
    """
    intent = command["intent"]
    templates = TEMPLATES.get(intent, ["Tell me about something."])
    
    # Rotate based on session/user to avoid repetition
    # You could store last_used_index per user in database
    selected = templates[0]  # Or implement rotation logic
    
    return selected
```

---

## Step 6: Complete Implementation

```python
from flask import Blueprint, request, jsonify
from your_auth import verify_token, get_user_id_from_token
from your_db import create_session, create_questions

session_bp = Blueprint('session', __name__)

@session_bp.route('/session/start', methods=['POST'])
def start_session():
    # 1. Verify token
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        user_id = get_user_id_from_token(token)
    except Exception as e:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # 2. Parse request body
    data = request.get_json() or {}
    questionnaire = data.get('questionnaire')
    
    # 3. Calculate cursor and mode
    if questionnaire:
        mood = questionnaire.get('mood', 'positive')
        readiness = questionnaire.get('readiness', 5)
        inspiration_needed = questionnaire.get('inspiration_needed', False)
        
        cursor = calculate_cursor(mood, readiness)
        mode = determine_mode(inspiration_needed)
    else:
        # Default values if no questionnaire
        cursor = 0.5
        mode = "open"
    
    # 4. Select commands
    selected_commands = select_commands(cursor, mode, num_questions=3)
    
    # 5. Generate questions
    questions = []
    for idx, command in enumerate(selected_commands):
        question_text = generate_question_from_command(command, cursor, mode)
        
        # Save to database
        question_id = create_question(
            session_id=None,  # Will be set after session creation
            question_text=question_text,
            order_index=idx,
            command_id=command['id'],
            cursor=cursor,
            mode=mode
        )
        
        questions.append({
            'id': question_id,
            'question_text': question_text,
            'order_index': idx
        })
    
    # 6. Create session
    # IMPORTANT: If questionnaire is provided, pre_questions_completed = True
    # The questionnaire replaces the old pre-questions form
    pre_questions_completed = bool(questionnaire)  # True if questionnaire provided
    
    session_id = create_session(
        user_id=user_id,
        cursor=cursor,
        mode=mode,
        questionnaire_data=questionnaire,
        pre_questions_completed=pre_questions_completed  # ✅ Set to True when questionnaire submitted
    )
    
    # 7. Link questions to session
    for question in questions:
        update_question_session(question['id'], session_id)
    
    # 8. Return response
    return jsonify({
        'session_id': session_id,
        'pre_questions': questions,
        'cursor': cursor,
        'mode': mode
    })
```

---

## Database Schema Updates

**CRITICAL:** The `pre_questions_completed` column must be set to `TRUE` when a questionnaire is submitted.

Run this SQL script first: `supabase-fix-questionnaire-flow.sql`

You may also want to store questionnaire data for analytics:

```sql
-- Add columns to recording_sessions table
ALTER TABLE recording_sessions
ADD COLUMN IF NOT EXISTS mood TEXT,
ADD COLUMN IF NOT EXISTS readiness INTEGER,
ADD COLUMN IF NOT EXISTS inspiration_needed BOOLEAN,
ADD COLUMN IF NOT EXISTS cursor NUMERIC,
ADD COLUMN IF NOT EXISTS mode TEXT;

-- Ensure pre_questions_completed exists and defaults correctly
ALTER TABLE recording_sessions
ADD COLUMN IF NOT EXISTS pre_questions_completed BOOLEAN DEFAULT FALSE;

-- Add columns to pre_questions table (if you want to track which command generated each question)
ALTER TABLE pre_questions
ADD COLUMN IF NOT EXISTS command_id INTEGER,
ADD COLUMN IF NOT EXISTS cursor NUMERIC,
ADD COLUMN IF NOT EXISTS mode TEXT;
```

**Important:** When creating a session with a questionnaire, set `pre_questions_completed = TRUE` immediately.

---

## Testing

Test with different questionnaire inputs:

```bash
# Low readiness, negative mood, needs inspiration
curl -X POST http://localhost:5000/session/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionnaire": {
      "mood": "negative",
      "readiness": 2,
      "inspiration_needed": true
    }
  }'

# High readiness, positive mood, no inspiration needed
curl -X POST http://localhost:5000/session/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionnaire": {
      "mood": "positive",
      "readiness": 9,
      "inspiration_needed": false
    }
  }'
```

---

## Key Points

1. **Store command definitions, not fixed text** - This allows AI to adapt wording
2. **Use cursor to select tier** - Lower cursor = easier commands (Tier 1-2)
3. **Respect mode** - "guided" = more structure, "open" = more freedom
4. **Generate dynamically** - Use AI or templates to avoid repetition
5. **Return cursor/mode in response** - Helps with debugging and analytics

---

## Next Steps

1. Implement `calculate_cursor()` function
2. Implement `determine_mode()` function
3. Create command definitions (store in database or config file)
4. Implement `select_commands()` function
5. Set up AI generation (OpenAI/Anthropic) or template system
6. Update `/session/start` endpoint
7. Test with various questionnaire inputs
8. Monitor cursor distribution and adjust tiers if needed
