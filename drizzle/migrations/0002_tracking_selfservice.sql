-- 0002: tracking that works without the service-role key, audit log from staff sessions,
-- team management without the service-role key, and self-service manifesto submissions.

-- ---------- Anonymous tracking (visitors can only INSERT, never read) ----------
grant insert on public.page_views to anon, authenticated;
drop policy if exists "Anyone records views" on public.page_views;
create policy "Anyone records views" on public.page_views for insert to anon, authenticated
with check (
  char_length(path) between 1 and 300
  and char_length(visitor_id) between 8 and 64
  and char_length(session_id) between 8 and 64
  and (referrer is null or char_length(referrer) <= 300)
);

grant insert on public.site_events to anon, authenticated;
drop policy if exists "Anyone records events" on public.site_events;
create policy "Anyone records events" on public.site_events for insert to anon, authenticated
with check (
  type in ('whatsapp_share','quote_card','story_click','audio_play','ad_view','ad_click')
  and char_length(visitor_id) between 8 and 64
  and (target is null or char_length(target) <= 300)
  and (path is null or char_length(path) <= 300)
);

-- ---------- Security / audit log ----------
grant insert on public.security_events to anon, authenticated;
drop policy if exists "Anyone reports failed sign-in" on public.security_events;
create policy "Anyone reports failed sign-in" on public.security_events for insert to anon, authenticated
with check (type = 'failed_login' and severity = 'warning' and actor is null and (detail is null or char_length(detail) <= 250));
drop policy if exists "Staff write own audit events" on public.security_events;
create policy "Staff write own audit events" on public.security_events for insert to authenticated
with check (public.is_staff(auth.uid()) and actor = auth.uid() and severity in ('info','notice'));

-- ---------- Team management without the service-role key ----------
create or replace function public.list_team()
returns table(user_id uuid, email text, role public.app_role)
language sql stable security definer set search_path = public, auth as $$
  select r.user_id, u.email::text, r.role
  from public.user_roles r join auth.users u on u.id = r.user_id
  where public.has_role(auth.uid(), 'admin')
  order by u.email, r.role
$$;
revoke all on function public.list_team() from public, anon;
grant execute on function public.list_team() to authenticated;

create or replace function public.grant_role_by_email(_email text, _role public.app_role)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if uid is null then return false; end if;
  insert into public.user_roles(user_id, role) values (uid, _role) on conflict (user_id, role) do nothing;
  insert into public.security_events(severity, type, detail, actor)
    values ('notice', 'role_granted', trim(_email) || ' given ' || _role::text, auth.uid());
  return true;
end $$;
revoke all on function public.grant_role_by_email(text, public.app_role) from public, anon;
grant execute on function public.grant_role_by_email(text, public.app_role) to authenticated;

create or replace function public.revoke_role(_user uuid, _role public.app_role)
returns boolean language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if _user = auth.uid() and _role = 'admin' then return false; end if;
  delete from public.user_roles where user_id = _user and role = _role;
  insert into public.security_events(severity, type, detail, actor)
    values ('notice', 'role_revoked', _role::text || ' removed from ' || _user::text, auth.uid());
  return true;
end $$;
revoke all on function public.revoke_role(uuid, public.app_role) from public, anon;
grant execute on function public.revoke_role(uuid, public.app_role) to authenticated;

-- ---------- Profiles: candidate-supplied statement + where a profile came from ----------
alter table public.aspirant_entries
  add column if not exists candidate_statement jsonb not null default '{}',
  add column if not exists origin text not null default 'editorial';

-- ---------- Self-service submissions from aspirants and their teams ----------
create table if not exists public.aspirant_submissions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','needs_info','approved','rejected')),
  name text not null check (char_length(name) between 2 and 120),
  office text not null check (char_length(office) between 2 and 60),
  region text check (region is null or char_length(region) <= 80),
  affiliation text check (affiliation is null or char_length(affiliation) <= 120),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_role text check (contact_role is null or char_length(contact_role) <= 80),
  contact_email text not null check (char_length(contact_email) between 5 and 200 and contact_email like '%@%'),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  overview text not null check (char_length(overview) between 20 and 3000),
  priorities text[] not null default '{}',
  pledges text not null default '' check (char_length(pledges) <= 8000),
  costing text not null default '' check (char_length(costing) <= 4000),
  delivery text not null default '' check (char_length(delivery) <= 4000),
  track_record text not null default '' check (char_length(track_record) <= 4000),
  sources jsonb not null default '[]',
  review_notes text check (review_notes is null or char_length(review_notes) <= 1000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  entry_id uuid references public.aspirant_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists aspirant_submissions_status_idx on public.aspirant_submissions (status, created_at desc);
grant insert on public.aspirant_submissions to anon, authenticated;
grant select, update, delete on public.aspirant_submissions to authenticated;
grant all on public.aspirant_submissions to service_role;
alter table public.aspirant_submissions enable row level security;

drop policy if exists "Anyone submits a profile" on public.aspirant_submissions;
create policy "Anyone submits a profile" on public.aspirant_submissions for insert to anon, authenticated
with check (status = 'pending' and review_notes is null and reviewed_by is null and entry_id is null);
drop policy if exists "Staff read submissions" on public.aspirant_submissions;
create policy "Staff read submissions" on public.aspirant_submissions for select to authenticated using (public.is_staff(auth.uid()));
drop policy if exists "Staff review submissions" on public.aspirant_submissions;
create policy "Staff review submissions" on public.aspirant_submissions for update to authenticated
using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
drop policy if exists "Admins/editors delete submissions" on public.aspirant_submissions;
create policy "Admins/editors delete submissions" on public.aspirant_submissions for delete to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
