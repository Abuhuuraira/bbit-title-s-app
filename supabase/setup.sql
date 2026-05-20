-- ================================================================
-- Farewell Nickname Voting App — Supabase Setup
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ================================================================

-- ---------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------

create table if not exists public.students (
  id           uuid default uuid_generate_v4() primary key,
  full_name    text not null,
  slug         text not null unique,
  created_at   timestamptz default now()
);

create table if not exists public.profiles (
  id            uuid default uuid_generate_v4() primary key,
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  student_id    uuid references public.students(id),
  username      text not null unique,
  display_name  text not null,
  created_at    timestamptz default now()
);

create table if not exists public.nickname_options (
  id                  uuid default uuid_generate_v4() primary key,
  student_id          uuid not null references public.students(id),
  nickname            text not null,
  normalized_nickname text not null,
  created_by          uuid not null references auth.users(id),
  created_at          timestamptz default now(),
  unique(student_id, normalized_nickname)
);

create table if not exists public.votes (
  id                 uuid default uuid_generate_v4() primary key,
  student_id         uuid not null references public.students(id),
  nickname_option_id uuid not null references public.nickname_options(id),
  user_id            uuid not null references auth.users(id),
  created_at         timestamptz default now(),
  unique(student_id, user_id)   -- one vote per student per user, enforced at DB level
);

-- ---------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------
create index if not exists idx_nickname_options_student_id on public.nickname_options(student_id);
create index if not exists idx_votes_student_id            on public.votes(student_id);
create index if not exists idx_votes_nickname_option_id    on public.votes(nickname_option_id);
create index if not exists idx_votes_user_id               on public.votes(user_id);
create index if not exists idx_profiles_auth_user_id       on public.profiles(auth_user_id);

-- ---------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------
alter table public.students         enable row level security;
alter table public.profiles         enable row level security;
alter table public.nickname_options enable row level security;
alter table public.votes            enable row level security;

-- Students: public read, no write via API
create policy "students_public_read"
  on public.students for select
  to anon, authenticated
  using (true);

-- Profiles: owner can read their own
create policy "profiles_owner_read"
  on public.profiles for select
  to authenticated
  using (auth_user_id = auth.uid());

-- Nickname options: public read, authenticated insert only (no update/delete)
create policy "nickname_options_public_read"
  on public.nickname_options for select
  to anon, authenticated
  using (true);

create policy "nickname_options_auth_insert"
  on public.nickname_options for insert
  to authenticated
  with check (created_by = auth.uid());

-- Votes: user can read their own, authenticated insert only (no update/delete)
create policy "votes_owner_read"
  on public.votes for select
  to authenticated
  using (user_id = auth.uid());

create policy "votes_auth_insert"
  on public.votes for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 5. Helper: normalize nickname text
-- ---------------------------------------------------------------
create or replace function public.normalize_nickname(p_nickname text)
returns text
language plpgsql
immutable
as $$
begin
  -- lowercase, trim leading/trailing whitespace, collapse inner spaces
  return lower(trim(regexp_replace(p_nickname, '\s+', ' ', 'g')));
end;
$$;

-- ---------------------------------------------------------------
-- 6. RPC: submit_nickname
-- Called when user types a new nickname for a student.
-- Handles deduplication (same normalized nickname → reuse).
-- ---------------------------------------------------------------
create or replace function public.submit_nickname(
  p_student_id uuid,
  p_nickname   text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid;
  v_normalized  text;
  v_nickname_id uuid;
  v_vote_count  int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Guard: already voted for this student?
  select count(*) into v_vote_count
  from public.votes
  where student_id = p_student_id and user_id = v_user_id;

  if v_vote_count > 0 then
    return json_build_object('success', false, 'error', 'You have already selected a nickname for this student.');
  end if;

  v_normalized := public.normalize_nickname(p_nickname);

  if length(v_normalized) = 0 then
    return json_build_object('success', false, 'error', 'Nickname cannot be empty.');
  end if;

  if length(v_normalized) > 60 then
    return json_build_object('success', false, 'error', 'Nickname is too long (max 60 characters).');
  end if;

  -- Find or create the nickname option
  select id into v_nickname_id
  from public.nickname_options
  where student_id = p_student_id
    and normalized_nickname = v_normalized;

  if v_nickname_id is null then
    insert into public.nickname_options (student_id, nickname, normalized_nickname, created_by)
    values (p_student_id, trim(p_nickname), v_normalized, v_user_id)
    returning id into v_nickname_id;
  end if;

  -- Cast vote
  insert into public.votes (student_id, nickname_option_id, user_id)
  values (p_student_id, v_nickname_id, v_user_id);

  return json_build_object('success', true, 'nickname_option_id', v_nickname_id);

exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'You have already selected a nickname for this student.');
  when others then
    return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------
