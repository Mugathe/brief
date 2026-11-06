-- 0014: Arabic and Hindi. Their editions ignore their own everyday words and country names when finding what trends,
-- and a "topic" is never a number in any script (Arabic-Indic and Devanagari digits were slipping through).

-- Each country's own name (and its capital) is in nearly every headline there.
insert into public.edition_stopwords(edition, word) values
  ('EG','مصر'),('EG','مصري'),('EG','مصرية'),('EG','المصرية'),('EG','المصري'),('EG','القاهرة'),
  ('SA','السعودية'),('SA','سعودي'),('SA','سعودية'),('SA','السعودي'),('SA','الرياض'),('SA','المملكة'),
  ('IN-hi','भारत'),('IN-hi','भारतीय'),('IN-hi','दिल्ली')
on conflict do nothing;

-- Everyday words of each language, for the editions written in it.
insert into public.edition_stopwords(edition, word)
select m.e, w
from (values ('ar', array['أقل','أكثر','أمس','أن','أو','أي','أيضا','أيضاً','إلى','إن','التي','الذي','الذين','العام','اليوم','بعد','بعض','به','بها','بين','تلك','ثم','حتى','خلال','ذلك','عام','على','عليه','عليها','عن','عند','غدا','غير','في','فيه','فيها','قال','قالت','قبل','قد','كان','كانت','كل','كما','لا','لدى','لكن','لم','لن','له','لها','لهم','ما','مصدر','مع','من','منذ','منه','منها','نحو','هذا','هذه','هل','هم','هنا','هناك','هو','هي','وأضاف','وأعلن','وأكد','وإلى','وعلى','وعن','وفي','وقال','وقد','ومع','ومن','يكون']), ('hi', array['अगर','अपने','अब','आज','इस','उन','उस','एक','और','कर','करना','करने','कल','कहा','कहां','का','कि','किया','की','कुछ','के','कैसे','को','क्या','गई','गए','गया','चार','जब','जा','जो','ज्यादा','तक','तब','तरह','तीन','तो','था','थी','थे','दिन','दिया','दी','दे','दो','द्वारा','नए','नया','नहीं','ने','पर','पहले','पूरा','पूरी','फिर','बताया','बहुत','बाद','बीच','भी','मामला','मामले','में','यह','यहां','या','रहा','रही','रहे','लिए','लिया','ली','लेकिन','वर्ष','वह','वहां','वाली','वाले','वालों','सकता','सकती','सकते','सबसे','सभी','साथ','साल','से','हुआ','हुई','हुए','है','हैं','हो','होगा','होने'])) as l(lang, words)
cross join lateral unnest(l.words) as w
join (values ('ar','EG'),('ar','SA'),('hi','IN-hi')) as m(lang, e) on m.lang = l.lang
on conflict do nothing;

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
    where char_length(u.lexeme) >= 3 and u.lexeme !~ '[0-9٠-٩۰-۹०-९]'
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
    where char_length(u.lexeme) >= 3 and u.lexeme !~ '[0-9٠-٩۰-۹०-९]'
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
