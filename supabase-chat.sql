create table if not exists public.karaoke_chat_messages (
  id text primary key,
  profile_id text not null check (char_length(profile_id) between 1 and 80),
  singer_name text not null check (char_length(btrim(singer_name)) between 1 and 40),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  image_urls jsonb not null default '[]'::jsonb,
  night_key date not null,
  created_at timestamptz not null default now()
);

create index if not exists karaoke_chat_messages_night_created_idx
  on public.karaoke_chat_messages (night_key, created_at desc);

alter table public.karaoke_chat_messages enable row level security;

grant select, insert on table public.karaoke_chat_messages to anon, authenticated;
revoke update, delete on table public.karaoke_chat_messages from anon, authenticated;

drop policy if exists "karaoke chat is readable" on public.karaoke_chat_messages;
create policy "karaoke chat is readable"
  on public.karaoke_chat_messages
  for select
  to anon, authenticated
  using (true);

drop policy if exists "karaoke chat accepts short messages" on public.karaoke_chat_messages;
create policy "karaoke chat accepts short messages"
  on public.karaoke_chat_messages
  for insert
  to anon, authenticated
  with check (
    char_length(profile_id) between 1 and 80
    and char_length(btrim(singer_name)) between 1 and 40
    and char_length(btrim(message)) between 1 and 1000
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  );
