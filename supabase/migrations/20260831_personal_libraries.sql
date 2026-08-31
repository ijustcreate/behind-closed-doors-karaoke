-- Account-scoped favorites and song history.  The client has no direct access;
-- karaoke-profile uses the service-role key after verifying the profile's credential.
create table if not exists public.karaoke_personal_libraries (
  profile_id text primary key references public.karaoke_profiles(id) on delete cascade,
  favorites jsonb not null default '[]'::jsonb check (jsonb_typeof(favorites) = 'array'),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.karaoke_personal_libraries enable row level security;
revoke all on table public.karaoke_personal_libraries from anon, authenticated;
