-- Compatibility layer: keep legacy user_sniper_profile name available as a view.
-- Includes INSTEAD OF triggers for INSERT/UPDATE/DELETE passthrough to student_profile.
--
-- Rollback notes:
-- 1) DROP TRIGGER IF EXISTS ... ON public.user_sniper_profile
-- 2) DROP VIEW IF EXISTS public.user_sniper_profile
-- 3) DROP FUNCTION IF EXISTS public.user_sniper_profile_view_insert()
-- 4) DROP FUNCTION IF EXISTS public.user_sniper_profile_view_update()
-- 5) DROP FUNCTION IF EXISTS public.user_sniper_profile_view_delete()

CREATE OR REPLACE FUNCTION public.user_sniper_profile_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.student_profile (
    user_id,
    session_count,
    sessions_with_energy_count,
    sessions_with_pitch_count,
    baseline_wpm,
    baseline_pause_ms,
    baseline_dynamic_db,
    baseline_emphasis_per_min,
    baseline_energy_ratio,
    baseline_fatigue_sec,
    realtime_level,
    realtime_step,
    realtime_pitch_baseline_st,
    baseline_pitch_range_st,
    copilot_profile_bucket,
    copilot_stage,
    copilot_pending_count,
    copilot_last_reviewed_at,
    copilot_metadata,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    COALESCE(NEW.session_count, 0),
    COALESCE(NEW.sessions_with_energy_count, 0),
    COALESCE(NEW.sessions_with_pitch_count, 0),
    NEW.baseline_wpm,
    NEW.baseline_pause_ms,
    NEW.baseline_dynamic_db,
    NEW.baseline_emphasis_per_min,
    NEW.baseline_energy_ratio,
    NEW.baseline_fatigue_sec,
    COALESCE(NEW.realtime_level, 1),
    COALESCE(NEW.realtime_step, 1),
    NEW.realtime_pitch_baseline_st,
    NEW.baseline_pitch_range_st,
    NEW.copilot_profile_bucket,
    NEW.copilot_stage,
    COALESCE(NEW.copilot_pending_count, 0),
    NEW.copilot_last_reviewed_at,
    COALESCE(NEW.copilot_metadata, '{}'::jsonb),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    session_count = EXCLUDED.session_count,
    sessions_with_energy_count = EXCLUDED.sessions_with_energy_count,
    sessions_with_pitch_count = EXCLUDED.sessions_with_pitch_count,
    baseline_wpm = EXCLUDED.baseline_wpm,
    baseline_pause_ms = EXCLUDED.baseline_pause_ms,
    baseline_dynamic_db = EXCLUDED.baseline_dynamic_db,
    baseline_emphasis_per_min = EXCLUDED.baseline_emphasis_per_min,
    baseline_energy_ratio = EXCLUDED.baseline_energy_ratio,
    baseline_fatigue_sec = EXCLUDED.baseline_fatigue_sec,
    realtime_level = EXCLUDED.realtime_level,
    realtime_step = EXCLUDED.realtime_step,
    realtime_pitch_baseline_st = EXCLUDED.realtime_pitch_baseline_st,
    baseline_pitch_range_st = EXCLUDED.baseline_pitch_range_st,
    copilot_profile_bucket = EXCLUDED.copilot_profile_bucket,
    copilot_stage = EXCLUDED.copilot_stage,
    copilot_pending_count = EXCLUDED.copilot_pending_count,
    copilot_last_reviewed_at = EXCLUDED.copilot_last_reviewed_at,
    copilot_metadata = EXCLUDED.copilot_metadata,
    updated_at = COALESCE(EXCLUDED.updated_at, NOW());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_sniper_profile_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.student_profile
  SET
    user_id = NEW.user_id,
    session_count = COALESCE(NEW.session_count, 0),
    sessions_with_energy_count = COALESCE(NEW.sessions_with_energy_count, 0),
    sessions_with_pitch_count = COALESCE(NEW.sessions_with_pitch_count, 0),
    baseline_wpm = NEW.baseline_wpm,
    baseline_pause_ms = NEW.baseline_pause_ms,
    baseline_dynamic_db = NEW.baseline_dynamic_db,
    baseline_emphasis_per_min = NEW.baseline_emphasis_per_min,
    baseline_energy_ratio = NEW.baseline_energy_ratio,
    baseline_fatigue_sec = NEW.baseline_fatigue_sec,
    realtime_level = COALESCE(NEW.realtime_level, 1),
    realtime_step = COALESCE(NEW.realtime_step, 1),
    realtime_pitch_baseline_st = NEW.realtime_pitch_baseline_st,
    baseline_pitch_range_st = NEW.baseline_pitch_range_st,
    copilot_profile_bucket = NEW.copilot_profile_bucket,
    copilot_stage = NEW.copilot_stage,
    copilot_pending_count = COALESCE(NEW.copilot_pending_count, 0),
    copilot_last_reviewed_at = NEW.copilot_last_reviewed_at,
    copilot_metadata = COALESCE(NEW.copilot_metadata, '{}'::jsonb),
    updated_at = COALESCE(NEW.updated_at, NOW())
  WHERE user_id = OLD.user_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_sniper_profile_view_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.student_profile WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

DO $$
DECLARE
  relkind "char";
BEGIN
  SELECT c.relkind
    INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'user_sniper_profile';

  IF relkind = 'r' THEN
    RAISE NOTICE 'Skipping compatibility view creation because public.user_sniper_profile is a table.';
  ELSE
    EXECUTE 'CREATE OR REPLACE VIEW public.user_sniper_profile AS SELECT * FROM public.student_profile';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_user_sniper_profile_view_insert ON public.user_sniper_profile';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_user_sniper_profile_view_update ON public.user_sniper_profile';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_user_sniper_profile_view_delete ON public.user_sniper_profile';
    EXECUTE 'CREATE TRIGGER trg_user_sniper_profile_view_insert INSTEAD OF INSERT ON public.user_sniper_profile FOR EACH ROW EXECUTE FUNCTION public.user_sniper_profile_view_insert()';
    EXECUTE 'CREATE TRIGGER trg_user_sniper_profile_view_update INSTEAD OF UPDATE ON public.user_sniper_profile FOR EACH ROW EXECUTE FUNCTION public.user_sniper_profile_view_update()';
    EXECUTE 'CREATE TRIGGER trg_user_sniper_profile_view_delete INSTEAD OF DELETE ON public.user_sniper_profile FOR EACH ROW EXECUTE FUNCTION public.user_sniper_profile_view_delete()';
  END IF;
END $$;

