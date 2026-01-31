-- ============================================================================
-- Complete Supabase Schema Setup (FIXED)
-- Run this script in Supabase SQL Editor to set up the entire database schema
-- This script is idempotent - safe to run multiple times
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Pre-recording questions (static, global)
CREATE TABLE IF NOT EXISTS pre_recording_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text TEXT NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Post-recording questions (dynamic selection)
-- FIXED: Use correct question_type values ('scale', 'binary', 'free_text')
-- NOTE: No constraint on creation - will add after dropping old ones
CREATE TABLE IF NOT EXISTS post_recording_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text TEXT NOT NULL,
  question_type TEXT, -- Constraint will be added later after dropping old ones
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recording sessions (state tracking)
CREATE TABLE IF NOT EXISTS recording_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN (
    'pre_questions_pending',
    'recording_ready',
    'recording_uploaded',
    'post_questions_pending',
    'generating_report',
    'completed',
    'abandoned',
    'report_generation_failed'
  )) DEFAULT 'pre_questions_pending',
  recording_id UUID,
  abandon_reason TEXT,
  abandoned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT NOW()
);

-- Recordings table (create base structure first)
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  audio_url TEXT NOT NULL,
  duration INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ADD ALL RECORDINGS TABLE COLUMNS (idempotent)
-- ============================================================================

-- Add columns that might not exist, or alter if they exist with wrong type
DO $$ 
BEGIN
  -- transcription_text (prefer over old 'transcription' column)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'transcription_text'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN transcription_text TEXT;
    -- Migrate data from old 'transcription' column if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'transcription'
    ) THEN
      UPDATE public.recordings 
      SET transcription_text = transcription 
      WHERE transcription_text IS NULL AND transcription IS NOT NULL;
    END IF;
  END IF;

  -- duration_seconds (NUMERIC to accept decimals)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN duration_seconds NUMERIC;
    -- Initialize from duration if available
    UPDATE public.recordings 
    SET duration_seconds = duration 
    WHERE duration_seconds IS NULL AND duration IS NOT NULL;
  ELSE
    -- Ensure it's NUMERIC type (not INTEGER)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'recordings' 
      AND column_name = 'duration_seconds' 
      AND data_type = 'integer'
    ) THEN
      ALTER TABLE public.recordings ALTER COLUMN duration_seconds TYPE NUMERIC;
    END IF;
  END IF;

  -- words_per_minute
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'words_per_minute'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN words_per_minute NUMERIC;
  END IF;

  -- filler_words_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'filler_words_count'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN filler_words_count JSONB;
  END IF;

  -- classification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'classification'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN classification TEXT;
  END IF;

  -- confidence (TEXT type, not NUMERIC)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'confidence'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN confidence TEXT;
  ELSE
    -- If it exists as wrong type, change it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'recordings' 
      AND column_name = 'confidence' 
      AND data_type != 'text'
    ) THEN
      ALTER TABLE public.recordings ALTER COLUMN confidence TYPE TEXT USING confidence::TEXT;
    END IF;
  END IF;

  -- storage_path
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN storage_path TEXT;
  END IF;

  -- coaching_report
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'coaching_report'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN coaching_report TEXT;
  END IF;

  -- trend_sentence
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'trend_sentence'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN trend_sentence TEXT;
  END IF;

  -- analysis_report (legacy column, keep for backward compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'analysis_report'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN analysis_report TEXT;
  END IF;

  -- transcription (legacy column, keep for backward compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'transcription'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN transcription TEXT;
  END IF;

  -- command_option_id (v1: required form field on upload; value "A" | "B" | "C")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'command_option_id'
  ) THEN
    ALTER TABLE public.recordings ADD COLUMN command_option_id TEXT;
  END IF;
END $$;

-- ============================================================================
-- ADD RECORDING_SESSIONS BOOLEAN COLUMNS
-- ============================================================================

DO $$ 
BEGIN
  -- pre_questions_completed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'pre_questions_completed'
  ) THEN
    ALTER TABLE public.recording_sessions 
    ADD COLUMN pre_questions_completed BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  -- recording_completed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'recording_completed'
  ) THEN
    ALTER TABLE public.recording_sessions 
    ADD COLUMN recording_completed BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  -- post_questions_completed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'post_questions_completed'
  ) THEN
    ALTER TABLE public.recording_sessions 
    ADD COLUMN post_questions_completed BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  -- Questionnaire data columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'mood'
  ) THEN
    ALTER TABLE public.recording_sessions ADD COLUMN mood TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'readiness'
  ) THEN
    ALTER TABLE public.recording_sessions ADD COLUMN readiness INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'inspiration_needed'
  ) THEN
    ALTER TABLE public.recording_sessions ADD COLUMN inspiration_needed BOOLEAN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'cursor'
  ) THEN
    ALTER TABLE public.recording_sessions ADD COLUMN cursor NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'recording_sessions' AND column_name = 'mode'
  ) THEN
    ALTER TABLE public.recording_sessions ADD COLUMN mode TEXT;
  END IF;
