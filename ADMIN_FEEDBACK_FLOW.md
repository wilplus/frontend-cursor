# Admin Feedback Flow: Storing & Using Admin Comments

## Overview

This document explains how admin feedback/comments are stored and used to improve future OpenAI analysis for each user.

---

## 📊 Current Database Schema

You already have tables for storing admin feedback:

### 1. `professional_notes` Table
```sql
CREATE TABLE professional_notes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  notes TEXT,  -- Admin's general notes about the user
  updated_at TIMESTAMP
);
```

**Purpose:** Store general admin comments/observations about a user.

### 2. `professional_notes_report_tech` Table
```sql
CREATE TABLE professional_notes_report_tech (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  max_words INT DEFAULT 120,
  custom_instructions TEXT,  -- Specific instructions for AI analysis
  updated_at TIMESTAMP,
  UNIQUE(user_id)
);
```

**Purpose:** Store custom instructions that guide how OpenAI should analyze recordings for this specific user.

### 3. `professional_notes_specific_questions` Table
```sql
CREATE TABLE professional_notes_specific_questions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('pre', 'post')),
  created_at TIMESTAMP
);
```

**Purpose:** Store user-specific questions that should be asked during sessions.

---

## 🔄 Complete Admin Feedback Flow

### Step 1: Admin Receives Email

When a recording is uploaded and analyzed:

```python
# In Flask backend after analysis
def send_admin_notification(recording_id, user_id, analysis_data):
    # Send email to admin with:
    # - Recording transcription
    # - Analysis report
    # - Link to provide feedback
    email_body = f"""
    New recording from user {user_email}
    
    Transcription: {transcription_preview}
    Analysis: {analysis_report}
    
    [Provide Feedback] → https://your-admin-dashboard.com/recordings/{recording_id}/feedback
    """
    send_email(to=admin_email, subject="New Recording", body=email_body)
```

### Step 2: Admin Provides Feedback

Admin visits feedback page and submits:

```json
{
  "user_id": "uuid",
  "recording_id": "uuid",
  "general_notes": "User tends to rush when nervous. Focus on pacing.",
  "custom_instructions": "When analyzing this user's recordings, emphasize:
    - Pacing and rhythm
    - Breathing techniques
    - Slowing down during key points",
  "specific_questions": [
    {
      "question_text": "How did you feel about your pacing today?",
      "question_type": "post"
    }
  ]
}
```

### Step 3: Store Feedback in Database

```python
# Flask endpoint: POST /admin/feedback
@admin_bp.route('/feedback', methods=['POST'])
@require_admin_auth  # Only admins can access
def save_admin_feedback():
    data = request.get_json()
    user_id = data['user_id']
    
    # Update or create professional_notes
    notes = db.session.query(ProfessionalNotes).filter_by(
        user_id=user_id
    ).first()
    
    if notes:
        notes.notes = data.get('general_notes', notes.notes)
        notes.updated_at = datetime.utcnow()
    else:
        notes = ProfessionalNotes(
            user_id=user_id,
            notes=data.get('general_notes', ''),
            updated_at=datetime.utcnow()
        )
        db.session.add(notes)
    
    # Update or create custom_instructions
    tech_notes = db.session.query(ProfessionalNotesReportTech).filter_by(
        user_id=user_id
    ).first()
    
    if tech_notes:
        tech_notes.custom_instructions = data.get('custom_instructions', tech_notes.custom_instructions)
        tech_notes.updated_at = datetime.utcnow()
    else:
        tech_notes = ProfessionalNotesReportTech(
            user_id=user_id,
            custom_instructions=data.get('custom_instructions', ''),
            max_words=data.get('max_words', 120),
            updated_at=datetime.utcnow()
        )
        db.session.add(tech_notes)
    
    # Add specific questions if provided
    if 'specific_questions' in data:
        for q in data['specific_questions']:
            question = ProfessionalNotesSpecificQuestion(
                user_id=user_id,
                question_text=q['question_text'],
                question_type=q['question_type']
            )
            db.session.add(question)
    
    db.session.commit()
    return jsonify({'status': 'success'})
```

### Step 4: Use Feedback in Next Analysis

When OpenAI analyzes the next recording for this user:

