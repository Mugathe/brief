-- 0012: trail stories carry what the story cards need (summary, category, outlet type, edition), so a trail
-- can show each story the way the home page does.
drop function if exists public.trail_stories(text, date, int, int);
create or replace function public.trail_stories(_query text, _since date, _per_month int default 3, _max int default 150)
returns table(id bigint, title text, source text, link text, published_at timestamptz, summary text, category text, platform text, edition text)
language sql stable set search_path = public as $$
  select t.id, t.title, t.source, t.link, t.published_at, t.summary, t.category, t.platform, t.edition from (
    select a.id, a.title, a.source, a.link, a.published_at, a.summary, a.category, a.platform, a.edition,
      row_number() over (partition by date_trunc('month', a.published_at)
        order by ts_rank(a.tsv_en, websearch_to_tsquery('english'::regconfig, _query)) desc, a.published_at desc) as rn
    from public.news_archive a
    where a.tsv_en @@ websearch_to_tsquery('english'::regconfig, _query) and (_since is null or a.published_at >= _since)
  ) t
  where t.rn <= _per_month
  order by t.published_at desc
  limit _max
$$;
grant execute on function public.trail_stories(text, date, int, int) to anon, authenticated;
