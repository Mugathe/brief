-- 0010: editions. Brief covers many countries, so every archived headline now says which edition ("world" or a
-- country code such as 'KE') it was found in, and trends and trending history can be asked about one edition.
-- Everything saved before this migration came from the Kenya feeds, so it is labelled 'KE'.

alter table public.news_archive add column if not exists edition text not null default 'KE';
alter table public.news_archive alter column edition set default 'world';
create index if not exists news_archive_edition_published_idx on public.news_archive (edition, published_at desc);

-- Words that appear in nearly every headline of one country ("Nigeria", "Lagos"), so they are ignored there
-- but can still trend in the world edition. Editors can add rows here in the Supabase table editor.
create table if not exists public.edition_stopwords (
  edition text not null check (char_length(edition) between 2 and 8),
  word text not null check (word = lower(word) and char_length(word) between 2 and 40),
  primary key (edition, word)
);
grant select on public.edition_stopwords to anon, authenticated;
grant insert, delete on public.edition_stopwords to authenticated;
grant all on public.edition_stopwords to service_role;
alter table public.edition_stopwords enable row level security;
drop policy if exists "Public reads edition stopwords" on public.edition_stopwords;
create policy "Public reads edition stopwords" on public.edition_stopwords for select to anon, authenticated using (true);
drop policy if exists "Staff manage edition stopwords" on public.edition_stopwords;
create policy "Staff manage edition stopwords" on public.edition_stopwords for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'moderator'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor') or public.has_role(auth.uid(),'moderator'));

insert into public.edition_stopwords(edition, word) values
  ('KE','kenya'),('KE','kenyan'),('KE','kenyans'),('KE','nairobi'),
  ('UG','uganda'),('UG','ugandan'),('UG','ugandans'),('UG','kampala'),
  ('TZ','tanzania'),('TZ','tanzanian'),('TZ','tanzanians'),('TZ','dodoma'),
  ('NG','nigeria'),('NG','nigerian'),('NG','nigerians'),('NG','lagos'),('NG','abuja'),
  ('GH','ghana'),('GH','ghanaian'),('GH','ghanaians'),('GH','accra'),
  ('ZA','south'),('ZA','african'),('ZA','africans'),('ZA','pretoria'),
  ('GB','britain'),('GB','british'),('GB','london'),('GB','england'),
  ('US','america'),('US','american'),('US','americans'),('US','united'),('US','states'),('US','washington'),
  ('IN','india'),('IN','indian'),('IN','indians'),('IN','delhi'),
  ('AU','australia'),('AU','australian'),('AU','australians'),('AU','sydney'),
  ('CA','canada'),('CA','canadian'),('CA','canadians'),('CA','ottawa'),('CA','toronto')
on conflict do nothing;
-- Kenya's own words used to be ignored everywhere. Now they are ignored only in the Kenya edition.
delete from public.trend_stopwords where word in ('kenya','kenyan','kenyans','nairobi');

-- ---------- Trending analysis, per edition ----------
-- _edition null means every edition together.
drop function if exists public.trending_terms(int, int);
create or replace function public.trending_terms(_days int, _limit int default 150, _edition text default null)
returns table(term text, stories int, sources int, prev_stories int)
language sql stable set search_path = public as $$
  with cur as (
    select a.id, a.source, a.tsv_title from public.news_archive a
    where a.published_at >= now() - make_interval(days => _days) and a.published_at <= now()
      and (_edition is null or a.edition = _edition)
  ), prev as (
    select a.id, a.tsv_title from public.news_archive a
    where a.published_at >= now() - make_interval(days => _days * 2) and a.published_at < now() - make_interval(days => _days)
      and (_edition is null or a.edition = _edition)
  ), c as (
    select u.lexeme::text as term, count(distinct cur.id)::int as stories, count(distinct cur.source)::int as sources
    from cur, unnest(cur.tsv_title) as u(lexeme, positions, weights)
    where char_length(u.lexeme) >= 3 and u.lexeme !~ '[0-9]'
      and not exists (select 1 from public.trend_stopwords s where s.word = u.lexeme)
      and not exists (select 1 from public.edition_stopwords e where e.edition = _edition and e.word = u.lexeme)
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

drop function if exists public.term_series(text[], int);
create or replace function public.term_series(_terms text[], _days int, _edition text default null)
returns table(term text, bucket date, stories int)
language sql stable set search_path = public as $$
  select u.lexeme::text,
    (case when _days <= 31 then date_trunc('day', a.published_at)
          when _days <= 120 then date_trunc('week', a.published_at)
          else date_trunc('month', a.published_at) end)::date,
    count(distinct a.id)::int
  from public.news_archive a, unnest(a.tsv_title) as u(lexeme, positions, weights)
  where a.published_at >= now() - make_interval(days => _days) and a.published_at <= now() and u.lexeme = any(_terms)
    and (_edition is null or a.edition = _edition)
  group by 1, 2
  order by 1, 2
$$;

-- ---------- What trended in each past day, week or month, per edition and in that edition's time zone ----------
drop function if exists public.trending_history(text, int, int, int);
create or replace function public.trending_history(_unit text, _periods int, _offset int default 0, _per int default 8, _edition text default null, _tz text default 'UTC')
returns table(period_start date, term text, stories int, sources int, rank int)
language sql stable set search_path = public as $$
  with p as (
    select
      case when _unit in ('day', 'week') then _unit else 'month' end as unit,
      case _unit when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end as step,
      greatest(1, least(coalesce(_periods, 7), 60)) as n,
      greatest(0, least(coalesce(_offset, 0), 1000)) as skip,
      greatest(1, least(coalesce(_per, 8), 20)) as per,
      coalesce(_tz, 'UTC') as tz,
      now() at time zone coalesce(_tz, 'UTC') as local_now
  ), b as (
    select unit, step, per, tz,
      date_trunc(unit, local_now) - skip * step as newest,
      date_trunc(unit, local_now) - (skip + n - 1) * step as oldest
    from p
  ), periods as (
    select gs::date as start from b, generate_series(b.oldest, b.newest, b.step) as gs
  ), in_range as (
    select a.id, a.source, a.tsv_title,
      date_trunc(b.unit, a.published_at at time zone b.tz)::date as start
    from b join public.news_archive a
      on a.published_at >= (b.oldest at time zone b.tz)
     and a.published_at < (b.newest + b.step) at time zone b.tz
     and a.published_at <= now()
     and (_edition is null or a.edition = _edition)
  ), t as (
    select r.start, u.lexeme::text as term,
      count(distinct r.id)::int as stories, count(distinct r.source)::int as sources
    from in_range r, unnest(r.tsv_title) as u(lexeme, positions, weights)
    where char_length(u.lexeme) >= 3 and u.lexeme !~ '[0-9]'
      and not exists (select 1 from public.trend_stopwords s where s.word = u.lexeme)
      and not exists (select 1 from public.edition_stopwords e where e.edition = _edition and e.word = u.lexeme)
    group by r.start, u.lexeme
    having count(distinct r.id) >= 2
  ), ranked as (
    select t.*, (row_number() over (partition by t.start order by t.stories desc, t.sources desc, t.term))::int as rank
    from t
  )
  select periods.start, ranked.term, ranked.stories, ranked.sources, ranked.rank
  from periods
  left join ranked on ranked.start = periods.start and ranked.rank <= (select per from b)
  order by periods.start desc, ranked.rank
$$;

grant execute on function public.trending_terms(int, int, text), public.term_series(text[], int, text),
  public.trending_history(text, int, int, int, text, text) to anon, authenticated;
