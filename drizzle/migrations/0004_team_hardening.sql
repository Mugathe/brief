-- 0004: safer team management.
--  * Admin access can never be removed from the app (only by someone with direct database access).
--  * Every role change needs a session verified with two-factor authentication (aal2).

create or replace function public.is_aal2()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;
grant execute on function public.is_aal2() to authenticated;

create or replace function public.grant_role_by_email(_email text, _role public.app_role)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if not public.is_aal2() then raise exception 'Two-factor verification required: verify your authenticator code and try again.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if uid is null then return false; end if;
  insert into public.user_roles(user_id, role) values (uid, _role) on conflict (user_id, role) do nothing;
  insert into public.security_events(severity, type, detail, actor)
    values (case when _role = 'admin' then 'critical' else 'notice' end, 'role_granted', trim(_email) || ' given ' || _role::text, auth.uid());
  return true;
end $$;
revoke all on function public.grant_role_by_email(text, public.app_role) from public, anon;
grant execute on function public.grant_role_by_email(text, public.app_role) to authenticated;

create or replace function public.revoke_role(_user uuid, _role public.app_role)
returns boolean language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Admins only'; end if;
  if not public.is_aal2() then raise exception 'Two-factor verification required: verify your authenticator code and try again.'; end if;
  if _role = 'admin' then
    raise exception 'Admin access cannot be removed from the app. It can only be changed directly in the database.';
  end if;
  delete from public.user_roles where user_id = _user and role = _role;
  insert into public.security_events(severity, type, detail, actor)
    values ('notice', 'role_revoked', _role::text || ' removed from ' || _user::text, auth.uid());
  return true;
end $$;
revoke all on function public.revoke_role(uuid, public.app_role) from public, anon;
grant execute on function public.revoke_role(uuid, public.app_role) to authenticated;
