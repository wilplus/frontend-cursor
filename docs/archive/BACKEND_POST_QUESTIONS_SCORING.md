# Backend Implementation: Post-Recording Questions & Performance Scoring

## Overview

After a recording is uploaded and post-questions are submitted, the backend calculates a **performance score** and **final KPI** based on:
- Recording analysis (filler count, pacing, attitude)
- Post-question answers (reflection, awareness)
- Pre-recording questionnaire (mood, readiness)
- User history (previous scores)

---

## API Contract

### Request: `POST /questions/post-recording/answers`

**Body:**
```json
{
  "recording_id": "uuid",
  "session_id": "uuid",
  "answers": [
    {
      "question_id": "uuid",
      "answer_text": "3"  // For scale: "1"-"5"
    },
    {
      "question_id": "uuid",
      "answer_text": "YES"  // For binary: "YES" or "NO"
    },
    {
      "question_id": "uuid",
      "answer_text": "I felt most present when..."  // For free_text: user's text
    }
  ]
}
```

### Response: `POST /questions/post-recording/answers`

**Body:**
```json
{
  "recording_id": "uuid",
  "session_id": "uuid",
  "post_questions_completed": true,
  "performance_score": {
    "performance": 0.72,  // Core score (0.0-1.0)
    "final_kpi": 0.80,    // Performance + bonuses, capped at 1.0
    "bonuses": {
      "resilience": 0.05,
      "awareness": 0.03,
      "progress": 0.02
    },
    "raw_scores": {
      "filler_score": 0.85,
      "pacing_score": 0.70,
      "attitude_score": 0.75,
      "reflection_score": 0.60
    }
  }
}
```

---

## Step 1: Select Question Set

The backend should select one of 20 question sets based on:
- User's previous question sets (avoid recent repetition)
- Session context (cursor, mode)
- Random rotation

```python
def select_post_question_set(user_id: str, previous_set_ids: list[int]) -> dict:
    """
    Select a question set for post-recording questions.
    
    Strategy:
    - Avoid sets used in last 5 sessions
    - Prefer sets that match session context (cursor/mode)
    - Fall back to random if all sets recently used
    """
    # Get user's recent question sets
    recent_sets = get_recent_question_sets(user_id, limit=5)
    used_ids = set(recent_sets)
    
    # Filter available sets
    available = [s for s in POST_QUESTIONS_POOL if s['id'] not in used_ids]
    
    if not available:
        # All sets used recently, reset
        available = POST_QUESTIONS_POOL
    
    # Select random from available (or use context-based selection)
    selected = random.choice(available)
    
    return selected
```

---

## Step 2: Generate Questions from Set

```python
def generate_post_questions_from_set(question_set: dict, session_id: str) -> list:
    """
    Convert question set to PostRecordingQuestion objects
    """
    questions = []
    
    # Q1: Scale (1-5)
    q1_id = create_question(
        session_id=session_id,
        question_text=question_set['q1']['text'],
        question_type='scale',
        question_set_id=question_set['id'],
        order_index=0
    )
    questions.append({
        'id': q1_id,
        'question_text': question_set['q1']['text'],
        'question_type': 'scale',
        'question_set_id': question_set['id'],
        'order_index': 0
    })
    
    # Q2: Binary (YES/NO)
    q2_id = create_question(
        session_id=session_id,
        question_text=question_set['q2']['text'],
        question_type='binary',
        question_set_id=question_set['id'],
        order_index=1
    )
    questions.append({
        'id': q2_id,
        'question_text': question_set['q2']['text'],
        'question_type': 'binary',
        'question_set_id': question_set['id'],
        'order_index': 1
    })
    
    # Q3: Free text
    q3_id = create_question(
        session_id=session_id,
        question_text=question_set['q3']['text'],
        question_type='free_text',
        question_set_id=question_set['id'],
        order_index=2
    )
    questions.append({
        'id': q3_id,
        'question_text': question_set['q3']['text'],
        'question_type': 'free_text',
        'question_set_id': question_set['id'],
        'order_index': 2
    })
    
    return questions
```

---

## Step 3: Calculate Performance Score

### Inputs

```python
# From recording analysis
filler_word_count: int
pacing_score: float  # 0.0-1.0 (already normalized)
attitude_score: float  # 0.0-1.0 (already normalized)

# From post-questions
q1_answer: str  # "1"-"5" for scale
q2_answer: str  # "YES" or "NO" for binary
q3_answer: str  # Free text (optional)

# From pre-recording questionnaire
initial_mood: str  # "positive" or "negative"
initial_readiness: int  # 1-10

# From user history
previous_performance: float  # 0.0-1.0 (last session's performance score)
```

### Normalization

