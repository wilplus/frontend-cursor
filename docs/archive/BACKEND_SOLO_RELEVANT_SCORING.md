# Backend Implementation: Solo-Relevant Scoring System

## Overview

This document provides the complete backend implementation for the solo-relevant scoring system. All questions focus on the speaker's internal experience (body, voice, attention, control, effort) - no imaginary listeners.

---

## Pre-Recording Questions (Updated)

### Frontend Sends:
```json
{
  "questionnaire": {
    "mood": "positive" | "negative",  // 🙂 or 🙁
    "readiness": 1-10,                 // Body and mind readiness
    "inspiration_needed": boolean      // Maps to structure: true="guided", false="open"
  }
}
```

### Backend Maps:
```python
structure = "guided" if inspiration_needed else "open"
mood = questionnaire.get("mood", "positive")
readiness = questionnaire.get("readiness", 5)
```

---

## Post-Recording Questions (Solo-Focused)

### Question Pool: 20 Sets

All questions are solo-relevant:
- **Awareness & Attention**: Voice awareness, attention drift, body presence
- **Control & Pacing**: Pace control, rushing, intentional pauses, silence comfort
- **Effort & Discipline**: Effort applied, wanting to stop, voice stability, body tension
- **Self-Regulation**: Nervousness management, mistake recovery, calm state, state improvement
- **Ownership**: Voice honesty, autopilot, intentionality, repeat differently

### Response Format:
```json
{
  "answers": [
    {
      "question_id": "uuid",
      "answer_text": "3"  // Q1: Scale 1-5
    },
    {
      "question_id": "uuid",
      "answer_text": "YES"  // Q2: YES/NO
    },
    {
      "question_id": "uuid",
      "answer_text": "I noticed I was rushing..."  // Q3: Free text
    }
  ]
}
```

---

## Scoring Inputs

### From Pre-Questions:
```python
mood = "positive" | "negative"  # From questionnaire
readiness = 1-10                # From questionnaire
structure = "guided" | "open"   # From questionnaire (inspiration_needed)
```

### From Recording Analysis:
```python
filler_count = int              # Count of filler words
pacing_score = 0.0-1.0          # Normalized pacing score (from WPM analysis)
voice_stability = 0.0-1.0       # NEW: Voice consistency/stability metric
energy_score = 0.0-1.0         # NEW: Energy/vitality in voice
```

### From Post-Questions:
```python
self_awareness_score = 1-5      # Q1 answer (scale)
noticed_fillers = 1 | 0        # Q2 answer (YES=1, NO=0)
reflection_text = str           # Q3 answer (free text)
```

### From History:
```python
previous_kpi = 0.0-1.0 | None   # Last session's final_kpi
```

---

## Normalization Functions

```python
def normalize_readiness(readiness: int) -> float:
    """Convert readiness (1-10) to 0.0-1.0"""
    return (readiness - 1) / 9.0

def get_mood_multiplier(mood: str) -> float:
    """Get mood multiplier for final KPI"""
    return 1.0 if mood == "positive" else 0.75

def normalize_awareness(awareness_score: int) -> float:
    """Convert awareness (1-5) to 0.0-1.0"""
    return (awareness_score - 1) / 4.0

def calculate_filler_score(filler_count: int, threshold: int = 10) -> float:
    """Calculate filler score (lower is better)"""
    return max(0.0, 1.0 - (filler_count / threshold))
```

---

## Core Performance Score Calculation

```python
def calculate_performance_score(
    filler_score: float,
    pacing_score: float,
    voice_stability: float,
    energy_score: float,
    awareness_score: float,
) -> float:
    """
    Core performance score (weighted average)
    
    Weights:
    - 30% filler_score (speech clarity)
    - 25% pacing_score (rhythm control)
    - 20% voice_stability (consistency)
    - 15% energy_score (vitality)
    - 10% awareness_score (self-observation)
    """
    performance = (
        0.30 * filler_score +
        0.25 * pacing_score +
        0.20 * voice_stability +
        0.15 * energy_score +
        0.10 * awareness_score
    )
    
    return max(0.0, min(1.0, performance))
```

---

## Bonus Calculations

```python
def calculate_bonuses(
    performance: float,
    mood: str,
    filler_count: int,
    noticed_fillers: int,
    previous_kpi: float | None,
) -> dict:
    """
    Calculate performance bonuses
    
    Bonuses:
    - Resilience: Negative mood + zero fillers = 0.05
    - Awareness: Noticed fillers = 0.03
    - Progress: Improved from last time = 0.0-0.05
    """
    bonuses = {}
    
    # Resilience bonus: Negative mood + zero fillers
    if mood == "negative" and filler_count == 0:
        bonuses['resilience'] = 0.05
    
    # Awareness bonus: User noticed fillers themselves
    if noticed_fillers == 1:
        bonuses['awareness'] = 0.03
    
    # Progress bonus: Improved from last time
    if previous_kpi is not None and performance > previous_kpi:
        progress_diff = performance - previous_kpi
        bonuses['progress'] = min(0.05, progress_diff)
    
    return bonuses
```