END $$;

-- ============================================================================
-- FIX EXISTING SESSIONS
-- ============================================================================

-- If a session has a recording_id, it means recording was uploaded
-- So pre_questions must have been completed (even if flag is wrong)
UPDATE public.recording_sessions
SET pre_questions_completed = TRUE
WHERE recording_id IS NOT NULL 
  AND pre_questions_completed = FALSE;

-- If status is 'recording_ready' or beyond, pre_questions are completed
UPDATE public.recording_sessions
SET pre_questions_completed = TRUE
WHERE status IN ('recording_ready', 'recording', 'recorded', 'post_questions', 'completed')
  AND pre_questions_completed = FALSE;

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add FK from sessions to recordings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_recording' AND table_name = 'recording_sessions'
  ) THEN
    ALTER TABLE recording_sessions 
    ADD CONSTRAINT fk_recording 
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK from recordings to sessions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_session' AND table_name = 'recordings'
  ) THEN
    ALTER TABLE recordings 
    ADD CONSTRAINT fk_session 
    FOREIGN KEY (session_id) REFERENCES recording_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- REMAINING TABLES
-- ============================================================================

-- Pre-recording answers
CREATE TABLE IF NOT EXISTS pre_recording_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_session_id UUID REFERENCES recording_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES pre_recording_questions(id),
  answer_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Post-recording answers
CREATE TABLE IF NOT EXISTS post_recording_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
  session_id UUID REFERENCES recording_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES post_recording_questions(id),
  answer_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User filler patterns (learning over time)
CREATE TABLE IF NOT EXISTS user_filler_patterns (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filler_word TEXT NOT NULL,
  frequency INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, filler_word)
);

