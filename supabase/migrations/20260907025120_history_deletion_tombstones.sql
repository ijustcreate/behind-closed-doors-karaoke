-- Preserve per-account history deletions across devices.  A stale device can
-- otherwise merge a deleted row back into the shared JSON library.
alter table public.karaoke_personal_libraries
  add column if not exists history_tombstones jsonb not null default '[]'::jsonb
  check (jsonb_typeof(history_tombstones) = 'array');
