-- 0008: the team's pronunciation dictionary for the news bulletin voice.
-- "word" is how it is written; "spoken" is how it should be said (a respelling the voice reads naturally).
create table if not exists public.pronunciations (
  word text primary key check (char_length(word) between 2 and 60 and word = btrim(word)),
  spoken text not null check (char_length(spoken) between 1 and 120),
  note text not null default '' check (char_length(note) <= 160),
  created_at timestamptz not null default now()
);
grant select on public.pronunciations to anon, authenticated;
grant insert, update, delete on public.pronunciations to authenticated;
grant all on public.pronunciations to service_role;
alter table public.pronunciations enable row level security;
drop policy if exists "Public reads pronunciations" on public.pronunciations;
create policy "Public reads pronunciations" on public.pronunciations for select to anon, authenticated using (true);
drop policy if exists "Editors manage pronunciations" on public.pronunciations;
create policy "Editors manage pronunciations" on public.pronunciations for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
