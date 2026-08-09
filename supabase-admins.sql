-- Applied to project dxmovgixxmepunzvgvrj on 2026-08-08.
alter table public.karaoke_profiles add column if not exists is_admin boolean not null default false;
alter table public.karaoke_profiles add column if not exists last_seen timestamptz not null default now();
create index if not exists karaoke_profiles_last_seen_idx on public.karaoke_profiles (last_seen desc);
update public.karaoke_profiles
set is_admin = true
where lower(display_name) in ('felix', 'sara', 'orlando')
   or lower(username) in ('felix', 'sara', 'orlando');
alter table public.karaoke_profiles enable row level security;
