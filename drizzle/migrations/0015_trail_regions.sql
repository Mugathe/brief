-- 0015: curated trails belong to a region. A trail can be for one edition (a country) or for all of them (empty),
-- and staff manage the trails of the regions they look after, like ads and content rules.

-- Added, and the original Kenyan trail tagged, only the first time this runs, so running the script again never undoes an admin's change.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trails' and column_name = 'edition') then
    alter table public.trails add column edition text;
    update public.trails set edition = 'KE' where slug = 'floods-and-el-nino';
  end if;
end $$;

drop policy if exists "Editors manage trails" on public.trails;
drop policy if exists "Staff manage trails" on public.trails;
create policy "Staff manage trails" on public.trails for all to authenticated
using (public.can_manage(auth.uid(), case when edition is null then '{}'::text[] else array[edition] end))
with check (public.can_manage(auth.uid(), case when edition is null then '{}'::text[] else array[edition] end));

drop policy if exists "Editors manage trail events" on public.trail_events;
drop policy if exists "Staff manage trail events" on public.trail_events;
create policy "Staff manage trail events" on public.trail_events for all to authenticated
using (exists (select 1 from public.trails t where t.id = trail_id and public.can_manage(auth.uid(), case when t.edition is null then '{}'::text[] else array[t.edition] end)))
with check (exists (select 1 from public.trails t where t.id = trail_id and public.can_manage(auth.uid(), case when t.edition is null then '{}'::text[] else array[t.edition] end)));