-- Admin notes per user
CREATE TABLE IF NOT EXISTS professional_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Report generation constraints per user
CREATE TABLE IF NOT EXISTS professional_notes_report_tech (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  max_words INT DEFAULT 120,
  custom_instructions TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- User-specific questions
CREATE TABLE IF NOT EXISTS professional_notes_specific_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('pre', 'post')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin users (for future multi-admin)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('super_admin', 'coach', 'reviewer')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Admin notifications (email audit log)
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES recording_sessions(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,
  sent_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload_json JSONB,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance scores table
CREATE TABLE IF NOT EXISTS performance_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  performance NUMERIC NOT NULL,
  final_kpi NUMERIC NOT NULL,
  resilience_bonus NUMERIC DEFAULT 0,
  awareness_bonus NUMERIC DEFAULT 0,
  progress_bonus NUMERIC DEFAULT 0,
  streak_bonus NUMERIC DEFAULT 0,
  filler_score NUMERIC NOT NULL,
  pacing_score NUMERIC NOT NULL,
  attitude_score NUMERIC NOT NULL,
  reflection_score NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(recording_id)
);

-- ============================================================================
-- FIX POST_RECORDING_QUESTIONS TABLE
-- ============================================================================

-- Add missing columns to post_recording_questions
DO $$
BEGIN
    -- Add session_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN session_id UUID;
        
        -- Add foreign key constraint after column exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recording_sessions') THEN
            -- Drop constraint if exists first
            ALTER TABLE public.post_recording_questions
            DROP CONSTRAINT IF EXISTS fk_post_questions_session;
            
            ALTER TABLE public.post_recording_questions
            ADD CONSTRAINT fk_post_questions_session 
            FOREIGN KEY (session_id) REFERENCES public.recording_sessions(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Add recording_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'recording_id'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN recording_id UUID;
        
        -- Add foreign key constraint after column exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recordings') THEN
            -- Drop constraint if exists first
            ALTER TABLE public.post_recording_questions
            DROP CONSTRAINT IF EXISTS fk_post_questions_recording;
            
            ALTER TABLE public.post_recording_questions
            ADD CONSTRAINT fk_post_questions_recording 
            FOREIGN KEY (recording_id) REFERENCES public.recordings(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Add question_set_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'question_set_id'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN question_set_id INTEGER;
    END IF;

    -- Add order_index if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'order_index'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- FIX QUESTION_TYPE DATA AND CONSTRAINT
-- IMPORTANT: Drop old constraints FIRST, then fix data, then add new constraints
-- ============================================================================

-- Step 1: Drop ALL existing check constraints on question_type FIRST
-- This must happen before any data updates or inserts
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all question_type check constraints (including the old one)
    FOR r IN (
        SELECT conname
        FROM pg_constraint 
        WHERE conrelid = 'public.post_recording_questions'::regclass 
        AND contype = 'c'
        AND (
            pg_get_constraintdef(oid) LIKE '%question_type%'
            OR conname LIKE '%question_type%'
        )
    ) LOOP
        EXECUTE format('ALTER TABLE public.post_recording_questions DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
    
    -- Also try dropping by common names
    ALTER TABLE public.post_recording_questions DROP CONSTRAINT IF EXISTS post_recording_questions_question_type_check;
    ALTER TABLE public.post_recording_questions DROP CONSTRAINT IF EXISTS chk_question_type;
END $$;

-- Step 2: Update existing invalid question_type values
UPDATE public.post_recording_questions
SET question_type = CASE 
    WHEN order_index = 0 THEN 'scale'
    WHEN order_index = 1 THEN 'binary'
    WHEN order_index = 2 THEN 'free_text'
    ELSE 'scale'  -- Default fallback
END
WHERE question_type IS NULL 
   OR question_type NOT IN ('scale', 'binary', 'free_text');

-- Step 3: Set default for any remaining NULLs
UPDATE public.post_recording_questions
SET question_type = 'scale'
WHERE question_type IS NULL;

-- Step 4: Make question_type NOT NULL if it isn't already
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'question_type'
        AND is_nullable = 'YES'
    ) THEN
        -- First ensure no NULLs
        UPDATE public.post_recording_questions SET question_type = 'scale' WHERE question_type IS NULL;
        -- Then make NOT NULL
        ALTER TABLE public.post_recording_questions ALTER COLUMN question_type SET NOT NULL;
    END IF;
END $$;

-- Step 5: Add correct check constraint (after data is fixed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.post_recording_questions'::regclass 
        AND conname = 'chk_question_type'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD CONSTRAINT chk_question_type 
        CHECK (question_type IN ('scale', 'binary', 'free_text'));
    END IF;
END $$;

-- Step 6: Add order_index check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.post_recording_questions'::regclass 
        AND conname = 'chk_order_index'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD CONSTRAINT chk_order_index 
        CHECK (order_index IN (0, 1, 2));
    END IF;
END $$;

-- ============================================================================
-- DROP OLD TRIGGERS/FUNCTIONS
-- ============================================================================

-- Drop the trigger that's trying to create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function that creates profiles
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON recording_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recordings_user ON recordings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions ON recording_sessions(user_id, status) 
  WHERE status NOT IN ('completed', 'abandoned');
CREATE INDEX IF NOT EXISTS idx_recording_sessions_user_status 
  ON public.recording_sessions(user_id, pre_questions_completed, recording_completed, post_questions_completed);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_user_active
  ON public.recording_sessions(user_id, status)
  WHERE status NOT IN ('completed', 'abandoned');
CREATE INDEX IF NOT EXISTS idx_post_questions_session_id 
  ON public.post_recording_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_post_questions_recording_id 
  ON public.post_recording_questions(recording_id);
CREATE INDEX IF NOT EXISTS idx_post_questions_set_id 
  ON public.post_recording_questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_performance_scores_recording 
  ON performance_scores(recording_id);

-- ============================================================================
-- SEED DATA (only if tables are empty)
-- ============================================================================

-- Seed default pre-recording questions
INSERT INTO pre_recording_questions (question_text, order_index)
SELECT * FROM (VALUES
  ('How are you feeling today?', 1),
  ('What is your main goal for this recording session?', 2),
  ('Are there any specific challenges you want to work on?', 3)
) AS v(question_text, order_index)
WHERE NOT EXISTS (SELECT 1 FROM pre_recording_questions LIMIT 1);

-- Seed initial post-recording questions (using new format)
-- NOTE: These are just examples - backend will generate questions dynamically
-- IMPORTANT: This runs AFTER constraints are fixed, so it should work
INSERT INTO post_recording_questions (question_text, question_type, order_index, question_set_id)
SELECT * FROM (VALUES
  ('How present were you while speaking?', 'scale', 0, 1),
  ('Did you notice yourself using filler words?', 'binary', 1, 1),
  ('What moment felt the most real?', 'free_text', 2, 1)
) AS v(question_text, question_type, order_index, question_set_id)
WHERE NOT EXISTS (SELECT 1 FROM post_recording_questions LIMIT 1)
ON CONFLICT DO NOTHING;

-- Insert super admin (only if not exists)
INSERT INTO admin_users (email, role)
SELECT 'artur@willonski.com', 'super_admin'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE email = 'artur@willonski.com'
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify post_recording_questions structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'post_recording_questions'
ORDER BY ordinal_position;

-- Verify constraints
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.post_recording_questions'::regclass
AND contype = 'c'
ORDER BY conname;

-- Verify question_type values
SELECT 
    question_type,
    COUNT(*) as count
FROM public.post_recording_questions
GROUP BY question_type
ORDER BY question_type;

-- ============================================================================
-- SOLO-RELEVANT SCHEMA UPDATES
-- Add new fields for solo-focused questions and scoring
-- ============================================================================

-- UPDATE recording_sessions: Add structure field (replaces inspiration_needed)
DO $$
BEGIN
    -- Add structure field (guided/open) if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'recording_sessions' 
        AND column_name = 'structure'
    ) THEN
        ALTER TABLE public.recording_sessions
        ADD COLUMN structure TEXT CHECK (structure IN ('guided', 'open'));
        
        -- Migrate from inspiration_needed if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'recording_sessions' 
            AND column_name = 'inspiration_needed'
        ) THEN
            UPDATE public.recording_sessions
            SET structure = CASE 
                WHEN inspiration_needed = TRUE THEN 'guided'
                WHEN inspiration_needed = FALSE THEN 'open'
                ELSE NULL
            END
            WHERE structure IS NULL;
        END IF;
    END IF;
END $$;

-- UPDATE recordings: Add new metrics (voice_stability, energy_score)
DO $$
BEGIN
    -- Add voice_stability if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'recordings' 
        AND column_name = 'voice_stability'
    ) THEN
        ALTER TABLE public.recordings
        ADD COLUMN voice_stability NUMERIC; -- 0.0-1.0 (normalized)
    END IF;

    -- Add energy_score if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'recordings' 
        AND column_name = 'energy_score'
    ) THEN
        ALTER TABLE public.recordings
        ADD COLUMN energy_score NUMERIC; -- 0.0-1.0 (normalized)
    END IF;

    -- Add pacing_score if missing (for normalized storage)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'recordings' 
        AND column_name = 'pacing_score'
    ) THEN
        ALTER TABLE public.recordings
        ADD COLUMN pacing_score NUMERIC; -- 0.0-1.0 (normalized)
    END IF;
