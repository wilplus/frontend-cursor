-- Level 1 realtime progression support:
-- step 1 = current strength + pace
-- step 2 = pitch-baseline + pace

ALTER TABLE user_sniper_profile
  ADD COLUMN IF NOT EXISTS realtime_level SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS realtime_step SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sessions_with_pitch_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS realtime_pitch_baseline_st FLOAT NULL;

COMMENT ON COLUMN user_sniper_profile.realtime_level IS
  'Current realtime coaching level for the student.';
COMMENT ON COLUMN user_sniper_profile.realtime_step IS
  'Current realtime coaching step within the level.';
COMMENT ON COLUMN user_sniper_profile.sessions_with_pitch_count IS
  'How many sessions produced enough reliable pitch telemetry to update the realtime pitch baseline.';
COMMENT ON COLUMN user_sniper_profile.realtime_pitch_baseline_st IS
  'Student-specific pitch center in semitones, used by level 1 step 2 as the X-axis baseline.';

ALTER TABLE session_sniper_metrics
  ADD COLUMN IF NOT EXISTS pitch_center_st FLOAT NULL,
  ADD COLUMN IF NOT EXISTS pitch_frame_count INT NULL;

COMMENT ON COLUMN session_sniper_metrics.pitch_center_st IS
  'Session mean pitch center in semitones for realtime step progression.';
COMMENT ON COLUMN session_sniper_metrics.pitch_frame_count IS
  'Count of voiced frames with a confident pitch estimate for the session.';
