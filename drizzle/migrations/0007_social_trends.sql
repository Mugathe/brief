-- 0007: a board of what is trending on social platforms, curated by editors
-- (TikTok, Instagram and others have no public trending feed for Kenya, so people note what they see).
create table if not exists public.social_trends (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('x','tiktok','instagram','facebook','youtube','whatsapp','telegram','other')),
  topic text not null check (char_length(topic) between 2 and 80),
  note text not null default '' check (char_length(note) <= 240),
  url text check (url is null or (url ~* '^https?://' and char_length(url) <= 1000)),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days'),
  created_by uuid
);
create index if not exists social_trends_live_idx on public.social_trends (expires_at desc, created_at desc);
grant select on public.social_trends to anon, authenticated;
grant insert, update, delete on public.social_trends to authenticated;
grant all on public.social_trends to service_role;
alter table public.social_trends enable row level security;

drop policy if exists "Read live social trends" on public.social_trends;
create policy "Read live social trends" on public.social_trends for select to anon, authenticated
using (expires_at > now() or public.is_staff(auth.uid()));
drop policy if exists "Editors manage social trends" on public.social_trends;
create policy "Editors manage social trends" on public.social_trends for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