```python
def normalize_scores(
    filler_word_count: int,
    pacing_score: float,
    attitude_score: float,
    q1_answer: str,
    q2_answer: str,
) -> dict:
    """
    Normalize all scores to 0.0-1.0 range
    """
    # Filler score: lower is better
    FILLER_THRESHOLD = 10  # Adjust based on your data
    filler_score = max(0.0, 1.0 - (filler_word_count / FILLER_THRESHOLD))
    
    # Pacing and attitude already normalized (0.0-1.0)
    
    # Reflection score: from scale answer (1-5) → (0.0-1.0)
    scale_value = int(q1_answer) if q1_answer.isdigit() else 3
    reflection_score = (scale_value - 1) / 4.0  # (1→0.0, 5→1.0)
    
    # Awareness bonus: YES = 1.0, NO = 0.0
    awareness_bonus = 1.0 if q2_answer == "YES" else 0.0
    
    return {
        'filler_score': filler_score,
        'pacing_score': pacing_score,
        'attitude_score': attitude_score,
        'reflection_score': reflection_score,
        'awareness_bonus': awareness_bonus,
    }
```

### Core Performance Score

```python
def calculate_performance_score(normalized: dict) -> float:
    """
    Core performance score (weighted average)
    """
    performance = (
        0.30 * normalized['filler_score'] +
        0.25 * normalized['pacing_score'] +
        0.25 * normalized['attitude_score'] +
        0.20 * normalized['reflection_score']
    )
    
    return max(0.0, min(1.0, performance))
```

### Bonus Calculations

```python
def calculate_bonuses(
    performance: float,
    initial_mood: str,
    filler_word_count: int,
    awareness_bonus: float,
    previous_performance: float | None,
    user_streak: int = 0,  # Optional: consecutive sessions
) -> dict:
    """
    Calculate performance bonuses
    """
    bonuses = {}
    
    # Resilience bonus: Negative mood + zero fillers
    if initial_mood == "negative" and filler_word_count == 0:
        bonuses['resilience'] = 0.05
    
    # Awareness bonus: User noticed fillers
    if awareness_bonus == 1.0:
        bonuses['awareness'] = 0.03
    
    # Progress bonus: Improved from last time
    if previous_performance is not None and performance > previous_performance:
        progress_diff = performance - previous_performance
        bonuses['progress'] = min(0.05, progress_diff)
    
    # Optional: Streak bonus (3+ consecutive sessions)
    if user_streak >= 3:
        bonuses['streak'] = 0.05
    
    # Optional: Self-honesty bonus (low self-rating + good performance)
    # This would require comparing reflection_score to performance
    # If user rated themselves low but performance is high → bonus
    
    return bonuses
```

### Final KPI

```python
def calculate_final_kpi(performance: float, bonuses: dict) -> float:
    """
    Final KPI = performance + bonuses (capped at 1.0)
    """
    total_bonus = sum(bonuses.values())
    final_kpi = min(1.0, performance + total_bonus)
    
    return final_kpi
```

---

## Step 4: Complete Implementation

