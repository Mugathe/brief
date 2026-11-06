-- 0003: story archive (history), trending analysis, and followable news trails.

-- ---------- Archive of every headline we have seen ----------
create table if not exists public.news_archive (
  id bigint generated always as identity primary key,
  link text not null unique check (char_length(link) <= 1000),
  title text not null check (char_length(title) between 3 and 400),
  summary text not null default '' check (char_length(summary) <= 600),
  source text not null default '',
  platform text not null default '',
  category text not null default 'General',
  published_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  tsv_en tsvector generated always as (to_tsvector('english'::regconfig, coalesce(title,'') || ' ' || coalesce(summary,''))) stored,
  tsv_title tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(title,''))) stored
);
create index if not exists news_archive_published_idx on public.news_archive (published_at desc);
create index if not exists news_archive_tsv_en_idx on public.news_archive using gin (tsv_en);
create index if not exists news_archive_tsv_title_idx on public.news_archive using gin (tsv_title);
grant select on public.news_archive to anon, authenticated;
grant all on public.news_archive to service_role;
alter table public.news_archive enable row level security;
drop policy if exists "Public reads archive" on public.news_archive;
create policy "Public reads archive" on public.news_archive for select to anon, authenticated using (true);
-- No insert/update/delete policies: only the server (service role) writes history.

-- ---------- Words ignored when finding trends ----------
create table if not exists public.trend_stopwords (
  word text primary key check (word = lower(word) and char_length(word) between 2 and 40)
);
grant select on public.trend_stopwords to anon, authenticated;
grant insert, delete on public.trend_stopwords to authenticated;
grant all on public.trend_stopwords to service_role;
alter table public.trend_stopwords enable row level security;
drop policy if exists "Public reads stopwords" on public.trend_stopwords;
create policy "Public reads stopwords" on public.trend_stopwords for select to anon, authenticated using (true);
drop policy if exists "Staff manage stopwords" on public.trend_stopwords;
create policy "Staff manage stopwords" on public.trend_stopwords for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'moderator'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'moderator'));

insert into public.trend_stopwords(word)
select unnest(string_to_array(
 'the and for are but not you all any can had her was one our out has have his how its may new now old see two way who did get let put say she too use that this with from they will would there their what about which when your said says after over into than then them these those been being were more most some such only also just very much many other could should where while until under again off because before between both each even ever here how like make made need next first last back down still take told tell year years day days week weeks month months time today yesterday tomorrow people person man men woman women say says said saying news live latest update updates breaking watch video photos photo read full story stories report reports reportedly according amid says calls call urges wants want plans plan set sets gets goes going gone come comes came look looks looked show shows showed see seen found find finds why what who whom whose kenya kenyan kenyans nairobi county counties government govt national nation africa african east city town via per vs',
 ' ')) on conflict do nothing;

-- ---------- Trending analysis ----------
-- Words that appear in more headlines now than before, with how many outlets carry them.
create or replace function public.trending_terms(_days int, _limit int default 150)
returns table(term text, stories int, sources int, prev_stories int)
language sql stable set search_path = public as $$
  with cur as (
    select a.id, a.source, a.tsv_title from public.news_archive a
    where a.published_at >= now() - make_interval(days => _days) and a.published_at <= now()
  ), prev as (
    select a.id, a.tsv_title from public.news_archive a
    where a.published_at >= now() - make_interval(days => _days * 2) and a.published_at < now() - make_interval(days => _days)
  ), c as (
    select u.lexeme::text as term, count(distinct cur.id)::int as stories, count(distinct cur.source)::int as sources
    from cur, unnest(cur.tsv_title) as u(lexeme, positions, weights)
    where char_length(u.lexeme) >= 3 and u.lexeme !~ '[0-9]'
      and not exists (select 1 from public.trend_stopwords s where s.word = u.lexeme)
    group by u.lexeme
    having count(distinct cur.id) >= 2
  ), p as (
    select u.lexeme::text as term, count(distinct prev.id)::int as stories
    from prev, unnest(prev.tsv_title) as u(lexeme, positions, weights)
    group by u.lexeme
  )
  select c.term, c.stories, c.sources, coalesce(p.stories, 0)::int
  from c left join p on p.term = c.term
  order by c.stories desc, c.sources desc, c.term
  limit _limit
$$;

-- Daily/weekly/monthly counts for a few words, for sparklines.
create or replace function public.term_series(_terms text[], _days int)
returns table(term text, bucket date, stories int)
language sql stable set search_path = public as $$
  select u.lexeme::text,
    (case when _days <= 31 then date_trunc('day', a.published_at)
          when _days <= 120 then date_trunc('week', a.published_at)
          else date_trunc('month', a.published_at) end)::date,
    count(distinct a.id)::int
  from public.news_archive a, unnest(a.tsv_title) as u(lexeme, positions, weights)
  where a.published_at >= now() - make_interval(days => _days) and a.published_at <= now() and u.lexeme = any(_terms)
  group by 1, 2
  order by 1, 2
