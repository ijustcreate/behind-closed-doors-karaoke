-- Applied to project dxmovgixxmepunzvgvrj on 2026-08-08.
-- Stores a glyph credential separately so an account can retain its regular password.
alter table public.karaoke_profiles add column if not exists glyph_hash text;
alter table public.karaoke_profiles add constraint karaoke_profiles_glyph_hash_format check (glyph_hash is null or glyph_hash ~ '^[0-9a-f]{64}$') not valid;
alter table public.karaoke_profiles validate constraint karaoke_profiles_glyph_hash_format;
