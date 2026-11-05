-- Cartel Rankings become purely financial (USD):
--   balance = starting budget (Start phase, same for all teams) + sum of the per-phase impacts.
-- Phases lose the Impact checkboxes and get a free-text Evaluation instead.
-- Both tables are publicly readable (nothing secret in them); writes go through admin-api only.

-- 1) Starting budget (single row)
create table public.ranking_settings (
  id boolean primary key default true check (id),
  starting_budget bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.ranking_settings (id) values (true);

-- 2) Financial impact of a phase on a team (positive, negative or zero; no row = not recorded yet)
create table public.ranking_entries (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id) on delete cascade,
  phase_id text not null references public.phases(id) on delete cascade,
  amount bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, phase_id)
);

alter table public.ranking_settings enable row level security;
alter table public.ranking_entries enable row level security;
create policy "Anyone can read ranking settings" on public.ranking_settings for select using (true);
create policy "Anyone can read ranking entries" on public.ranking_entries for select using (true);
revoke insert, update, delete, truncate on public.ranking_settings, public.ranking_entries from anon, authenticated;
grant select on public.ranking_settings, public.ranking_entries to anon, authenticated;

-- Live leaderboard: push changes to every open Cartel Rankings screen
alter publication supabase_realtime add table public.ranking_settings, public.ranking_entries;

-- 3) Clear the old (Google Sheet based) rankings
update public.teams
set budget = 0, time_weeks = 0, expected_revenue = 0, time_bonus = 0, total_revenue = 0, rank = 0, last_recalculated = null;

-- 4) Evaluation replaces the Impact section of a phase (same text for all teams)
alter table public.phases add column if not exists evaluation text not null default '';