---

## Final KPI Calculation

```python
def calculate_final_kpi(
    performance: float,
    mood_multiplier: float,
    bonuses: dict,
) -> float:
    """
    Final KPI = (performance * mood_multiplier) + bonuses
    
    Mood multiplier:
    - Positive mood: 1.0 (no reduction)
    - Negative mood: 0.75 (25% reduction, but bonuses can compensate)
    
    This rewards resilience: negative mood users can still achieve high KPI
    through bonuses (zero fillers, awareness, progress).
    """
    total_bonus = sum(bonuses.values())
    final_kpi = min(1.0, (performance * mood_multiplier) + total_bonus)
    
    return final_kpi
```

---

## Complete Implementation

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
    
    # 5. Extract post-question answers
    q1_answer = None  # Scale 1-5
    q2_answer = None  # YES/NO
    q3_answer = None  # Free text
    
    for ans in answers:
        question = db.session.query(PostQuestion).filter_by(id=ans['question_id']).first()
        if question:
            if question.order_index == 0:
                q1_answer = ans['answer_text']  # Scale
            elif question.order_index == 1:
                q2_answer = ans['answer_text']  # Binary
            elif question.order_index == 2:
                q3_answer = ans['answer_text']  # Free text
    
    # 6. Get recording metrics
    filler_count = recording.filler_count or 0
    pacing_score = recording.pacing_score or calculate_pacing_score(recording.words_per_minute)
    voice_stability = recording.voice_stability or calculate_voice_stability(recording)
    energy_score = recording.energy_score or calculate_energy_score(recording)
    
    # 7. Get pre-recording data
    mood = session.mood or "positive"
    readiness = session.readiness or 5
    structure = session.structure or (session.inspiration_needed and "guided" or "open")
    
    # 8. Normalize scores
    readiness_score = normalize_readiness(readiness)
    mood_multiplier = get_mood_multiplier(mood)
    awareness_score = normalize_awareness(int(q1_answer)) if q1_answer and q1_answer.isdigit() else 0.5
    filler_score = calculate_filler_score(filler_count)
    noticed_fillers = 1 if q2_answer == "YES" else 0
    
    # 9. Get previous performance
    previous_recording = get_user_last_recording(user_id, exclude_id=recording_id)
    previous_kpi = previous_recording.performance_score.final_kpi if previous_recording and previous_recording.performance_score else None
    
    # 10. Calculate performance score
    performance = calculate_performance_score(
        filler_score=filler_score,
        pacing_score=pacing_score,
        voice_stability=voice_stability,
        energy_score=energy_score,
        awareness_score=awareness_score,
    )
    
    # 11. Calculate bonuses
    bonuses = calculate_bonuses(
        performance=performance,
        mood=mood,
        filler_count=filler_count,
        noticed_fillers=noticed_fillers,
        previous_kpi=previous_kpi,
    )
    
    # 12. Calculate final KPI
    final_kpi = calculate_final_kpi(
        performance=performance,
        mood_multiplier=mood_multiplier,
        bonuses=bonuses,
    )
    
    # 13. Store performance score
    performance_record = PerformanceScore(
        recording_id=recording_id,
        performance=performance,
        final_kpi=final_kpi,
        resilience_bonus=bonuses.get('resilience', 0),
        awareness_bonus=bonuses.get('awareness', 0),
        progress_bonus=bonuses.get('progress', 0),
        filler_score=filler_score,
        pacing_score=pacing_score,
        voice_stability_score=voice_stability,
        energy_score=energy_score,
        awareness_score=awareness_score,
        mood_multiplier=mood_multiplier,
        readiness_score=readiness_score,
    )
    db.session.add(performance_record)
    
    # 14. Store reflection text (Q3 answer)
    if q3_answer:
        # Update the Q3 answer record with reflection_text
        q3_question = None
        for ans in answers:
            question = db.session.query(PostQuestion).filter_by(id=ans['question_id']).first()
            if question and question.order_index == 2:
                q3_question = question
                break
        
        if q3_question:
            answer_record = db.session.query(PostAnswer).filter_by(
                recording_id=recording_id,
                question_id=q3_question.id
            ).first()
            if answer_record:
                answer_record.reflection_text = q3_answer
    
    # 15. Mark post-questions as completed
    session.post_questions_completed = True
    session.status = 'completed'
    
    db.session.commit()
    
    # 16. Return response
    return jsonify({
        'recording_id': recording_id,
        'session_id': session_id,
        'post_questions_completed': True,
        'performance_score': {
            'performance': performance,
            'final_kpi': final_kpi,
            'bonuses': bonuses,
            'mood_multiplier': mood_multiplier,
            'raw_scores': {
                'filler_score': filler_score,
                'pacing_score': pacing_score,
                'voice_stability': voice_stability,
                'energy_score': energy_score,
                'awareness_score': awareness_score,
            }
        }
    })
