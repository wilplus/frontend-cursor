-- Acoustic Dojo (audio-only) persistence.
-- Adds clip queue/source metadata and label submissions.
--
-- Rollback notes:
-- - Drop dependent views/triggers first, then labels table, then clips table.

CREATE TABLE IF NOT EXISTS public.acoustic_dojo_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_ref TEXT NULL,
  recording_id UUID NULL REFERENCES public.recordings(id) ON DELETE SET NULL,
  session_id UUID NULL REFERENCES public.v2_sessions(id) ON DELETE SET NULL,
  student_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  audio_url TEXT NULL,
  storage_path TEXT NULL,
  duration_sec FLOAT NULL,
  language_code TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  has_any_label BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT acoustic_dojo_clips_source_type_chk CHECK (source_type IN ('student', 'external'))
);

CREATE TABLE IF NOT EXISTS public.acoustic_dojo_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES public.acoustic_dojo_clips(id) ON DELETE CASCADE,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  label_stress BOOLEAN NOT NULL,
  label_charisma BOOLEAN NOT NULL,
  confidence NUMERIC(3,2) NOT NULL,
  labeled_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT acoustic_dojo_labels_confidence_chk CHECK (confidence >= 0 AND confidence <= 1),
  UNIQUE (clip_id, labeled_by)
);

CREATE INDEX IF NOT EXISTS idx_acoustic_dojo_clips_active
  ON public.acoustic_dojo_clips (is_active, has_any_label, created_at);

CREATE INDEX IF NOT EXISTS idx_acoustic_dojo_labels_clip
  ON public.acoustic_dojo_labels (clip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_acoustic_dojo_labels_labeled_by
  ON public.acoustic_dojo_labels (labeled_by, created_at DESC);

CREATE OR REPLACE FUNCTION public.acoustic_dojo_mark_clip_labeled()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.acoustic_dojo_clips
  SET has_any_label = TRUE,
      updated_at = NOW()
  WHERE id = NEW.clip_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acoustic_dojo_mark_clip_labeled ON public.acoustic_dojo_labels;
CREATE TRIGGER trg_acoustic_dojo_mark_clip_labeled
AFTER INSERT ON public.acoustic_dojo_labels
FOR EACH ROW
EXECUTE FUNCTION public.acoustic_dojo_mark_clip_labeled();

CREATE OR REPLACE VIEW public.acoustic_dojo_weekly_leaderboard AS
SELECT
  l.labeled_by,
  COUNT(*)::INT AS labels_count,
  DATE_TRUNC('week', NOW())::DATE AS week_start
FROM public.acoustic_dojo_labels l
WHERE l.created_at >= (NOW() - INTERVAL '7 days')
GROUP BY l.labeled_by
ORDER BY labels_count DESC, l.labeled_by;

COMMENT ON TABLE public.acoustic_dojo_clips IS
  'Acoustic Dojo clip queue. Audio-only sources from student sessions or external imports.';
COMMENT ON TABLE public.acoustic_dojo_labels IS
  'Binary stress/charisma labels with confidence and labeler identity.';
COMMENT ON VIEW public.acoustic_dojo_weekly_leaderboard IS
  'Weekly labels count by labeler for Dojo gamification panel.';

