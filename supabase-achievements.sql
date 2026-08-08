-- Applied to project dxmovgixxmepunzvgvrj on 2026-08-08.
create table if not exists public.karaoke_achievements (
  id text primary key,
  profile_id text not null,
  achievement_key text not null,
  created_at timestamptz not null default now(),
  unique(profile_id, achievement_key)
);
create index if not exists karaoke_achievements_profile_created_idx
  on public.karaoke_achievements(profile_id, created_at desc);
alter table public.karaoke_achievements enable row level security;
