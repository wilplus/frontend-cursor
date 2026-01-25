# Post-Recording Questions Implementation Summary

## ✅ Frontend: COMPLETE

### 1. New Question Types ✅
- **Scale (1-5)**: Clickable buttons for Q1
- **Binary (YES/NO)**: Clickable buttons for Q2  
- **Free Text**: Optional text input for Q3

### 2. New Form Component ✅
- **`PostQuestionsFormV2.tsx`**: Handles clickable questions
- Replaces old form that required 10+ characters for all questions
- Q1 and Q2 are required, Q3 is optional

### 3. Question Pool ✅
- **`post-questions-pool.ts`**: 20 question sets defined
- Each set has 3 questions (scale, binary, free_text)
- Rotation logic included (selects least recently used)

### 4. Performance Score Display ✅
- **`CompletedCard.tsx`**: Shows KPI percentage
- Displays bonuses earned
- Shows raw scores breakdown

### 5. API Types Updated ✅
- `PostRecordingQuestion`: Now includes `question_type` and `question_set_id`
- `PerformanceScore`: New interface for scoring data
- `SubmitPostAnswersResponse`: Includes optional `performance_score`

---

## 🔧 Backend Required Changes

### 1. Question Set Selection

When returning post-questions after upload, select from the 20 sets:

```python
# In /recordings/upload endpoint
question_set = select_post_question_set(user_id, previous_set_ids)
post_questions = generate_post_questions_from_set(question_set, session_id)
```

### 2. Performance Score Calculation

After post-answers are submitted, calculate:

```python
# Normalize scores
filler_score = max(0.0, 1.0 - (filler_count / 10))
pacing_score = ... # Your calculation
attitude_score = ... # Your calculation
reflection_score = (int(q1_answer) - 1) / 4.0  # Scale 1-5 → 0.0-1.0

# Core performance
performance = (
    0.30 * filler_score +
    0.25 * pacing_score +
    0.25 * attitude_score +
    0.20 * reflection_score
)

# Bonuses
bonuses = {}
if initial_mood == "negative" and filler_count == 0:
    bonuses['resilience'] = 0.05
if q2_answer == "YES":
    bonuses['awareness'] = 0.03
if performance > previous_performance:
    bonuses['progress'] = min(0.05, performance - previous_performance)

# Final KPI
final_kpi = min(1.0, performance + sum(bonuses.values()))
```

### 3. Response Format

Return performance score in `/questions/post-recording/answers` response:

```json
{
  "recording_id": "uuid",
  "session_id": "uuid",
  "post_questions_completed": true,
  "performance_score": {
    "performance": 0.72,
    "final_kpi": 0.80,
    "bonuses": {...},
    "raw_scores": {...}
  }
}
```

---

## 📋 Complete Flow

1. **User uploads recording** → Backend returns post-questions (selected from pool)
2. **User answers 3 questions**:
   - Q1: Scale 1-5 (required)
   - Q2: YES/NO (required)
   - Q3: Free text (optional)
3. **Frontend submits answers** → Backend calculates performance score
4. **Backend returns score** → Frontend displays in CompletedCard
5. **User sees KPI** → Performance percentage + bonuses

---

## 📁 Files Created/Updated

### Frontend
- ✅ `src/lib/api/types.ts` - Updated with new question types and PerformanceScore
- ✅ `src/lib/api/post-questions-pool.ts` - 20 question sets
- ✅ `src/components/session/PostQuestionsFormV2.tsx` - New form component
- ✅ `src/components/dashboard/SessionCard.tsx` - Uses new form
- ✅ `src/components/session/CompletedCard.tsx` - Shows performance score
- ✅ `src/store/session-store.ts` - Updated validation for new question types

### Backend Documentation
- ✅ `BACKEND_POST_QUESTIONS_SCORING.md` - Complete backend implementation guide

---

## 🧪 Testing

After backend implementation:

1. Upload recording → Should receive 3 post-questions (scale, binary, free_text)
2. Answer Q1 (1-5) and Q2 (YES/NO) → Submit
3. Check response → Should include `performance_score`
4. View completed card → Should show KPI percentage
5. Check database → `performance_scores` table should have entry

---

## Key Points

1. **Question Selection**: Backend selects from 20 sets, rotates to avoid repetition
2. **Validation**: Q1 and Q2 required, Q3 optional
3. **Scoring**: Weighted average (30% filler, 25% pacing, 25% attitude, 20% reflection)
4. **Bonuses**: Resilience, awareness, progress (optional: streak, self-honesty)
5. **Display**: KPI shown as percentage in CompletedCard

See `BACKEND_POST_QUESTIONS_SCORING.md` for complete backend code examples.
