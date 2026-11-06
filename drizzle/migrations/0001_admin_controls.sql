-- 0001: richer ads, full manifesto entries for every office, safer publishing rights, ad image storage

-- Ads: sponsor name + accessibility text
alter table public.ads
  add column if not exists sponsor text,
  add column if not exists alt_text text;

-- Manifesto entries: everything the public profile page shows
alter table public.aspirant_entries
  add column if not exists status_note text not null default '',
  add column if not exists evidence_state text not null default 'Not yet assessed',
  add column if not exists pillars jsonb not null default '[]',
  add column if not exists reviewed_at date;
create index if not exists aspirant_entries_office_idx on public.aspirant_entries (office);

-- Only admins and editors may publish or edit published profiles.
-- Moderators may create and edit drafts, so nothing reaches readers without an editor's sign-off.
drop policy if exists "Staff manage entries" on public.aspirant_entries;
drop policy if exists "Admins/editors manage entries" on public.aspirant_entries;
create policy "Admins/editors manage entries" on public.aspirant_entries for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop policy if exists "Moderators create drafts" on public.aspirant_entries;
create policy "Moderators create drafts" on public.aspirant_entries for insert to authenticated
with check (public.has_role(auth.uid(),'moderator') and not published);
drop policy if exists "Moderators edit drafts" on public.aspirant_entries;
create policy "Moderators edit drafts" on public.aspirant_entries for update to authenticated
using (public.has_role(auth.uid(),'moderator') and not published)
with check (public.has_role(auth.uid(),'moderator') and not published);

-- Moderators may manage the content rules (hide stories, block sources/words) and nothing else in settings
drop policy if exists "Moderators write content rules" on public.site_settings;
create policy "Moderators write content rules" on public.site_settings for all to authenticated
using (key = 'content' and public.has_role(auth.uid(),'moderator'))
with check (key = 'content' and public.has_role(auth.uid(),'moderator'));

-- Public site banner (announcements / celebrations / alerts)
insert into public.site_settings(key,value) values
 ('banner','{"active":false,"text":"","level":"info","link":""}')
on conflict (key) do nothing;

-- Keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists aspirant_entries_touch on public.aspirant_entries;
create trigger aspirant_entries_touch before update on public.aspirant_entries
for each row execute function public.touch_updated_at();
drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
for each row execute function public.touch_updated_at();

-- Storage for ad images
insert into storage.buckets (id, name, public) values ('ad-images', 'ad-images', true)
on conflict (id) do nothing;
drop policy if exists "Public reads ad images" on storage.objects;
create policy "Public reads ad images" on storage.objects for select to anon, authenticated
using (bucket_id = 'ad-images');
drop policy if exists "Admins/editors upload ad images" on storage.objects;
create policy "Admins/editors upload ad images" on storage.objects for insert to authenticated
with check (bucket_id = 'ad-images' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor')));
drop policy if exists "Admins/editors update ad images" on storage.objects;
create policy "Admins/editors update ad images" on storage.objects for update to authenticated
using (bucket_id = 'ad-images' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor')));
drop policy if exists "Admins/editors delete ad images" on storage.objects;
create policy "Admins/editors delete ad images" on storage.objects for delete to authenticated
using (bucket_id = 'ad-images' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor')));
