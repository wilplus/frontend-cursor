# Backend: Use Admin Feedback in AI Analysis

## 🎯 Goal

Ensure that when OpenAI generates analysis reports, it uses admin feedback from the database to create **progress-aware** and **time-aware** reports that improve over time.

---

## 📊 Database Tables

Admin feedback is stored in:

1. **`professional_notes`** - General observations about user
2. **`professional_notes_report_tech`** - Custom instructions and max words
3. **`professional_notes_specific_questions`** - Specific questions to ask user

---

## 🔧 Implementation: Use Admin Feedback in Analysis

### Step 1: Fetch Admin Feedback Before Analysis

When analyzing a recording, **always fetch admin feedback first**:

```python
def analyze_recording_with_admin_context(
    recording_id: str,
    user_id: str,
    transcription: str,
    recording_metrics: dict
):
    """
    Analyze recording using OpenAI, incorporating admin feedback and user history.
    Creates progress-aware and time-aware reports.
    """
    # ✅ STEP 1: Get admin feedback
    admin_notes = db.session.query(ProfessionalNotes).filter_by(
        user_id=user_id
    ).first()
    
    tech_notes = db.session.query(ProfessionalNotesReportTech).filter_by(
        user_id=user_id
    ).first()
    
    specific_questions = db.session.query(ProfessionalNotesSpecificQuestion).filter_by(
        user_id=user_id
    ).all()
    
    # ✅ STEP 2: Get user's recording history for progress tracking
    previous_recordings = db.session.query(Recording).filter(
        Recording.user_id == user_id,
        Recording.id != recording_id,  # Exclude current recording
        Recording.created_at < datetime.utcnow()  # Only past recordings
    ).order_by(Recording.created_at.desc()).limit(10).all()
    
    # Calculate progress metrics
    previous_scores = []
    previous_filler_counts = []
    previous_wpm = []
    
    for prev_rec in previous_recordings:
        if prev_rec.performance_score:
            previous_scores.append(prev_rec.performance_score.final_kpi)
        if prev_rec.filler_words_count:
            if isinstance(prev_rec.filler_words_count, dict):
                total_fillers = sum(prev_rec.filler_words_count.values())
            else:
                total_fillers = prev_rec.filler_words_count
            previous_filler_counts.append(total_fillers)
        if prev_rec.words_per_minute:
            previous_wpm.append(prev_rec.words_per_minute)
    
    # Calculate trends
    trend_improving = False
    trend_stable = False
    trend_declining = False
    
    if len(previous_scores) >= 2:
        recent_avg = sum(previous_scores[:3]) / min(3, len(previous_scores))
        older_avg = sum(previous_scores[3:6]) / min(3, len(previous_scores[3:]))
        if recent_avg > older_avg + 0.05:
            trend_improving = True
        elif abs(recent_avg - older_avg) < 0.05:
            trend_stable = True
        else:
            trend_declining = True
    
    # ✅ STEP 3: Build comprehensive prompt with admin context and history
    prompt = f"""Analyze this speech recording and provide personalized coaching feedback.

**Current Recording:**
Transcription: {transcription}

Metrics:
- Words Per Minute: {recording_metrics.get('wpm', 'N/A')}
- Filler Words: {recording_metrics.get('filler_count', 'N/A')}
- Duration: {recording_metrics.get('duration_seconds', 'N/A')} seconds

"""
    
    # Add admin's general observations
    if admin_notes and admin_notes.notes:
        prompt += f"""
**Admin Observations (Important Context):**
{admin_notes.notes}

These observations should guide your analysis. Pay special attention to these patterns.

"""
    
    # Add custom instructions from admin
    if tech_notes and tech_notes.custom_instructions:
        prompt += f"""
**Custom Analysis Instructions (Follow These):**
{tech_notes.custom_instructions}

These are specific instructions for how to analyze this user's recordings. Follow them closely.

"""
    
    # Add progress context
    if previous_recordings:
        prompt += f"""
**User Progress Context:**
- Total previous recordings analyzed: {len(previous_recordings)}
- Recent performance trend: {"Improving" if trend_improving else "Stable" if trend_stable else "Needs attention"}
"""
        
        if previous_scores:
            avg_score = sum(previous_scores) / len(previous_scores)
            prompt += f"""
- Average performance score: {avg_score:.2%}
- Current performance: Compare to this baseline
"""
        
        if previous_filler_counts:
            avg_fillers = sum(previous_filler_counts) / len(previous_filler_counts)
            current_fillers = recording_metrics.get('filler_count', 0)
            if current_fillers < avg_fillers:
                prompt += f"""
- Filler word improvement: User reduced fillers from average of {avg_fillers:.1f} to {current_fillers}
"""
        
        if previous_wpm:
            avg_wpm = sum(previous_wpm) / len(previous_wpm)
            current_wpm = recording_metrics.get('wpm', 0)
            prompt += f"""
- Pacing: Average WPM was {avg_wpm:.0f}, current is {current_wpm:.0f}
"""
    
    # Add specific questions if admin provided them
    if specific_questions:
        post_questions = [q for q in specific_questions if q.question_type == 'post']
        if post_questions:
            prompt += f"""
**Admin-Suggested Focus Areas:**
"""
            for q in post_questions:
                prompt += f"- {q.question_text}\n"
    
    # Add max words constraint
    max_words = tech_notes.max_words if tech_notes and tech_notes.max_words else 120
    prompt += f"""

**Requirements:**
1. Create a progress-aware report that acknowledges improvements or areas needing work
2. Reference specific changes from previous recordings when relevant
3. Follow the admin's custom instructions closely
4. Be encouraging but specific
5. Maximum length: {max_words} words
6. Focus on actionable recommendations

Provide:
1. Overall assessment (progress-aware)
2. Key strengths (what's improving)
3. Areas for improvement (what needs work)
4. Specific actionable recommendations (time-aware, building on previous feedback)
"""
    
    # ✅ STEP 4: Call OpenAI with enhanced prompt
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": "You are an expert speech coach providing personalized, progress-aware feedback. You analyze recordings over time and help users improve based on their history and admin guidance."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.7,
        max_tokens=max_words * 2  # Rough token estimate
    )
    
    analysis = response.choices[0].message.content.strip()
    
    # ✅ STEP 5: Save analysis to database
    recording = db.session.query(Recording).filter_by(id=recording_id).first()
    if recording:
        recording.coaching_report = analysis
        recording.analysis_report = analysis  # Legacy field
        db.session.commit()
    
    return analysis
```

