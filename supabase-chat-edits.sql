-- Applied to project dxmovgixxmepunzvgvrj on 2026-08-08.
alter table public.karaoke_chat_messages
  add column if not exists edited_at timestamptz;
alter table public.karaoke_chat_messages enable row level security;
