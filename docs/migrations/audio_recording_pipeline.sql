-- Raw recording pipeline + progressive metric storage.
-- This migration is additive: it keeps the current app/session flow intact
-- while introducing durable storage for ML-ready recording units.

create extension if not exists pgcrypto;

-- 1) Source-of-truth recording object metadata.
create table if not exists public.audio_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text null,
  recording_id text null unique,
  recording_kind text null
    check (recording_kind in ('warmup', 'final', 'practice', 'other')),

  storage_bucket text not null,
  storage_object_path text not null,
  original_filename text null,

  mime_type text null,
  codec text null,
  channels integer null,
  sample_rate_hz integer null,
  bit_depth integer null,
  duration_ms integer null,
  file_size_bytes bigint null,
  sha256 text null,

  canonical_bucket text null,
  canonical_object_path text null,
  canonical_format text null,
  canonical_sample_rate_hz integer null,
  canonical_channels integer null,

  extractor_version text null,
  feature_schema_version text not null default 'v1',
  processing_status text not null default 'uploaded'
    check (processing_status in (
      'uploaded',
      'metadata_extracted',
      'canonicalized',
      'frames_extracted',
      'segments_extracted',
      'derived_metrics_extracted',
      'failed'
    )),
  processing_error text null,
  source_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (storage_bucket, storage_object_path)
);

comment on table public.audio_recordings is
  'Source-of-truth recording metadata for raw audio and canonical analysis files.';

create index if not exists idx_audio_recordings_user_id
  on public.audio_recordings(user_id);
create index if not exists idx_audio_recordings_session_id
  on public.audio_recordings(session_id);
create index if not exists idx_audio_recordings_processing_status
  on public.audio_recordings(processing_status);

-- 2) Smallest useful units for ML: short acoustic frames.
create table if not exists public.recording_frames (
  id bigserial primary key,
  recording_id uuid not null references public.audio_recordings(id) on delete cascade,
  frame_index integer not null,
  start_ms integer not null,
  end_ms integer not null,

  rms_energy double precision null,
  peak_amplitude double precision null,
  zcr double precision null,

  pitch_hz double precision null,
  voicing_confidence double precision null,
  is_voiced boolean null,
  is_silence boolean null,

  spectral_centroid_hz double precision null,
  spectral_bandwidth_hz double precision null,
  spectral_rolloff_hz double precision null,
  spectral_flatness double precision null,
  mfcc double precision[] null,

  created_at timestamptz not null default now(),

  unique (recording_id, frame_index)
);

comment on table public.recording_frames is
  'Frame-level acoustic features used as the smallest practical recording units for ML.';

create index if not exists idx_recording_frames_recording_time
  on public.recording_frames(recording_id, start_ms);

-- 3) Low-level contiguous segments derived from frames.
create table if not exists public.recording_segments (
  id bigserial primary key,
  recording_id uuid not null references public.audio_recordings(id) on delete cascade,
  segment_index integer not null,
  segment_type text not null
    check (segment_type in ('speech', 'pause', 'silence', 'voiced', 'unvoiced')),
  start_ms integer not null,
  end_ms integer not null,
  duration_ms integer not null,
  confidence double precision null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique (recording_id, segment_index)
);

comment on table public.recording_segments is
  'Durable low-level time spans derived from frame data.';

create index if not exists idx_recording_segments_recording_time
  on public.recording_segments(recording_id, start_ms);

-- 4) Human annotation spans for later supervised learning.
create table if not exists public.recording_annotations (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.audio_recordings(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  start_ms integer not null,
  end_ms integer not null,
  label text not null,
  rating double precision null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recording_annotations is
  'Manual time-range labels attached to recordings for future ML and QA workflows.';

create index if not exists idx_recording_annotations_recording_id
  on public.recording_annotations(recording_id);
create index if not exists idx_recording_annotations_label
  on public.recording_annotations(label);

-- 5) Extraction lineage.
create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.audio_recordings(id) on delete cascade,
  run_type text not null
    check (run_type in ('metadata', 'canonicalize', 'frames', 'segments', 'derived_metrics')),
  status text not null
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  extractor_name text not null,
  extractor_version text not null,
  config jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  finished_at timestamptz null,
  error text null,
  created_at timestamptz not null default now()
);

comment on table public.analysis_runs is
  'Extractor lineage and reproducibility records for raw recording processing.';

create index if not exists idx_analysis_runs_recording_type_version
  on public.analysis_runs(recording_id, run_type, extractor_version);

-- 6) Durable queue table for background worker leasing/retries.
create table if not exists public.audio_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.audio_recordings(id) on delete cascade,
  job_type text not null
    check (job_type in ('metadata', 'canonicalize', 'frames', 'segments', 'derived_metrics')),
  status text not null default 'queued'
    check (status in ('queued', 'leased', 'succeeded', 'failed')),
  priority integer not null default 100,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  leased_at timestamptz null,
  lease_owner text null,
  lease_expires_at timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.audio_processing_jobs is
  'Operational queue for durable background recording processing.';

create index if not exists idx_audio_processing_jobs_status_available
  on public.audio_processing_jobs(status, available_at);
create index if not exists idx_audio_processing_jobs_recording_job_type
  on public.audio_processing_jobs(recording_id, job_type);

-- 7) Progressive measurement snapshots per session.
alter table public.session_sniper_metrics
  add column if not exists recording_id text null,
  add column if not exists realtime_level_at_session smallint null,
  add column if not exists realtime_step_at_session smallint null;

comment on column public.session_sniper_metrics.recording_id is
  'Optional recording identifier associated with the session metrics row.';
comment on column public.session_sniper_metrics.realtime_level_at_session is
  'Student realtime level when this session was recorded.';
comment on column public.session_sniper_metrics.realtime_step_at_session is
  'Student realtime step when this session was recorded.';

create index if not exists idx_session_sniper_metrics_recording_id
  on public.session_sniper_metrics(recording_id);
