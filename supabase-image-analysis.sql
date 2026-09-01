alter table public.karaoke_chat_messages
  add column if not exists image_states jsonb not null default '[]'::jsonb;

alter table public.karaoke_chat_messages
  drop constraint if exists karaoke_chat_messages_image_states_check;

alter table public.karaoke_chat_messages
  add constraint karaoke_chat_messages_image_states_check check (
    jsonb_typeof(image_states) = 'array'
    and jsonb_array_length(image_states) <= 4
    and not jsonb_path_exists(image_states, '$[*] ? (@ != "pending" && @ != "safe" && @ != "sensitive" && @ != "unknown")')
  );

drop policy if exists "karaoke chat accepts messages and pictures" on public.karaoke_chat_messages;
create policy "karaoke chat accepts messages and pictures"
  on public.karaoke_chat_messages
  for insert
  to anon, authenticated
  with check (
    char_length(profile_id) between 1 and 80
    and char_length(btrim(singer_name)) between 1 and 40
    and (
      char_length(btrim(message)) between 1 and 1000
      or (jsonb_typeof(image_urls) = 'array' and jsonb_array_length(image_urls) between 1 and 4)
    )
    and jsonb_typeof(reactions) = 'object'
    and image_states = '[]'::jsonb
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  );

create table if not exists public.karaoke_chat_image_analysis (
  message_id text not null references public.karaoke_chat_messages(id) on delete cascade,
  image_index smallint not null check (image_index between 0 and 3),
  private_caption text not null check (char_length(private_caption) between 1 and 1200),
  safety_status text not null check (safety_status in ('safe', 'sensitive', 'unknown')),
  safety_score real check (safety_score is null or safety_score between 0 and 1),
  detected_labels jsonb not null default '[]'::jsonb check (jsonb_typeof(detected_labels) = 'array'),
  vision_model text not null check (char_length(vision_model) between 1 and 100),
  analyzed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (message_id, image_index)
);

create index if not exists karaoke_chat_image_analysis_expiry_idx
  on public.karaoke_chat_image_analysis (expires_at);

alter table public.karaoke_chat_image_analysis enable row level security;
revoke all on table public.karaoke_chat_image_analysis from public, anon, authenticated;
grant select, insert, update, delete on table public.karaoke_chat_image_analysis to service_role;
drop policy if exists "service role manages private image analysis" on public.karaoke_chat_image_analysis;
create policy "service role manages private image analysis"
  on public.karaoke_chat_image_analysis
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.karaoke_worker_secrets (
  worker_name text primary key check (char_length(worker_name) between 1 and 80),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.karaoke_worker_secrets enable row level security;
revoke all on table public.karaoke_worker_secrets from public, anon, authenticated;
grant select, insert, update, delete on table public.karaoke_worker_secrets to service_role;
drop policy if exists "service role manages worker secrets" on public.karaoke_worker_secrets;
create policy "service role manages worker secrets"
  on public.karaoke_worker_secrets
  for all
  to service_role
  using (true)
  with check (true);
