create type public.app_role as enum ('admin','editor','moderator');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id) $$;

create policy "Users see own roles, admins see all" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- First account to sign up becomes admin
create or replace function public.bootstrap_first_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_bootstrap after insert on auth.users
for each row execute function public.bootstrap_first_admin();

-- Analytics
create table public.page_views (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  session_id text not null,
  path text not null,
  referrer text,
  country text,
  device text,
  created_at timestamptz not null default now()
);
create index on public.page_views (created_at desc);
create index on public.page_views (visitor_id);
grant select on public.page_views to authenticated;
grant all on public.page_views to service_role;
alter table public.page_views enable row level security;
create policy "Staff read views" on public.page_views for select to authenticated using (public.is_staff(auth.uid()));

create table public.site_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  type text not null,
  target text,
  path text,
  created_at timestamptz not null default now()
);
create index on public.site_events (created_at desc);
create index on public.site_events (type);
grant select on public.site_events to authenticated;
grant all on public.site_events to service_role;
alter table public.site_events enable row level security;
create policy "Staff read events" on public.site_events for select to authenticated using (public.is_staff(auth.uid()));

-- Ads
create table public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'banner',
  image_url text,
  link_url text,
  adsense_slot text,
  placement text not null default 'home_top',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  priority int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.ads to anon, authenticated;
grant insert, update, delete on public.ads to authenticated;
grant all on public.ads to service_role;
alter table public.ads enable row level security;
create policy "Public sees active ads" on public.ads for select to anon, authenticated
using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy "Staff see all ads" on public.ads for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admins/editors manage ads" on public.ads for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));

-- Site settings (theme, adsense id, content filters)
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "Public read settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins/editors write settings" on public.site_settings for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
insert into public.site_settings(key,value) values
 ('theme','{"name":"default"}'),
 ('adsense','{"client":""}'),
 ('content','{"hiddenLinks":[],"blockedSources":[],"blockedWords":[],"pinnedLinks":[]}');

-- Moderated manifesto entries for every office
create table public.aspirant_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  office text not null default 'Governor',
  region text,
  affiliation text,
  status text not null default 'Prospective',
  overview text not null default '',
  priorities text[] not null default '{}',
  gaps text[] not null default '{}',
  sources jsonb not null default '[]',
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select on public.aspirant_entries to anon, authenticated;
grant insert, update, delete on public.aspirant_entries to authenticated;
grant all on public.aspirant_entries to service_role;
alter table public.aspirant_entries enable row level security;
create policy "Public read published" on public.aspirant_entries for select to anon, authenticated using (published);
create policy "Staff read all" on public.aspirant_entries for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff manage entries" on public.aspirant_entries for all to authenticated
using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Security / audit log
create table public.security_events (
  id bigint generated always as identity primary key,
  severity text not null default 'info',
  type text not null,
  detail text,
  actor uuid,
  created_at timestamptz not null default now()
);
create index on public.security_events (created_at desc);
grant select on public.security_events to authenticated;
grant all on public.security_events to service_role;
alter table public.security_events enable row level security;
create policy "Admins read security" on public.security_events for select to authenticated using (public.has_role(auth.uid(),'admin'));