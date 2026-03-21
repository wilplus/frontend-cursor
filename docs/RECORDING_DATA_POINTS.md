# Recording Data Points

This document defines the two data layers the app should preserve:

1. **Smallest useful recording units for ML**
2. **Progressive measurement data for step progression and personalization**

These layers overlap, but they do not serve the same purpose.

## 1. Smallest useful recording units for ML

These are the smallest practical units that should be stored durably for future
pattern discovery and model training.

### Storage level

Store these in:

- `audio_recordings`
- `recording_frames`
- `recording_segments`
- `recording_annotations`
- `analysis_runs`

Run this migration:

- `docs/migrations/audio_recording_pipeline.sql`

### Frame-level units

Recommended frame size:

- `20ms`

Recommended hop size:

- `10ms` or `20ms`

Each frame should store:

- `recording_id`
- `frame_index`
- `start_ms`
- `end_ms`
- `rms_energy`
- `peak_amplitude`
- `zcr`
- `pitch_hz`
- `voicing_confidence`
- `is_voiced`
- `is_silence`
- `spectral_centroid_hz`
- `spectral_bandwidth_hz`
- `spectral_rolloff_hz`
- `spectral_flatness`
- `mfcc` (optional)

### Segment-level units

Segments are derived from frames and should store:

- `segment_type`
- `start_ms`
- `end_ms`
- `duration_ms`
- `confidence`
- `metadata`

Recommended segment types:

- `speech`
- `pause`
- `silence`
- `voiced`
- `unvoiced`

### Raw source of truth

The original uploaded audio remains the ultimate source of truth.

`audio_recordings` should store:

- original storage path
- original metadata
- canonical analysis path
- checksum
- extractor version
- feature schema version
- processing status

## 2. Progressive measurement data

These are not the smallest units. They are the durable summaries and baselines
used by the step system.

### Storage level

Store these in:

- `session_sniper_metrics`
- `user_sniper_profile`

### Per-session progressive data

Store per completed session:

- `paceWpm`
- `pitchCenterSt`
- `pitchFrameCount`
- `voicedDurationSec`
- `avgPauseMs`
- `dynamicRangeDb`
- `emphasisPerMin`
- `energyRatio`
- `realtime_level_at_session`
- `realtime_step_at_session`

In schema terms these map to:

- `session_sniper_metrics.wpm`
- `session_sniper_metrics.pitch_center_st`
- `session_sniper_metrics.pitch_frame_count`
- `session_sniper_metrics.voiced_duration_sec`
- `session_sniper_metrics.pause_ms`
- `session_sniper_metrics.dynamic_db`
- `session_sniper_metrics.emphasis_per_min`
- `session_sniper_metrics.energy_ratio`
- `session_sniper_metrics.realtime_level_at_session`
- `session_sniper_metrics.realtime_step_at_session`

### Per-user progressive data

Store per user:

- `realtime_pitch_baseline_st`
- `realtime_level`
- `realtime_step`

And keep using or extending:

- `baseline_wpm`
- `baseline_pause_ms`
- `baseline_dynamic_db`
- `baseline_emphasis_per_min`
- `baseline_energy_ratio`

These are the long-term memory of the training system.

## 3. Ownership of each data layer

### Backend worker should own

- original and canonical audio objects
- frame extraction
- segment extraction
- `analysis_runs`
- `audio_processing_jobs`
- durable raw-feature persistence

### Session completion / profile update should own

- session metric summaries
- user baseline updates
- step progression updates

### Admin review flow should own

- recording-level labels
- annotation metadata
- rubric-driven supervision

## 4. Current status in the app

### Already persisted meaningfully

- `paceWpm`
- `pitchCenterSt`
- `pitchFrameCount`
- `voicedDurationSec`
- `realtime_pitch_baseline_st`
- `realtime_level`
- `realtime_step`

### Present in schema / payload shape, but not yet extracted with real values in this recorder path

- `avgPauseMs`
- `dynamicRangeDb`
- `emphasisPerMin`
- `energyRatio`

### Not yet durably stored at the smallest useful unit

- frame-level acoustic features
- segment-level spans
- raw audio processing lineage

## 5. Coding note

The important design split is:

- **ML storage** keeps the smallest practical units and labels
- **progressive measurement storage** keeps reusable summaries and baselines

Do not collapse these into one table.

The intended separation is:

- `audio_recordings` / `recording_frames` / `recording_segments`
  - smallest useful units for ML and future reprocessing
- `session_sniper_metrics` / `user_sniper_profile`
  - adaptive measurement layer for progression and personalization
