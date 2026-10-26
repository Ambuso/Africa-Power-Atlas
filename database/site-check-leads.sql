-- Run in your private Supabase project. Browser clients receive no table grants.
create table if not exists public.mapkwetu_site_check_leads (
  id text primary key,
  email text not null,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  report_id text not null,
  site jsonb not null,
  dataset_version text not null,
  consent_version text not null,
  consent boolean not null check (consent = true),
  marketing_consent boolean not null default false,
  expert_verification_requested boolean not null default false
);
alter table public.mapkwetu_site_check_leads enable row level security;
revoke all on public.mapkwetu_site_check_leads from anon, authenticated;
grant insert, select on public.mapkwetu_site_check_leads to service_role;
