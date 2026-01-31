-- ============================================================================
-- Solo-Relevant Schema Updates
-- Updates to support solo-focused questions and new scoring metrics
-- ============================================================================

-- ============================================================================
-- UPDATE recording_sessions: Add structure field (replaces inspiration_needed)
-- ============================================================================

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

-- ============================================================================
-- UPDATE recordings: Add new metrics (voice_stability, energy_score)
-- ============================================================================

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

-- ============================================================================
-- UPDATE performance_scores: Add new fields for explainability
-- ============================================================================

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

-- ============================================================================
-- UPDATE post_recording_answers: Add reflection_text field
-- ============================================================================

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
        
        -- Migrate from answer_text if Q3 (order_index=2) and answer_text is long
        -- This is optional - backend can handle it
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify recording_sessions structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'recording_sessions'
AND column_name IN ('structure', 'mood', 'readiness', 'inspiration_needed')
ORDER BY column_name;

-- Verify recordings new metrics
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'recordings'
AND column_name IN ('voice_stability', 'energy_score', 'pacing_score')
ORDER BY column_name;

-- Verify performance_scores new fields
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'performance_scores'
AND column_name IN ('voice_stability_score', 'energy_score', 'awareness_score', 'mood_multiplier', 'readiness_score')
ORDER BY column_name;