$$;

-- ---------- Trails: a topic followed through time ----------
create table if not exists public.trails (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60 and slug <> 'search'),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1500),
  query text not null check (char_length(query) between 2 and 200),
  since date,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.trail_events (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null references public.trails(id) on delete cascade,
  event_date date not null,
  title text not null check (char_length(title) between 3 and 200),
  summary text not null default '' check (char_length(summary) <= 800),
  url text check (url is null or url ~* '^https?://'),
  publisher text not null default '' check (char_length(publisher) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists trail_events_trail_idx on public.trail_events (trail_id, event_date);
grant select on public.trails, public.trail_events to anon, authenticated;
grant insert, update, delete on public.trails, public.trail_events to authenticated;
grant all on public.trails, public.trail_events to service_role;
alter table public.trails enable row level security;
alter table public.trail_events enable row level security;

drop policy if exists "Read published trails" on public.trails;
create policy "Read published trails" on public.trails for select to anon, authenticated using (published or public.is_staff(auth.uid()));
drop policy if exists "Editors manage trails" on public.trails;
create policy "Editors manage trails" on public.trails for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

drop policy if exists "Read events of published trails" on public.trail_events;
create policy "Read events of published trails" on public.trail_events for select to anon, authenticated
using (exists (select 1 from public.trails t where t.id = trail_id and (t.published or public.is_staff(auth.uid()))));
drop policy if exists "Editors manage trail events" on public.trail_events;
create policy "Editors manage trail events" on public.trail_events for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

drop trigger if exists trails_touch on public.trails;
create trigger trails_touch before update on public.trails for each row execute function public.touch_updated_at();

-- Stories per month that match a trail's search.
create or replace function public.trail_volume(_query text, _since date)
returns table(month date, stories int, sources int)
language sql stable set search_path = public as $$
  select date_trunc('month', a.published_at)::date, count(*)::int, count(distinct a.source)::int
  from public.news_archive a
  where a.tsv_en @@ websearch_to_tsquery('english'::regconfig, _query) and (_since is null or a.published_at >= _since)
  group by 1 order by 1
$$;

-- The best-matching few stories of each month, newest first.
create or replace function public.trail_stories(_query text, _since date, _per_month int default 3, _max int default 150)
returns table(id bigint, title text, source text, link text, published_at timestamptz)
language sql stable set search_path = public as $$
  select t.id, t.title, t.source, t.link, t.published_at from (
    select a.id, a.title, a.source, a.link, a.published_at,
      row_number() over (partition by date_trunc('month', a.published_at)
        order by ts_rank(a.tsv_en, websearch_to_tsquery('english'::regconfig, _query)) desc, a.published_at desc) as rn
    from public.news_archive a
    where a.tsv_en @@ websearch_to_tsquery('english'::regconfig, _query) and (_since is null or a.published_at >= _since)
  ) t
  where t.rn <= _per_month
  order by t.published_at desc
  limit _max
$$;

-- Words that keep showing up beside the topic, to help refine or branch a trail.
create or replace function public.trail_related(_query text, _since date, _limit int default 12)
returns table(term text, stories int)
language sql stable set search_path = public as $$
  select u.lexeme::text, count(distinct a.id)::int
  from public.news_archive a, unnest(a.tsv_title) as u(lexeme, positions, weights)
  where a.tsv_en @@ websearch_to_tsquery('english'::regconfig, _query) and (_since is null or a.published_at >= _since)
    and char_length(u.lexeme) >= 4 and u.lexeme !~ '[0-9]'
    and not exists (select 1 from public.trend_stopwords s where s.word = u.lexeme)
    and not (u.lexeme = any(tsvector_to_array(to_tsvector('simple'::regconfig, _query))))
  group by u.lexeme
  having count(distinct a.id) >= 2
  order by 2 desc, 1
  limit _limit
$$;

-- How many matching stories appeared after a moment (for "new since you last looked").
create or replace function public.trail_count_since(_query text, _ts timestamptz)
returns int language sql stable set search_path = public as $$
  select count(*)::int from public.news_archive a
  where a.published_at > _ts and a.published_at <= now() and a.tsv_en @@ websearch_to_tsquery('english'::regconfig, _query)
$$;

grant execute on function public.trending_terms(int, int), public.term_series(text[], int),
  public.trail_volume(text, date), public.trail_stories(text, date, int, int),
  public.trail_related(text, date, int), public.trail_count_since(text, timestamptz) to anon, authenticated;

-- A starter trail; the editors' milestones are added in the admin page.
insert into public.trails(slug, title, description, query, published)
values ('floods-and-el-nino', 'Floods and El Niño',
        'How floods, heavy rains and El Niño have been reported by Kenyan outlets, from the first warnings to the aftermath.',
        'flood OR floods OR flooding OR "el nino" OR "el niño"', true)
on conflict (slug) do nothing;
