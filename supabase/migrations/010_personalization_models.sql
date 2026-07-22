-- Phase 4 — 개인화 Ridge MVP (additive only)
-- 기존 diary_entries / journal_* / astrology_* 파괴 변경 없음
-- docs/MIGRATION_STRATEGY.md · docs/PERSONALIZATION_MODEL_SCHEMA.md

create table if not exists public.personalization_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null,
  model_type text not null default 'ridge',
  model_status text not null,
  data_stage text not null,
  training_start_date date,
  training_end_date date,
  valid_sample_count integer not null default 0,
  feature_keys jsonb not null default '[]'::jsonb,
  coefficients jsonb not null default '[]'::jsonb,
  intercept double precision not null default 0,
  lambda double precision not null default 10,
  feature_means jsonb not null default '[]'::jsonb,
  feature_stds jsonb not null default '[]'::jsonb,
  normalization_metadata jsonb not null default '{}'::jsonb,
  baseline_metrics jsonb not null default '{}'::jsonb,
  model_metrics jsonb not null default '{}'::jsonb,
  confidence_components jsonb not null default '{}'::jsonb,
  confidence_score double precision not null default 0,
  confidence_band text not null default 'insufficient',
  prediction_visible boolean not null default false,
  summary_text text,
  calculation_version text not null,
  theory_version text not null,
  feature_schema_version text not null,
  model_version text not null,
  allowlist_version text not null,
  model_code_version text not null,
  training_run_key text not null,
  snapshot_id_from uuid,
  snapshot_id_to uuid,
  created_at timestamptz not null default now(),
  deprecated_at timestamptz,
  constraint personalization_models_type_check
    check (model_type = 'ridge'),
  constraint personalization_models_status_check
    check (model_status in (
      'active', 'degraded', 'insufficient_signal', 'insufficient_data', 'training', 'failed'
    )),
  constraint personalization_models_stage_check
    check (data_stage in (
      'insufficient_data', 'early_signal', 'active', 'stable_candidate'
    ))
);

create unique index if not exists personalization_models_run_key_uidx
  on public.personalization_models (training_run_key);

create index if not exists personalization_models_user_cat_idx
  on public.personalization_models (user_id, category_key, created_at desc);

create table if not exists public.personalization_model_metrics (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.personalization_models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  baseline_mae double precision,
  ridge_mae double precision,
  mae_improvement double precision,
  direction_accuracy double precision,
  spearman_rho double precision,
  validation_sample_count integer,
  train_sample_count integer,
  lambda double precision,
  created_at timestamptz not null default now()
);

create index if not exists personalization_model_metrics_model_idx
  on public.personalization_model_metrics (model_id);

create table if not exists public.personalization_predictions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.personalization_models(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null,
  local_date date not null,
  predicted_z double precision,
  baseline_raw double precision,
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  unique (model_id, local_date)
);

create index if not exists personalization_predictions_user_date_idx
  on public.personalization_predictions (user_id, local_date desc);

alter table public.personalization_models enable row level security;
alter table public.personalization_model_metrics enable row level security;
alter table public.personalization_predictions enable row level security;

drop policy if exists "Users manage own personalization_models" on public.personalization_models;
create policy "Users manage own personalization_models"
  on public.personalization_models for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own personalization_model_metrics" on public.personalization_model_metrics;
create policy "Users manage own personalization_model_metrics"
  on public.personalization_model_metrics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own personalization_predictions" on public.personalization_predictions;
create policy "Users manage own personalization_predictions"
  on public.personalization_predictions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
