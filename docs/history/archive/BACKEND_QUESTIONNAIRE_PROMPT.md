# Backend Implementation Prompt: Questionnaire Flow

## ⚠️ CRITICAL REQUIREMENT

**When a questionnaire is submitted, the backend MUST set `pre_questions_completed = TRUE` immediately.**

The questionnaire **replaces** the old pre-questions form. Submitting the questionnaire = completing pre-questions.

**If you don't set this flag, users will get "Pre-questions must be completed first" error when trying to upload.**

---

## Backend Implementation

### 1. `/session/start` Endpoint Logic

```python
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
    
    # 3. Determine if questionnaire was submitted
    has_questionnaire = questionnaire is not None
    
    # 4. Calculate cursor and mode (if questionnaire provided)
    if has_questionnaire:
        mood = questionnaire.get('mood', 'positive')
        readiness = questionnaire.get('readiness', 5)
        inspiration_needed = questionnaire.get('inspiration_needed', False)
        
        # Calculate cursor: (readiness - 1) / 9 * mood_multiplier
        mood_multiplier = 1.0 if mood == "positive" else 0.7
        readiness_score = (readiness - 1) / 9.0
        cursor = max(0.0, min(1.0, readiness_score * mood_multiplier))
        
        # Determine mode: "guided" if inspiration_needed, else "open"
        mode = "guided" if inspiration_needed else "open"
        
        # ✅✅✅ CRITICAL: Questionnaire submission = pre-questions completed
        # THIS IS THE KEY FIX - Without this, upload will fail!
        pre_questions_completed = True
        session_status = 'recording_ready'  # Start at recording_ready, not pre_questions_pending
    else:
        # No questionnaire - old flow (backward compatibility)
        cursor = None
        mode = None
        mood = None
        readiness = None
        inspiration_needed = None
        pre_questions_completed = False
        session_status = 'pre_questions_pending'
    
    # 5. Select command and generate prompt (only if questionnaire provided)
    generated_questions = []
    if has_questionnaire:
        selected_commands = select_commands(cursor, mode, num_questions=1)  # Generate 1 prompt
        
        # Generate the recording prompt based on selected command
        generated_prompt = generate_question_from_command(selected_commands[0], cursor, mode)
        
        generated_questions.append({
            'question_text': generated_prompt,
            'order_index': 0
        })
    
    # 6. Create session
    # ✅✅✅ CRITICAL: Must pass pre_questions_completed = True if questionnaire provided
    session_id = create_session(
        user_id=user_id,
        status=session_status,  # 'recording_ready' if questionnaire, else 'pre_questions_pending'
        pre_questions_completed=pre_questions_completed,  # ✅✅✅ MUST BE TRUE if questionnaire!
        cursor=cursor,
        mode=mode,
        mood=mood,
        readiness=readiness,
        inspiration_needed=inspiration_needed,
    )
    
    # 7. Create question record (if generated)
    if generated_questions:
        question_id = create_question(
            session_id=session_id,
            question_text=generated_questions[0]['question_text'],
            order_index=0,
            command_id=selected_commands[0]['id'] if has_questionnaire else None,
            cursor=cursor,
            mode=mode
        )
        generated_questions[0]['id'] = question_id
    
    # 8. Return response
    return jsonify({
        'session_id': session_id,
        'pre_questions': generated_questions,  # AI-generated prompt(s)
        'cursor': cursor,
        'mode': mode
    })
```

### 2. Session Creation Function

```python
def create_session(
    user_id: str,
    status: str = 'pre_questions_pending',
    pre_questions_completed: bool = False,  # ✅✅✅ MUST BE TRUE if questionnaire submitted!
    cursor: float = None,
    mode: str = None,
    mood: str = None,
    readiness: int = None,
    inspiration_needed: bool = None,
):
    """
    Create a new recording session.
    
    ⚠️ CRITICAL: pre_questions_completed MUST be True if questionnaire was submitted!
    If False, users will get "Pre-questions must be completed first" error on upload.
    
    Args:
        pre_questions_completed: MUST be True if questionnaire was submitted
        status: Should be 'recording_ready' if questionnaire submitted, else 'pre_questions_pending'
    """
    session = RecordingSession(
        user_id=user_id,
        status=status,  # 'recording_ready' if questionnaire, 'pre_questions_pending' otherwise
        pre_questions_completed=pre_questions_completed,  # ✅✅✅ CRITICAL: Must be True for questionnaire!
        cursor=cursor,
        mode=mode,
        mood=mood,
        readiness=readiness,
        inspiration_needed=inspiration_needed,
    )
    db.session.add(session)
    db.session.commit()
    return session.id
```

