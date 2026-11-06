-- 0005: AI-assisted trail research. The agent only writes through the server (service role);
-- readers see items that are not rejected, and editors approve or reject them.

create table if not exists public.trail_research (
  id uuid primary key default gen_random_uuid(),
  query_key text not null check (char_length(query_key) between 2 and 120),
  query text not null check (char_length(query) between 2 and 200),
  status text not null default 'running' check (status in ('running','done','failed')),
  origin text not null default 'visitor' check (origin in ('visitor','staff','scheduled')),
  items_found int not null default 0,
  searches int not null default 0,
  input_tokens int,
  output_tokens int,
  error text check (error is null or char_length(error) <= 400),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists trail_research_key_idx on public.trail_research (query_key, created_at desc);
create index if not exists trail_research_day_idx on public.trail_research (created_at desc);
-- Only one run per topic at a time.
create unique index if not exists trail_research_one_running_idx on public.trail_research (query_key) where status = 'running';

create table if not exists public.ai_trail_items (
  id uuid primary key default gen_random_uuid(),
  research_id uuid references public.trail_research(id) on delete cascade,
  query_key text not null,
  event_date date not null,
  date_precision text not null default 'day' check (date_precision in ('day','month','year')),
  title text not null check (char_length(title) between 3 and 200),
  summary text not null default '' check (char_length(summary) <= 500),
  url text not null check (url ~* '^https?://' and char_length(url) <= 1000),
  publisher text not null default '' check (char_length(publisher) <= 120),
  status text not null default 'unreviewed' check (status in ('unreviewed','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (query_key, url)
);
create index if not exists ai_trail_items_key_idx on public.ai_trail_items (query_key, event_date);

grant select on public.ai_trail_items to anon, authenticated;
grant update, delete on public.ai_trail_items to authenticated;
grant all on public.ai_trail_items to service_role;
grant select on public.trail_research to authenticated;
grant delete on public.trail_research to authenticated;
grant all on public.trail_research to service_role;
alter table public.ai_trail_items enable row level security;
alter table public.trail_research enable row level security;

drop policy if exists "Public reads non-rejected AI items" on public.ai_trail_items;
create policy "Public reads non-rejected AI items" on public.ai_trail_items for select to anon, authenticated
using (status in ('unreviewed','approved') or public.is_staff(auth.uid()));
drop policy if exists "Editors review AI items" on public.ai_trail_items;
create policy "Editors review AI items" on public.ai_trail_items for update to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
drop policy if exists "Editors delete AI items" on public.ai_trail_items;
create policy "Editors delete AI items" on public.ai_trail_items for delete to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

drop policy if exists "Staff read research runs" on public.trail_research;
create policy "Staff read research runs" on public.trail_research for select to authenticated using (public.is_staff(auth.uid()));
drop policy if exists "Editors delete research runs" on public.trail_research;
create policy "Editors delete research runs" on public.trail_research for delete to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- Switches editors control from the admin page (public-readable, so no secrets here).
insert into public.site_settings(key, value) values ('ai_trails', '{"enabled":true,"showUnreviewed":true}')
on conflict (key) do nothing;
