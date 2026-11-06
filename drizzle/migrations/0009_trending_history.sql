-- 0009: what trended in each past day, week or month (Kenya time), for the Trails page.
-- Returns the top words per period. Periods with nothing notable come back once with a null term,
-- so the page can still show them ("Nothing stood out") instead of silently skipping them.
--   _unit     'day', 'week' (Monday to Sunday) or 'month'
--   _periods  how many periods to return (1 to 60)
--   _offset   how many periods to skip back from the current one (0 = start with the current period)
--   _per      how many words to keep for each period (1 to 20)
create or replace function public.trending_history(_unit text, _periods int, _offset int default 0, _per int default 8)
returns table(period_start date, term text, stories int, sources int, rank int)
language sql stable set search_path = public as $$
  with p as (
    select
      case when _unit in ('day', 'week') then _unit else 'month' end as unit,
      case _unit when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end as step,
      greatest(1, least(coalesce(_periods, 7), 60)) as n,
      greatest(0, least(coalesce(_offset, 0), 1000)) as skip,
      greatest(1, least(coalesce(_per, 8), 20)) as per,
      now() at time zone 'Africa/Nairobi' as local_now
  ), b as (
    select unit, step, per,
      date_trunc(unit, local_now) - skip * step as newest,
      date_trunc(unit, local_now) - (skip + n - 1) * step as oldest
    from p
  ), periods as (
    select gs::date as start from b, generate_series(b.oldest, b.newest, b.step) as gs
  ), in_range as (
    select a.id, a.source, a.tsv_title,
      date_trunc(b.unit, a.published_at at time zone 'Africa/Nairobi')::date as start
    from b join public.news_archive a
      on a.published_at >= (b.oldest at time zone 'Africa/Nairobi')
     and a.published_at < (b.newest + b.step) at time zone 'Africa/Nairobi'
     and a.published_at <= now()
  ), t as (
    select r.start, u.lexeme::text as term,
      count(distinct r.id)::int as stories, count(distinct r.source)::int as sources
    from in_range r, unnest(r.tsv_title) as u(lexeme, positions, weights)
    where char_length(u.lexeme) >= 3 and u.lexeme !~ '[0-9]'
      and not exists (select 1 from public.trend_stopwords s where s.word = u.lexeme)
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

grant execute on function public.trending_history(text, int, int, int) to anon, authenticated;