```python
@recordings_bp.route('/questions/post-recording/answers', methods=['POST'])
def submit_post_answers():
    # 1. Verify token
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        user_id = get_user_id_from_token(token)
    except Exception as e:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # 2. Parse request
    data = request.get_json()
    recording_id = data.get('recording_id')
    session_id = data.get('session_id')
    answers = data.get('answers', [])
    
    # 3. Get recording and session
    recording = db.session.query(Recording).filter_by(id=recording_id).first()
    session = db.session.query(RecordingSession).filter_by(id=session_id).first()
    
    if not recording or not session:
        return jsonify({'error': 'Recording or session not found'}), 404
    
    # 4. Store answers
    for answer_input in answers:
        create_answer(
            recording_id=recording_id,
            question_id=answer_input['question_id'],
            answer_text=answer_input['answer_text']
        )
    
    # 5. Calculate performance score
    # Extract answers
    q1_answer = None
    q2_answer = None
    for ans in answers:
        question = db.session.query(PostQuestion).filter_by(id=ans['question_id']).first()
        if question and question.order_index == 0:
            q1_answer = ans['answer_text']  # Scale answer
        elif question and question.order_index == 1:
            q2_answer = ans['answer_text']  # Binary answer
    
    # Get recording metrics
    filler_count = recording.filler_count or 0
    pacing_score = calculate_pacing_score(recording.words_per_minute)  # Your function
    attitude_score = calculate_attitude_score(recording)  # Your function
    
    # Get pre-recording data
    initial_mood = session.mood or "positive"
    initial_readiness = session.readiness or 5
    
    # Get previous performance
    previous_recording = get_user_last_recording(user_id, exclude_id=recording_id)
    previous_performance = previous_recording.performance_score.performance if previous_recording and previous_recording.performance_score else None
    
    # Normalize scores
    normalized = normalize_scores(
        filler_word_count=filler_count,
        pacing_score=pacing_score,
        attitude_score=attitude_score,
        q1_answer=q1_answer or "3",
        q2_answer=q2_answer or "NO",
    )
    
    # Calculate performance
    performance = calculate_performance_score(normalized)
    
    # Calculate bonuses
    bonuses = calculate_bonuses(
        performance=performance,
        initial_mood=initial_mood,
        filler_word_count=filler_count,
        awareness_bonus=normalized['awareness_bonus'],
        previous_performance=previous_performance,
        user_streak=get_user_streak(user_id),  # Optional
    )
    
    # Final KPI
    final_kpi = calculate_final_kpi(performance, bonuses)
    
    # 6. Store performance score
    performance_record = PerformanceScore(
        recording_id=recording_id,
        performance=performance,
        final_kpi=final_kpi,
        resilience_bonus=bonuses.get('resilience', 0),
        awareness_bonus=bonuses.get('awareness', 0),
        progress_bonus=bonuses.get('progress', 0),
        filler_score=normalized['filler_score'],
        pacing_score=normalized['pacing_score'],
        attitude_score=normalized['attitude_score'],
        reflection_score=normalized['reflection_score'],
    )
    db.session.add(performance_record)
    
    # 7. Mark post-questions as completed
    session.post_questions_completed = True
    session.status = 'completed'
    
    db.session.commit()
    
    # 8. Return response
    return jsonify({
        'recording_id': recording_id,
        'session_id': session_id,
        'post_questions_completed': True,
        'performance_score': {
            'performance': performance,
            'final_kpi': final_kpi,
            'bonuses': bonuses,
            'raw_scores': {
                'filler_score': normalized['filler_score'],
                'pacing_score': normalized['pacing_score'],
                'attitude_score': normalized['attitude_score'],
                'reflection_score': normalized['reflection_score'],
            }
        }
    })
```

---

## Step 5: Generate AI Feedback

After calculating the score, generate personalized feedback:

```python
def generate_performance_feedback(
    performance_score: dict,
    question_set_id: int,
    initial_mood: str,
    recording_metrics: dict,
) -> str:
    """
    Generate AI feedback based on performance score and context
    """
    prompt = f"""Generate reflective feedback for a user's recording session.

Context:
- Performance Score: {performance_score['final_kpi']:.2f}/1.0
- Reflection Angle: Set {question_set_id} ({POST_QUESTIONS_POOL[question_set_id-1]['name']})
- Initial Mood: {initial_mood}
- Filler Words: {recording_metrics['filler_count']}
- WPM: {recording_metrics['wpm']}
- Bonuses Earned: {', '.join(performance_score['bonuses'].keys()) if performance_score['bonuses'] else 'None'}

Requirements:
- Be supportive and specific
- Reference the reflection angle (Set {question_set_id})
- Explain why the score is what it is
- Highlight strengths and growth areas
- Match tone to user's initial mood
- Keep it concise (2-3 sentences)

Generate the feedback:"""

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a supportive speaking coach. Generate personalized, encouraging feedback."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=200
    )
    
    return response.choices[0].message.content.strip()
```

---

## Database Schema

Add performance score table:

```sql
CREATE TABLE IF NOT EXISTS performance_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID NOT NULL REFERENCES recordings(id),
  performance NUMERIC NOT NULL,  -- Core score (0.0-1.0)
  final_kpi NUMERIC NOT NULL,    -- Final KPI (0.0-1.0)
  resilience_bonus NUMERIC DEFAULT 0,
  awareness_bonus NUMERIC DEFAULT 0,
  progress_bonus NUMERIC DEFAULT 0,
  streak_bonus NUMERIC DEFAULT 0,
  self_honesty_bonus NUMERIC DEFAULT 0,
  filler_score NUMERIC NOT NULL,
  pacing_score NUMERIC NOT NULL,
  attitude_score NUMERIC NOT NULL,
  reflection_score NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Key Points

1. **Question Selection**: Rotate through 20 sets to avoid repetition
2. **Score Calculation**: Weighted average (30% filler, 25% pacing, 25% attitude, 20% reflection)
3. **Bonuses**: Resilience, awareness, progress (optional: streak, self-honesty)
4. **Final KPI**: Performance + bonuses, capped at 1.0
5. **AI Feedback**: Generate personalized feedback based on score and context

---

## Testing

After implementing:

1. Submit post-answers → Check `performance_score` in response
2. Verify bonuses are calculated correctly
3. Check database: `performance_scores` table has correct values
4. Verify feedback is generated and stored