```

---

## New Metrics: How to Calculate

### Voice Stability (0.0-1.0)
```python
def calculate_voice_stability(recording: Recording) -> float:
    """
    Calculate voice stability from audio analysis.
    
    Factors:
    - Pitch consistency (variance in Hz)
    - Volume consistency (variance in dB)
    - Tempo consistency (variance in WPM over time)
    
    Returns: 0.0 (unstable) to 1.0 (very stable)
    """
    # Example calculation (adjust based on your audio analysis):
    pitch_variance = get_pitch_variance(recording.audio_url)
    volume_variance = get_volume_variance(recording.audio_url)
    tempo_variance = get_tempo_variance(recording.audio_url)
    
    # Normalize each component (lower variance = higher score)
    pitch_score = max(0.0, 1.0 - (pitch_variance / pitch_threshold))
    volume_score = max(0.0, 1.0 - (volume_variance / volume_threshold))
    tempo_score = max(0.0, 1.0 - (tempo_variance / tempo_threshold))
    
    # Weighted average
    stability = (
        0.40 * pitch_score +
        0.35 * volume_score +
        0.25 * tempo_score
    )
    
    return max(0.0, min(1.0, stability))
```

### Energy Score (0.0-1.0)
```python
def calculate_energy_score(recording: Recording) -> float:
    """
    Calculate energy/vitality score from audio analysis.
    
    Factors:
    - Average volume (higher = more energy)
    - Dynamic range (variation in volume)
    - Speech rate (faster can indicate energy, but not always)
    - Voice quality (clear, strong voice = more energy)
    
    Returns: 0.0 (low energy) to 1.0 (high energy)
    """
    # Example calculation (adjust based on your audio analysis):
    avg_volume = get_average_volume(recording.audio_url)
    dynamic_range = get_dynamic_range(recording.audio_url)
    voice_quality = get_voice_quality_score(recording.audio_url)
    
    # Normalize each component
    volume_score = min(1.0, avg_volume / volume_max)
    range_score = min(1.0, dynamic_range / range_max)
    quality_score = voice_quality  # Already 0.0-1.0
    
    # Weighted average
    energy = (
        0.35 * volume_score +
        0.30 * range_score +
        0.35 * quality_score
    )
    
    return max(0.0, min(1.0, energy))
```

### Pacing Score (0.0-1.0)
```python
def calculate_pacing_score(wpm: float) -> float:
    """
    Calculate pacing score from words per minute.
    
    Ideal range: 140-180 WPM
    Too slow (< 120): Lower score
    Too fast (> 200): Lower score
    Ideal (140-180): Higher score
    """
    if wpm < 120:
        # Too slow - linear decrease
        return max(0.0, wpm / 120)
    elif wpm <= 180:
        # Ideal range - full score
        return 1.0
    elif wpm <= 200:
        # Slightly fast - linear decrease
        return max(0.0, 1.0 - ((wpm - 180) / 20))
    else:
        # Too fast - lower score
        return max(0.0, 0.5 - ((wpm - 200) / 100))
```

---

## Database Schema Updates

Run `supabase-solo-relevant-schema.sql` to add:
- `recording_sessions.structure` (guided/open)
- `recordings.voice_stability` (0.0-1.0)
- `recordings.energy_score` (0.0-1.0)
- `recordings.pacing_score` (0.0-1.0)
- `performance_scores.voice_stability_score`
- `performance_scores.energy_score`
- `performance_scores.awareness_score`
- `performance_scores.mood_multiplier`
- `performance_scores.readiness_score`
- `post_recording_answers.reflection_text`

---

## Key Changes from Previous System

1. **Pre-questions updated**: "Do you want structure?" instead of "What will you record about?"
2. **Post-questions solo-focused**: All 20 sets focus on internal experience
3. **New metrics**: `voice_stability` and `energy_score` replace `attitude_score`
4. **Mood multiplier**: Applied to performance before bonuses (rewards resilience)
5. **Awareness score**: From post-questions Q1 (10% weight)
6. **Scoring weights**: 30% filler, 25% pacing, 20% stability, 15% energy, 10% awareness

---

## Testing Checklist

- [ ] Pre-questions return correct structure value
- [ ] Post-questions use solo-relevant pool
- [ ] Voice stability calculated correctly
- [ ] Energy score calculated correctly
- [ ] Performance score uses new weights
- [ ] Mood multiplier applied correctly
- [ ] Bonuses calculated correctly
- [ ] Final KPI capped at 1.0
- [ ] All scores stored in database
- [ ] Reflection text stored for Q3
