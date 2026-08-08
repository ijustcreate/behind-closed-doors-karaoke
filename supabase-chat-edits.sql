-- Applied to project dxmovgixxmepunzvgvrj on 2026-08-08.
alter table public.karaoke_chat_messages
  add column if not exists edited_at timestamptz;
alter table public.karaoke_chat_messages enable row level security;
alter table public.karaoke_chat_messages add column if not exists image_urls jsonb not null default '[]'::jsonb;
alter table public.karaoke_chat_messages drop constraint if exists karaoke_chat_messages_message_check;
alter table public.karaoke_chat_messages add constraint karaoke_chat_messages_message_check check (char_length(btrim(message)) between 1 and 1000);