### 3. Upload Endpoint Check

```python
@recordings_bp.route('/upload', methods=['POST'])
def upload_recording():
    # ... get session_id from form data ...
    
    # Get session
    session = db.session.query(RecordingSession).filter_by(
        id=session_id,
        user_id=current_user_id
    ).first()
    
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    # ✅ Check if pre-questions are completed
    if not session.pre_questions_completed:
        return jsonify({
            'error': 'Pre-questions must be completed first'
        }), 400
    
    # ... continue with upload ...
```

### 4. Session Status Endpoint

```python
@session_bp.route('/status', methods=['GET'])
def get_session_status():
    # ... get session ...
    
    return jsonify({
        'has_active_session': True,
        'session_id': session.id,
        'pre_questions_completed': session.pre_questions_completed,  # ✅ Use actual database value
        'recording_completed': session.recording_id is not None,
        'post_questions_completed': session.post_questions_completed,
        'recording_id': session.recording_id,
        'created_at': session.created_at.isoformat() if session.created_at else None,
        'completed_at': session.completed_at.isoformat() if session.completed_at else None,
        'abandoned_at': session.abandoned_at.isoformat() if session.abandoned_at else None,
    })
```

---

## Key Points

1. **✅✅✅ CRITICAL: Questionnaire = Pre-questions completed**
   - If `questionnaire` is in request body → `pre_questions_completed = TRUE`
   - If `questionnaire` is NOT in request body → `pre_questions_completed = FALSE`
   - **Without this, upload will fail with "Pre-questions must be completed first"**

2. **Status**: Set to `'recording_ready'` if questionnaire provided, else `'pre_questions_pending'`

3. **Generate 1 prompt**: Not 3 questions - just 1 AI-generated prompt based on selected command

4. **Store questionnaire data**: Save mood, readiness, inspiration_needed, cursor, mode for analytics

5. **Cursor calculation**:
   ```python
   mood_multiplier = 1.0 if mood == "positive" else 0.7
   readiness_score = (readiness - 1) / 9.0
   cursor = readiness_score * mood_multiplier  # Range: 0.0 - 1.0
   ```

6. **Mode determination**:
   ```python
   mode = "guided" if inspiration_needed else "open"
   ```

---

## Testing Checklist

After implementing:

- [ ] **Submit questionnaire** → Check database:
  ```sql
  SELECT pre_questions_completed, status, mood, readiness, cursor, mode
  FROM recording_sessions
  ORDER BY created_at DESC
  LIMIT 1;
  ```
  Should show: `pre_questions_completed = TRUE`, `status = 'recording_ready'`

- [ ] **Try to upload recording** → Should work (no "Pre-questions must be completed first" error)

- [ ] **Check `/session/status`** → Should return `pre_questions_completed: true`

- [ ] **Test without questionnaire** → Should work with old flow (`pre_questions_completed = FALSE`)

## Quick Verification Query

Run this in Supabase SQL Editor after submitting a questionnaire:

```sql
SELECT 
  id,
  pre_questions_completed,  -- Should be TRUE
  status,                     -- Should be 'recording_ready'
  mood,                       -- Should be 'positive' or 'negative'
  readiness,                  -- Should be 1-10
  inspiration_needed,         -- Should be TRUE or FALSE
  cursor,                     -- Should be 0.0-1.0
  mode                        -- Should be 'guided' or 'open'
FROM recording_sessions
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;
```

If `pre_questions_completed = FALSE` after submitting questionnaire, the backend fix is not applied correctly.