END $$;

-- UPDATE performance_scores: Add new fields for explainability
DO $$
BEGIN
    -- Add voice_stability_score if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'performance_scores' 
        AND column_name = 'voice_stability_score'
    ) THEN
        ALTER TABLE public.performance_scores
        ADD COLUMN voice_stability_score NUMERIC NOT NULL DEFAULT 0;
    END IF;

    -- Add energy_score if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'performance_scores' 
        AND column_name = 'energy_score'
    ) THEN
        ALTER TABLE public.performance_scores
        ADD COLUMN energy_score NUMERIC NOT NULL DEFAULT 0;
    END IF;

    -- Add awareness_score if missing (from post-questions Q1)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'performance_scores' 
        AND column_name = 'awareness_score'
    ) THEN
        ALTER TABLE public.performance_scores
        ADD COLUMN awareness_score NUMERIC NOT NULL DEFAULT 0;
    END IF;

    -- Add mood_multiplier if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'performance_scores' 
        AND column_name = 'mood_multiplier'
    ) THEN
        ALTER TABLE public.performance_scores
        ADD COLUMN mood_multiplier NUMERIC; -- 1.0 for positive, 0.75 for negative
    END IF;

    -- Add readiness_score if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'performance_scores' 
        AND column_name = 'readiness_score'
    ) THEN
        ALTER TABLE public.performance_scores
        ADD COLUMN readiness_score NUMERIC; -- 0.0-1.0 (normalized from 1-10)
    END IF;

    -- Rename attitude_score to energy_score if it exists (for clarity)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'performance_scores' 
        AND column_name = 'attitude_score'
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'performance_scores' 
            AND column_name = 'energy_score'
        )
    ) THEN
        ALTER TABLE public.performance_scores
        RENAME COLUMN attitude_score TO energy_score;
    END IF;
END $$;

-- UPDATE post_recording_answers: Add reflection_text field
DO $$
BEGIN
    -- Add reflection_text if missing (for Q3 free text answer)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_answers' 
        AND column_name = 'reflection_text'
    ) THEN
        ALTER TABLE public.post_recording_answers
        ADD COLUMN reflection_text TEXT;
    END IF;
END $$;

-- Verify solo-relevant schema updates
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'recording_sessions'
AND column_name IN ('structure', 'mood', 'readiness', 'inspiration_needed')
ORDER BY column_name;

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'recordings'
AND column_name IN ('voice_stability', 'energy_score', 'pacing_score')
ORDER BY column_name;

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'performance_scores'
AND column_name IN ('voice_stability_score', 'energy_score', 'awareness_score', 'mood_multiplier', 'readiness_score')
ORDER BY column_name;
