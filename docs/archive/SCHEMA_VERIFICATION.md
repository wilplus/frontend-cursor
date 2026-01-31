# Post Recording Questions Table Schema Verification

## ✅ Current Schema (From Image)

Based on your Supabase table schema, here's what you have:

| Column | Type | Nullable | Default | Status |
|--------|------|----------|---------|--------|
| `id` | uuid | NO | uuid_generate_v4() | ✅ Required |
| `question_text` | text | NO | NULL | ✅ Required |
| `question_type` | text | YES | NULL | ⚠️ Should be NOT NULL |
| `created_at` | timestamp | YES | now() | ✅ Optional |
| `order_index` | integer | NO | 0 | ✅ Required |
| `session_id` | uuid | YES | NULL | ✅ Optional |
| `recording_id` | uuid | YES | NULL | ✅ Optional |
| `question_set_id` | integer | YES | NULL | ✅ Optional |

## Frontend Expectations

The frontend TypeScript interface expects:

```typescript
interface PostRecordingQuestion {
  id: UUID;                    // ✅ uuid
  question_text: string;        // ✅ text (NOT NULL)
  question_type: PostQuestionType; // ⚠️ Should be NOT NULL
  question_set_id?: number;     // ✅ integer (nullable OK)
  order_index: number;          // ✅ integer (NOT NULL)
  created_at?: string;         // ✅ timestamp (nullable OK)
}
```

## ⚠️ Minor Issue: question_type Should Be NOT NULL

The `question_type` column is currently nullable, but the frontend expects it to always be present. The backend should always set this value ('scale', 'binary', or 'free_text'), so it's safe to make it NOT NULL.

### Optional Fix (if you want stricter constraints):

```sql
-- Make question_type NOT NULL (if backend always sets it)
ALTER TABLE public.post_recording_questions
ALTER COLUMN question_type SET NOT NULL;

-- Add check constraint to ensure valid values
ALTER TABLE public.post_recording_questions
ADD CONSTRAINT chk_question_type 
CHECK (question_type IN ('scale', 'binary', 'free_text'));
```

## ✅ Everything Else Looks Good!

All required columns are present:
- ✅ `id` - UUID primary key
- ✅ `question_text` - The question text
- ✅ `question_type` - Type of question (scale/binary/free_text)
- ✅ `order_index` - Order within set (0, 1, 2)
- ✅ `question_set_id` - Which set (1-20)
- ✅ `session_id` - Link to session (optional)
- ✅ `recording_id` - Link to recording (optional)
- ✅ `created_at` - Timestamp (optional)

## Backend Should Now Work

With this schema, your backend should be able to:
1. ✅ Insert questions with `order_index`
2. ✅ Return questions with all required fields
3. ✅ Link questions to sessions and recordings
4. ✅ Query questions by set ID

The frontend will receive questions in the correct format and everything should work! 🎉
