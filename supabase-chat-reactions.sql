alter table public.karaoke_chat_messages
  add column if not exists reactions jsonb not null default '{}'::jsonb;

alter table public.karaoke_chat_messages
  drop constraint if exists karaoke_chat_messages_message_check;

alter table public.karaoke_chat_messages
  add constraint karaoke_chat_messages_message_check check (
    (char_length(btrim(message)) between 1 and 1000)
    or (jsonb_typeof(image_urls) = 'array' and jsonb_array_length(image_urls) between 1 and 4)
  );

alter table public.karaoke_chat_messages
  drop constraint if exists karaoke_chat_messages_reactions_check;

alter table public.karaoke_chat_messages
  add constraint karaoke_chat_messages_reactions_check check (jsonb_typeof(reactions) = 'object');

drop policy if exists "karaoke chat accepts short messages" on public.karaoke_chat_messages;
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
    and created_at between now() - interval '5 minutes' and now() + interval '5 minutes'
  );
