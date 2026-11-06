-- 0011: regions. Staff can be limited to the editions (countries) they look after, and ads can target editions.
--   staff_regions  which editions a staff member manages. The edition '*' means all of them (and global settings).
--   Admins always manage everything. Editors and moderators manage only what their rows allow, and nothing without a row.

-- Created, and seeded with the current staff, only the first time this runs. Running the script again never undoes an admin's changes.
do $$
begin
  if to_regclass('public.staff_regions') is null then
    create table public.staff_regions (
      user_id uuid not null references auth.users(id) on delete cascade,
      edition text not null check (edition = '*' or edition ~ '^[A-Za-z]{2}$' or edition = 'world'),
      primary key (user_id, edition)
    );
    -- Everyone who was an editor or moderator before regions existed keeps working on everything until an admin narrows them.
    insert into public.staff_regions(user_id, edition)
    select distinct r.user_id, '*' from public.user_roles r
    where r.role::text in ('editor', 'moderator') and exists (select 1 from auth.users u where u.id = r.user_id);
  end if;
end $$;
grant select on public.staff_regions to authenticated;
grant all on public.staff_regions to service_role;
alter table public.staff_regions enable row level security;
drop policy if exists "Staff read own regions" on public.staff_regions;
create policy "Staff read own regions" on public.staff_regions for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Can this person manage something that belongs to these editions? An empty list means "global" (not tied to one edition).
-- _roles are the roles allowed to do this kind of work; admins always pass.
create or replace function public.can_manage(_user uuid, _editions text[], _roles text[] default array['admin','editor'])
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user, 'admin')
    or (
      exists (select 1 from public.user_roles r where r.user_id = _user and r.role::text = any(_roles))
      and (
        exists (select 1 from public.staff_regions s where s.user_id = _user and s.edition = '*')
        or (
          coalesce(cardinality(_editions), 0) > 0
          and not exists (
            select 1 from unnest(_editions) e
            where not exists (select 1 from public.staff_regions s where s.user_id = _user and s.edition = e)
          )
        )
      )
    )
$$;
grant execute on function public.can_manage(uuid, text[], text[]) to authenticated;

-- Ads can be shown in some editions only. An empty list means everywhere.
alter table public.ads add column if not exists editions text[] not null default '{}';
drop policy if exists "Admins/editors manage ads" on public.ads;
drop policy if exists "Staff manage ads" on public.ads;
create policy "Staff manage ads" on public.ads for all to authenticated
using (public.can_manage(auth.uid(), editions))
with check (public.can_manage(auth.uid(), editions));

-- Settings: global keys need a global editor (or admin). Content rules and the banner can also be set for one edition,
-- stored under keys like 'content@NG' and 'banner@NG', by whoever manages that edition.
create or replace function public.can_write_setting(_user uuid, _key text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when position('@' in _key) > 0 then
      split_part(_key, '@', 1) in ('content', 'banner')
      and split_part(_key, '@', 2) <> ''
      and public.can_manage(_user, array[split_part(_key, '@', 2)],
            case when split_part(_key, '@', 1) = 'content' then array['admin','editor','moderator'] else array['admin','editor'] end)
    else
      public.can_manage(_user, '{}'::text[], case when _key = 'content' then array['admin','editor','moderator'] else array['admin','editor'] end)
  end
$$;
grant execute on function public.can_write_setting(uuid, text) to authenticated;
drop policy if exists "Admins/editors write settings" on public.site_settings;
drop policy if exists "Moderators write content rules" on public.site_settings;
drop policy if exists "Staff write settings" on public.site_settings;
create policy "Staff write settings" on public.site_settings for all to authenticated
using (public.can_write_setting(auth.uid(), key))
with check (public.can_write_setting(auth.uid(), key));

-- The editors' social board can be for one edition ('*' = every edition).
alter table public.social_trends add column if not exists edition text not null default '*';
drop policy if exists "Editors manage social trends" on public.social_trends;
create policy "Editors manage social trends" on public.social_trends for all to authenticated
using (public.can_manage(auth.uid(), case when edition = '*' then '{}'::text[] else array[edition] end))
with check (public.can_manage(auth.uid(), case when edition = '*' then '{}'::text[] else array[edition] end));

-- Admin tools to see and set who manages which edition (two-factor verified, like the other team tools).
create or replace function public.list_staff_regions()
returns table(user_id uuid, edition text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  return query select s.user_id, s.edition from public.staff_regions s order by s.user_id, s.edition;
end $$;
revoke all on function public.list_staff_regions() from public, anon;
grant execute on function public.list_staff_regions() to authenticated;

create or replace function public.set_staff_regions(_user uuid, _editions text[])
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare e text;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if not public.is_aal2() then raise exception 'Two-factor verification required: verify your authenticator code and try again.'; end if;
  if not exists (select 1 from public.user_roles r where r.user_id = _user) then return false; end if;
  foreach e in array coalesce(_editions, '{}') loop
    if not (e = '*' or e = 'world' or e ~ '^[A-Za-z]{2}$') then raise exception 'Unknown edition: %', e; end if;
  end loop;
  delete from public.staff_regions where user_id = _user;
  insert into public.staff_regions(user_id, edition) select _user, x from unnest(coalesce(_editions, '{}')) as x on conflict do nothing;
  insert into public.security_events(severity, type, detail, actor)
    values ('notice', 'regions_set', _user::text || ' now manages: ' || coalesce(nullif(array_to_string(_editions, ', '), ''), 'nothing'), auth.uid());
  return true;
end $$;
revoke all on function public.set_staff_regions(uuid, text[]) from public, anon;
grant execute on function public.set_staff_regions(uuid, text[]) to authenticated;
