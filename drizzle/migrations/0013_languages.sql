-- 0013: other languages. Editions can now be a country in a second language (for example 'KE-sw'), and the
-- language editions need to ignore their own everyday words ("le", "de", "na", "que") when finding what trends.

-- Edition codes may carry a language: 'KE-sw'.
alter table public.staff_regions drop constraint if exists staff_regions_edition_check;
alter table public.staff_regions add constraint staff_regions_edition_check
  check (edition = '*' or edition = 'world' or edition ~ '^[A-Za-z]{2}(-[A-Za-z]{2})?$');

create or replace function public.set_staff_regions(_user uuid, _editions text[])
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare e text;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if not public.is_aal2() then raise exception 'Two-factor verification required: verify your authenticator code and try again.'; end if;
  if not exists (select 1 from public.user_roles r where r.user_id = _user) then return false; end if;
  foreach e in array coalesce(_editions, '{}') loop
    if not (e = '*' or e = 'world' or e ~ '^[A-Za-z]{2}(-[A-Za-z]{2})?$') then raise exception 'Unknown edition: %', e; end if;
  end loop;
  delete from public.staff_regions where user_id = _user;
  insert into public.staff_regions(user_id, edition) select _user, x from unnest(coalesce(_editions, '{}')) as x on conflict do nothing;
  insert into public.security_events(severity, type, detail, actor)
    values ('notice', 'regions_set', _user::text || ' now manages: ' || coalesce(nullif(array_to_string(_editions, ', '), ''), 'nothing'), auth.uid());
  return true;
end $$;
revoke all on function public.set_staff_regions(uuid, text[]) from public, anon;
grant execute on function public.set_staff_regions(uuid, text[]) to authenticated;

-- Each country's own name (and its capital) is in nearly every headline there, so it is ignored in that edition.
insert into public.edition_stopwords(edition, word) values
  ('FR','france'),('FR','français'),('FR','française'),('FR','paris'),
  ('ES','españa'),('ES','español'),('ES','española'),('ES','madrid'),
  ('MX','méxico'),('MX','mexicano'),('MX','mexicana'),('MX','mexicanos'),
  ('BR','brasil'),('BR','brasileiro'),('BR','brasileira'),('BR','brasileiros'),('BR','brasília'),
  ('SN','sénégal'),('SN','sénégalais'),('SN','dakar'),
  ('CI','ivoire'),('CI','ivoirien'),('CI','ivoirienne'),('CI','abidjan'),
  ('KE-sw','kenya'),('KE-sw','nairobi'),('KE-sw','wakenya'),('KE-sw','mkenya'),
  ('TZ-sw','tanzania'),('TZ-sw','dodoma'),('TZ-sw','watanzania'),('TZ-sw','salaam')
on conflict do nothing;

-- Everyday words of each language, for the editions written in it.
insert into public.edition_stopwords(edition, word)
select e, w from (values
  ('fr', array['les','des','une','aux','pour','par','dans','avec','sans','sont','été','être','ont','cette','ces','son','ses','leur','leurs','plus','mais','dont','comme','aussi','après','avant','selon','entre','depuis','contre','encore','alors','tout','tous','toute','toutes','fait','déjà','très','peut','pas','sous','chez','vers','lors','puis','donc','ainsi','cela','celui','elle','elles','ils','nous','vous','qui','que','quoi','sur','est','mon','ton','notre','votre','lui','même','sera','peu','sans','où']),
  ('es', array['los','las','del','para','por','con','sin','una','uno','unos','unas','que','como','más','pero','sus','este','esta','estos','estas','ese','esa','también','después','antes','sobre','entre','desde','hasta','cuando','donde','porque','muy','fue','ser','son','han','sido','será','tras','según','todo','todos','toda','todas','hay','año','años','día','días','nuevo','nueva','tiene','tienen','está','están','puede','sino','aunque','ante','bajo','cada','otro','otra','otros','otras','así','pues','ahora']),
  ('pt', array['uma','uns','umas','para','por','com','sem','que','como','mais','mas','seus','suas','este','esta','estes','estas','esse','essa','também','depois','antes','sobre','entre','desde','até','quando','onde','porque','muito','foi','ser','são','tem','têm','será','após','segundo','todo','todos','toda','todas','há','ano','anos','dia','dias','novo','nova','pelo','pela','pelos','pelas','dos','das','nos','nas','está','estão','pode','apenas','ainda','nesta','neste','sobre','cada','outro','outra','outros','outras','assim','agora']),
  ('sw', array['kwa','ya','wa','za','la','katika','kuwa','hii','huo','hizo','ambao','ambayo','ambaye','kuhusu','baada','kabla','pamoja','wakati','lakini','pia','sana','hivyo','wake','wao','yake','yao','yetu','wetu','hapo','huko','kila','moja','mbili','tatu','mwaka','miaka','leo','jana','kesho','sasa','bado','tena','hata','kama','kwamba','alisema','walisema','amesema','huu','hiyo','hizi','hawa','yule','ndani','nje','juu','chini','sababu','watu','mtu','kutoka','hadi','kati','vya','cha','ili','ndio','siku','zaidi','ndiyo','wakati'])
) as l(lang, words)
cross join lateral unnest(l.words) as w
join (values ('fr','FR'),('fr','SN'),('fr','CI'),('es','ES'),('es','MX'),('pt','BR'),('sw','KE-sw'),('sw','TZ-sw')) as m(lang, e) on m.lang = l.lang
on conflict do nothing;
