-- Schéma préparatoire pour le futur back-office sécurisé.
-- À exécuter une seule fois dans le SQL Editor du projet Supabase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'professor')),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  level text not null check (level in ('6', '4')),
  category text not null default 'À définir' check (char_length(category) <= 60),
  summary text not null default '' check (char_length(summary) <= 300),
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  author_id uuid not null references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_public_list_idx
  on public.courses (level, status, sort_order, updated_at desc);
create index if not exists profiles_role_idx on public.profiles (id, role);

-- SECURITY DEFINER évite une récursion RLS sur profiles. Le search_path vide
-- et les noms pleinement qualifiés limitent les détournements de fonction.
create or replace function public.is_professor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'professor'
  );
$$;

revoke all on function public.is_professor() from public;
grant execute on function public.is_professor() to authenticated;

create or replace function public.set_course_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and (old.status is distinct from 'published') then
    new.published_at = now();
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists courses_set_timestamps on public.courses;
create trigger courses_set_timestamps
before update on public.courses
for each row execute function public.set_course_timestamps();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.courses enable row level security;
alter table public.courses force row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.courses from anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;

drop policy if exists "profile_read_own" on public.profiles;
create policy "profile_read_own"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "published_courses_are_public" on public.courses;
create policy "published_courses_are_public"
on public.courses for select
to anon, authenticated
using (status = 'published');

drop policy if exists "professor_reads_all_courses" on public.courses;
create policy "professor_reads_all_courses"
on public.courses for select
to authenticated
using ((select public.is_professor()));

drop policy if exists "professor_creates_courses" on public.courses;
create policy "professor_creates_courses"
on public.courses for insert
to authenticated
with check ((select public.is_professor()) and author_id = (select auth.uid()));

drop policy if exists "professor_updates_courses" on public.courses;
create policy "professor_updates_courses"
on public.courses for update
to authenticated
using ((select public.is_professor()))
with check ((select public.is_professor()) and author_id = (select auth.uid()));

drop policy if exists "professor_deletes_courses" on public.courses;
create policy "professor_deletes_courses"
on public.courses for delete
to authenticated
using ((select public.is_professor()));

-- Amorçage manuel du compte professeur :
-- 1. Créer l’utilisateur dans Authentication > Users avec l’inscription publique désactivée.
-- 2. Copier son UUID et exécuter depuis le SQL Editor (jamais depuis le navigateur) :
-- insert into public.profiles (id, role) values ('UUID_DU_COMPTE', 'professor');
