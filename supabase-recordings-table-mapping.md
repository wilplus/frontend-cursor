# Recordings Table Column Mapping

## Your Current Schema vs API Contract

### Your Database Columns:
- `id` (uuid, NOT NULL) → maps to `recording_id` in API
- `user_id` (uuid, nullable)
- `session_id` (uuid, nullable)
- `audio_url` (text, **NOT NULL**) ← **REQUIRED - Backend must set this**
- `duration` (integer, **NOT NULL**) ← **REQUIRED**
- `transcription` (text, nullable) → maps to `transcription_text` in API
- `analysis_report` (text, nullable) → maps to `analysis.report` in API
- `filler_words_count` (jsonb, nullable) → maps to `metrics.filler_breakdown` in API
- `words_per_minute` (double precision, nullable) → maps to `metrics.wpm` in API
- `created_at` (timestamp, nullable)

### API Contract (GetRecordingResponse):
```typescript
{
  recording_id: UUID;
  session_id: UUID;
  status: string;
  transcription_text: string | null;
  metrics: {
    wpm: number;
    filler_count: number;
    filler_breakdown: Record<string, number>;
    duration_seconds: number;
  };
  analysis: {
    report: string | null;
    trend_sentence: string | null;
  };
  // ... answers, created_at
}
```

## The Problem

Your Flask backend is likely trying to insert a recording **without setting `audio_url`** (which is NOT NULL), causing the 500 error.

## Solution

Your Flask backend needs to:

1. **Upload the audio file to Supabase Storage first**
2. **Get the signed URL or public URL**
3. **Then insert the recording with `audio_url` set**

Or, if you want to allow NULL initially:

```sql
-- Make audio_url nullable temporarily (if backend processes async)
ALTER TABLE public.recordings
ALTER COLUMN audio_url DROP NOT NULL;
```

But the better solution is to ensure your Flask backend sets `audio_url` during the upload process.
