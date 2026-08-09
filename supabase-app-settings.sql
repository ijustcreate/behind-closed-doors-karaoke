-- Shared settings that every visitor may read, but only the server-side admin
-- function may change.
create table if not exists public.karaoke_app_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.karaoke_app_settings enable row level security;

grant select on table public.karaoke_app_settings to anon, authenticated;
revoke insert, update, delete on table public.karaoke_app_settings from anon, authenticated;

drop policy if exists "Public settings are readable" on public.karaoke_app_settings;
create policy "Public settings are readable"
  on public.karaoke_app_settings
  for select
  to anon, authenticated
  using (true);

insert into public.karaoke_app_settings (setting_key, setting_value)
values ('active_drink_menu', jsonb_build_object(
  'name', 'Aug 2026',
  'subheader', '',
  'subheaderVisible', false,
  'drinks', jsonb_build_array(
    jsonb_build_object('id','shared-buzz','name','The Buzz','price','15','description','Gin, housemade lavender honey, fresh squeezed lemon','image','assets/the-buzz-cocktail.png'),
    jsonb_build_object('id','shared-manhattan','name','Manhattan Twist','price','16','description','Bourbon & tequila, cherry liqueur, bitters','image','assets/manhattan-twist.png'),
    jsonb_build_object('id','shared-old-fashioned','name','BCD Old Fashioned','price','15','description','Bourbon, demerara, black walnut bitters','image','assets/bcd-old-fashioned.png'),
    jsonb_build_object('id','shared-monte-cassino','name','Monte Cassino','price','18','description','Rye, Chartreuse, Benedictine, fresh squeezed lemon','image',''),
    jsonb_build_object('id','shared-jalapeno','name','Jalapeño Business','price','16','description','Mezcal or tequila, cucumber, jalapeño, agave, fresh squeezed lime','image',''),
    jsonb_build_object('id','shared-sidecarry','name','Sidecarry Me Away','price','16','description','Cognac, triple sec, pineapple, fresh squeezed lemon','image',''),
    jsonb_build_object('id','shared-nightcap','name','The Nightcap','price','15','description','Vodka, Bailey’s, cold brew, coffee liqueur','image','')
  )
))
on conflict (setting_key) do nothing;