---

## 🔄 Complete Flow

### 1. Admin Provides Feedback

```python
# Admin submits feedback via POST /admin/feedback
{
    "user_id": "uuid",
    "general_notes": "User speaks too fast when nervous...",
    "custom_instructions": "Focus on pacing and breathing...",
    "max_words": 150
}
```

**Stored in:**
- `professional_notes.notes` → General observations
- `professional_notes_report_tech.custom_instructions` → Custom instructions
- `professional_notes_report_tech.max_words` → Max words

### 2. User Records New Session

```python
# User uploads recording
POST /recordings/upload
```

### 3. Backend Analyzes with Admin Context

```python
# In /recordings/upload endpoint
transcription = transcribe_audio(audio_file)
metrics = calculate_metrics(transcription)

# ✅ Use admin feedback in analysis
analysis = analyze_recording_with_admin_context(
    recording_id=recording.id,
    user_id=user_id,
    transcription=transcription,
    recording_metrics=metrics
)
```

### 4. AI Generates Progress-Aware Report

The prompt includes:
- ✅ Admin's general observations
- ✅ Custom instructions
- ✅ User's recording history
- ✅ Progress trends (improving/stable/declining)
- ✅ Comparison to previous metrics

**Result:** AI generates report that:
- References previous recordings
- Acknowledges improvements
- Follows admin's guidance
- Provides time-aware recommendations

---

## 📊 Progress Tracking

### Calculate Trends

```python
def calculate_user_progress(user_id: str):
    """
    Calculate user's progress over time.
    """
    recordings = db.session.query(Recording).filter(
        Recording.user_id == user_id
    ).order_by(Recording.created_at.asc()).all()
    
    progress_data = {
        "total_recordings": len(recordings),
        "scores": [],
        "filler_counts": [],
        "wpm_values": [],
        "dates": []
    }
    
    for rec in recordings:
        if rec.performance_score:
            progress_data["scores"].append(rec.performance_score.final_kpi)
        if rec.filler_words_count:
            if isinstance(rec.filler_words_count, dict):
                progress_data["filler_counts"].append(sum(rec.filler_words_count.values()))
            else:
                progress_data["filler_counts"].append(rec.filler_words_count)
        if rec.words_per_minute:
            progress_data["wpm_values"].append(rec.words_per_minute)
        progress_data["dates"].append(rec.created_at.isoformat())
    
    return progress_data
```

---

## ✅ Checklist

- [ ] Fetch `professional_notes` before analysis
- [ ] Fetch `professional_notes_report_tech` before analysis
- [ ] Fetch user's recording history (last 10 recordings)
- [ ] Calculate progress trends (improving/stable/declining)
- [ ] Include admin observations in prompt
- [ ] Include custom instructions in prompt
- [ ] Include progress context in prompt
- [ ] Reference previous recordings in analysis
- [ ] Save analysis to database
- [ ] Test with admin feedback present
- [ ] Test with no admin feedback (should still work)
- [ ] Verify reports improve over time

---

## 🎯 Expected Result

**Without Admin Feedback:**
- Generic analysis based on current recording only

**With Admin Feedback:**
- Analysis follows admin's custom instructions
- References user's progress over time
- Acknowledges improvements
- Provides time-aware recommendations
- Builds on previous feedback

**Example Progress-Aware Report:**

```
"Great progress! You've reduced your filler words from an average of 15 
to 8 in this recording - that's a 47% improvement. Your pacing has also 
stabilized at 145 WPM, which is much better than your previous average 
of 165 WPM. 

Based on your admin's guidance to focus on breathing techniques, I notice 
you're pausing more naturally now. Continue practicing the breathing 
exercises before speaking, especially when you feel nervous.

Next steps: Work on varying your pace for emphasis - slow down during 
key points to let your message land."
```

---

## 📝 Summary

**Key Points:**
1. ✅ Always fetch admin feedback before analysis
2. ✅ Include admin observations and instructions in prompt
3. ✅ Fetch user's recording history for progress tracking
4. ✅ Calculate trends (improving/stable/declining)
5. ✅ Reference previous recordings in analysis
6. ✅ Create time-aware and progress-aware reports

The AI will now create reports that:
- Follow admin's guidance
- Acknowledge user progress
- Reference previous recordings
- Provide time-aware recommendations
- Improve over time as more data is collected

🚀
