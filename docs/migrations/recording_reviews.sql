-- ML 1.0 session-level review labels.
-- Keeps internal admin labels separate from student-facing coach messages.

create extension if not exists pgcrypto;

create table if not exists public.recording_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  recording_id text null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  overall_quality text not null
    check (overall_quality in ('good', 'bad', 'unclear')),
  confidence_score smallint not null
    check (confidence_score between 1 and 5),
  coach_style_score smallint not null
    check (coach_style_score between 1 and 10),
  notes text null,
  rubric_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, rubric_version)
);

comment on table public.recording_reviews is
  'Internal admin review labels for ML 1.0. One canonical review per session and rubric version.';
comment on column public.recording_reviews.session_id is
  'Homework/backend session identifier used as the phase-1 integration key.';
comment on column public.recording_reviews.recording_id is
  'Optional recording identifier for future raw-audio linkage.';
comment on column public.recording_reviews.reviewer_id is
  'Supabase auth user id of the admin who last saved this review.';
comment on column public.recording_reviews.notes is
  'Internal-only reviewer notes. Must not be shown to students.';
comment on column public.recording_reviews.rubric_version is
  'Label rubric version used to interpret the review fields.';

create index if not exists idx_recording_reviews_session_id
  on public.recording_reviews(session_id);

create index if not exists idx_recording_reviews_reviewer_id
  on public.recording_reviews(reviewer_id);

create index if not exists idx_recording_reviews_quality
  on public.recording_reviews(overall_quality);

create index if not exists idx_recording_reviews_rubric_version
  on public.recording_reviews(rubric_version);

alter table public.recording_reviews enable row level security;

-- All app access should go through server-side routes with the service role key.
-- Intentionally do not add direct client policies.