-- 7. RPC: vote_for_nickname
-- Called when user clicks an existing nickname's vote button.
-- ---------------------------------------------------------------
create or replace function public.vote_for_nickname(
  p_nickname_option_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_student_id uuid;
  v_vote_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Resolve student
  select student_id into v_student_id
  from public.nickname_options
  where id = p_nickname_option_id;

  if v_student_id is null then
    return json_build_object('success', false, 'error', 'Nickname not found.');
  end if;

  -- Guard: already voted for this student?
  select count(*) into v_vote_count
  from public.votes
  where student_id = v_student_id and user_id = v_user_id;

  if v_vote_count > 0 then
    return json_build_object('success', false, 'error', 'You have already selected a nickname for this student.');
  end if;

  -- Cast vote
  insert into public.votes (student_id, nickname_option_id, user_id)
  values (v_student_id, p_nickname_option_id, v_user_id);

  return json_build_object('success', true);

exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'You have already selected a nickname for this student.');
  when others then
    return json_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------
-- 8. RPC: get_students_results (public — no voter identity exposed)
-- ---------------------------------------------------------------
create or replace function public.get_students_results()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_agg(
    json_build_object(
      'id',       s.id,
      'fullName', s.full_name,
      'slug',     s.slug,
      'nicknames', coalesce(
        (
          select json_agg(
            json_build_object(
              'id',        no.id,
              'nickname',  no.nickname,
              'voteCount', (
                select count(*)
                from public.votes v
                where v.nickname_option_id = no.id
              )
            )
            order by (
              select count(*)
              from public.votes v
              where v.nickname_option_id = no.id
            ) desc, no.created_at asc
          )
          from public.nickname_options no
          where no.student_id = s.id
        ),
        '[]'::json
      )
    )
    order by s.full_name asc
  )
  into v_result
  from public.students s;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ---------------------------------------------------------------
-- 9. RPC: get_my_votes (returns the calling user's votes only)
-- ---------------------------------------------------------------
create or replace function public.get_my_votes()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result  json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return '[]'::json;
  end if;

  select json_agg(
    json_build_object(
      'studentId',         v.student_id,
      'nicknameOptionId',  v.nickname_option_id,
      'nickname',          no.nickname
    )
  )
  into v_result
  from public.votes v
  join public.nickname_options no on no.id = v.nickname_option_id
  where v.user_id = v_user_id;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ---------------------------------------------------------------
-- 10. RPC: get_my_profile
-- ---------------------------------------------------------------
create or replace function public.get_my_profile()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_result  json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return null;
  end if;

  select json_build_object(
    'id',          p.id,
    'username',    p.username,
    'displayName', p.display_name
  )
  into v_result
  from public.profiles p
  where p.auth_user_id = v_user_id;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------
-- Grant execute on RPC functions to anon and authenticated roles
-- ---------------------------------------------------------------
grant execute on function public.get_students_results()              to anon, authenticated;
grant execute on function public.get_my_votes()                      to authenticated;
grant execute on function public.get_my_profile()                    to authenticated;
grant execute on function public.submit_nickname(uuid, text)         to authenticated;
grant execute on function public.vote_for_nickname(uuid)             to authenticated;