```python
def analyze_recording_with_admin_context(recording_id, user_id, transcription):
    """
    Analyze recording using OpenAI, incorporating admin feedback.
    """
    # Get admin notes for this user
    notes = db.session.query(ProfessionalNotes).filter_by(
        user_id=user_id
    ).first()
    
    tech_notes = db.session.query(ProfessionalNotesReportTech).filter_by(
        user_id=user_id
    ).first()
    
    # Build analysis prompt with admin context
    base_prompt = f"""Analyze this speech recording and provide coaching feedback.

Transcription:
{transcription}

"""
    
    # Add admin's general notes if available
    if notes and notes.notes:
        base_prompt += f"""
Admin Observations:
{notes.notes}

"""
    
    # Add custom instructions if available
    if tech_notes and tech_notes.custom_instructions:
        base_prompt += f"""
Custom Analysis Instructions:
{tech_notes.custom_instructions}

"""
    
    # Add max words constraint if set
    if tech_notes and tech_notes.max_words:
        base_prompt += f"""
Maximum report length: {tech_notes.max_words} words.

"""
    
    base_prompt += """
Provide:
1. Overall assessment
2. Key strengths
3. Areas for improvement
4. Specific actionable recommendations
"""
    
    # Call OpenAI with enhanced prompt
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are an expert speech coach providing personalized feedback."},
            {"role": "user", "content": base_prompt}
        ],
        temperature=0.7,
        max_tokens=tech_notes.max_words * 2 if tech_notes else 500  # Rough token estimate
    )
    
    analysis = response.choices[0].message.content.strip()
    
    # Save analysis to database
    recording = db.session.query(Recording).filter_by(id=recording_id).first()
    recording.coaching_report = analysis
    recording.analysis_report = analysis  # Legacy field
    db.session.commit()
    
    return analysis
```

---

## 🎯 Implementation Checklist

### Backend Implementation

- [ ] **Create admin feedback endpoint** (`POST /admin/feedback`)
  - Accepts: `user_id`, `general_notes`, `custom_instructions`, `specific_questions`
  - Stores in `professional_notes` and `professional_notes_report_tech` tables
  - Requires admin authentication

- [ ] **Update analysis function** to fetch admin notes
  - Query `professional_notes` for user
  - Query `professional_notes_report_tech` for custom instructions
  - Include in OpenAI prompt

- [ ] **Update email notification** to include feedback link
  - Add link to admin dashboard feedback page
  - Include recording_id and user_id in link

- [ ] **Create admin dashboard** (optional, can be separate app)
  - List recordings needing feedback
  - Form to submit feedback
  - View user's feedback history

### Frontend Implementation (Optional Admin Dashboard)

- [ ] **Admin login page**
- [ ] **Recordings list** - shows recordings awaiting feedback
- [ ] **Feedback form** - allows admin to:
  - Add general notes
  - Add custom instructions
  - Add specific questions
- [ ] **User history** - shows all feedback given to a user

---

## 📝 Example: Complete Flow

### Recording 1 (No Admin Feedback Yet)

1. User uploads recording
2. Backend analyzes with default prompt (no admin context)
3. Email sent to admin: "New recording from user@example.com"
4. Admin reviews and provides feedback:
   - General notes: "User speaks too fast when nervous"
   - Custom instructions: "Focus on pacing and breathing"

### Recording 2 (With Admin Feedback)

1. User uploads recording
2. Backend fetches admin notes:
   ```python
   notes = get_professional_notes(user_id)
   # Returns: "User speaks too fast when nervous"
   
   tech_notes = get_professional_notes_report_tech(user_id)
   # Returns: "Focus on pacing and breathing"
   ```
3. Backend builds enhanced prompt:
   ```
   Analyze this speech recording...
   
   Admin Observations:
   User speaks too fast when nervous
   
   Custom Analysis Instructions:
   Focus on pacing and breathing
   ```
4. OpenAI generates analysis that specifically addresses pacing and breathing
5. Analysis is more personalized and relevant

---

## 🔧 Database Queries Needed

### Get Admin Notes for User

```python
def get_user_admin_context(user_id):
    """Get all admin feedback for a user."""
    notes = db.session.query(ProfessionalNotes).filter_by(
        user_id=user_id
    ).first()
    
    tech_notes = db.session.query(ProfessionalNotesReportTech).filter_by(
        user_id=user_id
    ).first()
    
    specific_questions = db.session.query(
        ProfessionalNotesSpecificQuestion
    ).filter_by(
        user_id=user_id
    ).all()
    
    return {
        'general_notes': notes.notes if notes else None,
        'custom_instructions': tech_notes.custom_instructions if tech_notes else None,
        'max_words': tech_notes.max_words if tech_notes else 120,
        'specific_questions': [
            {'text': q.question_text, 'type': q.question_type}
            for q in specific_questions
        ]
    }
```

---

## 💡 Key Points

1. **Admin feedback is stored per user** - Not per recording
2. **Feedback persists** - Used for all future recordings
3. **Feedback can be updated** - Admin can refine instructions over time
4. **Feedback enhances AI analysis** - Makes it more personalized
5. **Feedback is optional** - System works without it, but better with it

---

## 🚀 Next Steps

1. **Implement admin feedback endpoint** in Flask backend
2. **Update analysis function** to use admin notes
3. **Add feedback link to email** notifications
4. **Create admin dashboard** (or use existing admin panel)
5. **Test the flow** - Provide feedback, upload new recording, verify enhanced analysis

The database schema is already in place - you just need to implement the backend logic to store and use the feedback!
