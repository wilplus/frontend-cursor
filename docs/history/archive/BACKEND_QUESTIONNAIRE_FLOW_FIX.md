# Backend Fix: Questionnaire Flow Integration

## Problem

When the questionnaire is submitted, the backend creates a session but doesn't mark `pre_questions_completed = TRUE`. This causes the upload to fail with "Pre-questions must be completed first".

## Solution

The backend needs to understand that **questionnaire submission = pre-questions completed**.

## Required Backend Changes

### 1. Update `/session/start` endpoint

When a questionnaire is provided, the backend should:

```python
@session_bp.route('/session/start', methods=['POST'])
def start_session():
    # ... existing code ...
    
    # 3. Calculate cursor and mode
    if questionnaire:
        mood = questionnaire.get('mood', 'positive')
        readiness = questionnaire.get('readiness', 5)
        inspiration_needed = questionnaire.get('inspiration_needed', False)
        
        cursor = calculate_cursor(mood, readiness)
        mode = determine_mode(inspiration_needed)
        
        # IMPORTANT: Questionnaire submission = pre-questions completed
        pre_questions_completed = True  # ✅ Set to True immediately
    else:
        cursor = 0.5
        mode = "open"
        pre_questions_completed = False  # Old flow - user still needs to answer
    
    # 4. Select commands and generate questions
    selected_commands = select_commands(cursor, mode, num_questions=1)  # Generate 1 prompt
    
    # 5. Generate the recording prompt
    generated_prompt = generate_question_from_command(selected_commands[0], cursor, mode)
    
    # 6. Create session with pre_questions_completed = True
    session_id = create_session(
        user_id=user_id,
        cursor=cursor,
        mode=mode,
        questionnaire_data=questionnaire,
        pre_questions_completed=pre_questions_completed  # ✅ Set to True
    )
    
    # 7. Create the generated prompt as a "pre-question" (for display)
    question_id = create_question(
        session_id=session_id,
        question_text=generated_prompt,
        order_index=0,
        command_id=selected_commands[0]['id'],
        cursor=cursor,
        mode=mode
    )
    
    # 8. Return response
    return jsonify({
        'session_id': session_id,
        'pre_questions': [
            {
                'id': question_id,
                'question_text': generated_prompt,
                'order_index': 0
            }
        ],
        'cursor': cursor,
        'mode': mode
    })
```

### 2. Update Session Creation Function

```python
def create_session(
    user_id: str,
    cursor: float = None,
    mode: str = None,
    questionnaire_data: dict = None,
    pre_questions_completed: bool = False  # ✅ Add this parameter
):
    session = RecordingSession(
        user_id=user_id,
        status='recording_ready',  # ✅ Start at recording_ready, not pre_questions_pending
        pre_questions_completed=pre_questions_completed,  # ✅ Set based on questionnaire
        cursor=cursor,
        mode=mode,
        mood=questionnaire_data.get('mood') if questionnaire_data else None,
        readiness=questionnaire_data.get('readiness') if questionnaire_data else None,
        inspiration_needed=questionnaire_data.get('inspiration_needed') if questionnaire_data else None,
    )
    db.session.add(session)
    db.session.commit()
    return session.id
```

### 3. Update Session Status Check

The `/session/status` endpoint should return:

```python
@session_bp.route('/session/status', methods=['GET'])
def get_session_status():
    # ... get session ...
    
    return jsonify({
        'has_active_session': True,
        'session_id': session.id,
        'pre_questions_completed': session.pre_questions_completed,  # ✅ Use actual value
        'recording_completed': session.recording_id is not None,
        'post_questions_completed': session.post_questions_completed,
        'recording_id': session.recording_id,
        # ...
    })
```

### 4. Update Upload Endpoint Check

The `/recordings/upload` endpoint should check:

```python
@recordings_bp.route('/upload', methods=['POST'])
def upload_recording():
    # ... get session ...
    
    # Check if pre-questions are completed
    if not session.pre_questions_completed:
        return jsonify({
            'error': 'Pre-questions must be completed first'
        }), 400
    
    # ... continue with upload ...
```

## Database Schema

Run the SQL script `supabase-fix-questionnaire-flow.sql` to ensure all columns exist.

## Key Points

1. **Questionnaire = Pre-questions**: When questionnaire is submitted, `pre_questions_completed = TRUE`
2. **Status starts at `recording_ready`**: Not `pre_questions_pending`
3. **Generate 1 prompt**: Not 3 questions - just 1 AI-generated prompt
4. **Store questionnaire data**: For analytics and debugging

## Testing

After implementing:

1. Submit questionnaire → Check `pre_questions_completed = TRUE` in database
2. Try to upload → Should work without "Pre-questions must be completed first" error
3. Check session status → Should show `pre_questions_completed: true`
