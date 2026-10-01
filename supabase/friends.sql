-- ============================================================
-- 친구 · 타임라인 · 좋아요 · 댓글 · 신고 · 차단 (기록하기 탭)
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- auth_schema.sql, user_journal.sql이 먼저 적용돼 있어야 한다.
--
-- 설계 원칙
--   - 친구 관계(friendships)·차단(user_blocks)·신고(content_reports)는 클라이언트가
--     테이블에 직접 쓰지 못한다. 쓰기는 전부 아래 SECURITY DEFINER 함수(RPC)로만 —
--     "내가 수락한 척" "남의 요청을 대신 수락" 같은 위조 경로를 막는다.
--   - 친구에게 보이는 범위는 기록 한 건 단위(user_journal.visibility)다.
--     기존 기록은 전부 'private'으로 시작하고, 새 기록의 기본값만 'friends'다.
--   - 친구 사진은 비공개 버킷 그대로 두고, "친구에게 공개된 기록에 실린 사진"만
--     Storage 정책으로 열어 준다(서명 URL이 그 정책을 탄다).
--   - 차단하면 친구 관계가 사라지고, 어느 쪽이 차단했든 서로의 기록·댓글이 보이지 않는다.
-- ============================================================

-- ---------------------------------------------------------------- 초대 코드
alter table public.profiles
  add column if not exists invite_code text unique;

-- 내 초대 코드. 없으면 만든다(첫 호출 때 한 번). 코드는 8자리 영문 대문자+숫자.
create or replace function public.my_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c  text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select invite_code into c from public.profiles where id = me;
  if c is not null then return c; end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text || me::text), 1, 8));
    begin
      update public.profiles set invite_code = c where id = me and invite_code is null;
      exit;
    exception when unique_violation then
      -- 드물게 겹치면 다시 뽑는다
      null;
    end;
  end loop;
  select invite_code into c from public.profiles where id = me;
  return c;
end;
$$;

-- ---------------------------------------------------------------- 차단
create table if not exists public.user_blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.user_blocks enable row level security;
create policy user_blocks_select_own on public.user_blocks
  for select to authenticated using ((select auth.uid()) = blocker);
-- insert/delete는 block_user / unblock_user 함수로만

-- 둘 중 한쪽이라도 상대를 차단했는가 (RLS를 우회해 양방향을 본다)
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks k
    where (k.blocker = a and k.blocked = b) or (k.blocker = b and k.blocked = a)
  );
$$;

-- ---------------------------------------------------------------- 친구 관계
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
-- (A→B)와 (B→A)가 동시에 존재할 수 없게 순서 없는 쌍으로 유일하게 둔다
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;
create policy friendships_select_own on public.friendships
  for select to authenticated
  using ((select auth.uid()) = requester or (select auth.uid()) = addressee);
-- 쓰기 정책 없음 — RPC로만

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  ) and not public.is_blocked_between(a, b);
$$;

-- 코드로 친구 요청. 결과: sent | accepted | already_friends | pending | invalid_code | self
--   - 상대가 이미 나에게 요청했으면 바로 친구가 된다(accepted)
--   - 차단 관계·없는 코드는 똑같이 invalid_code — 차단 여부를 알려주지 않는다
create or replace function public.send_friend_request(code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
  existing public.friendships%rowtype;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into other from public.profiles where invite_code = upper(trim(code));
  if other is null then return 'invalid_code'; end if;
  if other = me then return 'self'; end if;
  if public.is_blocked_between(me, other) then return 'invalid_code'; end if;

  select * into existing from public.friendships f
   where (f.requester = me and f.addressee = other) or (f.requester = other and f.addressee = me);

  if found then
    if existing.status = 'accepted' then return 'already_friends'; end if;
    if existing.requester = me then return 'pending'; end if;
    -- 상대가 먼저 보낸 요청 → 수락으로 처리
    update public.friendships set status = 'accepted', responded_at = now() where id = existing.id;
    return 'accepted';
  end if;

  insert into public.friendships (requester, addressee) values (me, other);
  return 'sent';
end;
$$;

create or replace function public.respond_friend_request(fid uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if accept then
    update public.friendships set status = 'accepted', responded_at = now()
     where id = fid and addressee = me and status = 'pending';
  else
    delete from public.friendships where id = fid and addressee = me and status = 'pending';
  end if;
end;
$$;

-- 친구 삭제 / 보낸 요청 취소 (어느 쪽이든)
create or replace function public.remove_friend(fid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.friendships where id = fid and (requester = me or addressee = me);
end;
$$;

create or replace function public.block_user(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if target is null or target = me then return; end if;
  insert into public.user_blocks (blocker, blocked) values (me, target) on conflict do nothing;
  delete from public.friendships
   where (requester = me and addressee = target) or (requester = target and addressee = me);
end;
$$;

create or replace function public.unblock_user(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.user_blocks where blocker = auth.uid() and blocked = target;
end;
$$;

-- 내 친구 목록·받은/보낸 요청. direction: friend | incoming | outgoing
-- 친구가 확정한 파견 학교(이름·국가·도시)도 같이 돌려준다 — profiles는 본인만 읽게 막혀 있어서
-- 함수가 대신 읽는다. 학교를 아직 안 정했으면 세 칸 모두 null.
drop function if exists public.list_friends();
create or replace function public.list_friends()
returns table (friendship_id uuid, user_id uuid, name text, status text, direction text,
               school_name text, school_country text, school_city text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id,
         o.id,
         coalesce(nullif(o.name, ''), '이름 없음'),
         f.status,
         case when f.status = 'accepted' then 'friend'
              when f.addressee = auth.uid() then 'incoming'
              else 'outgoing' end,
         coalesce(s.name_ko, s.name),
         coalesce(s.country_ko, s.country_en),
         s.city
    from public.friendships f
    join public.profiles o
      on o.id = case when f.requester = auth.uid() then f.addressee else f.requester end
    left join public.schools s on s.id = o.confirmed_school_id
   where auth.uid() in (f.requester, f.addressee)
     and not public.is_blocked_between(auth.uid(), o.id)
   order by f.status, f.created_at desc;
$$;

create or replace function public.list_blocked()
returns table (user_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select k.blocked, coalesce(nullif(p.name, ''), '이름 없음')
    from public.user_blocks k
    left join public.profiles p on p.id = k.blocked
   where k.blocker = auth.uid()
   order by k.created_at desc;
$$;

-- ---------------------------------------------------------------- 정밀 좌표 제거
-- 기록의 location(jsonb)에 위도·경도가 들어 있었다. 화면은 도시·국가만 쓰는데,
-- 친구에게 기록을 열면 친구가 API로 정확한 좌표까지 읽을 수 있게 되므로 미리 지운다.
-- (앱도 이제 좌표를 저장하지 않는다)
update public.user_journal
   set location = location - 'lat' - 'lng'
 where location is not null and (location ? 'lat' or location ? 'lng');

-- ---------------------------------------------------------------- 기록 공개 범위
-- 기존 행은 'private'으로 채운 뒤 기본값만 'friends'로 바꾼다 —
-- 이미 써 둔 기록이 갑자기 친구에게 보이는 일이 없다.
alter table public.user_journal
  add column if not exists visibility text not null default 'private'
  check (visibility in ('private', 'friends'));
alter table public.user_journal alter column visibility set default 'friends';

-- 친구에게 공개된 기록을 읽을 수 있다(기존 user_journal_select_own과 OR로 합쳐진다)
create policy user_journal_select_friends on public.user_journal
  for select to authenticated
  using (visibility = 'friends' and public.are_friends((select auth.uid()), user_id));

create index if not exists user_journal_created_idx on public.user_journal (created_at desc);

-- 이 기록을 내가 볼 수 있는가 (내 것 이거나, 친구에게 공개된 친구 것)
create or replace function public.can_see_entry(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_journal j
     where j.id = eid
       and (j.user_id = (select auth.uid())
            or (j.visibility = 'friends' and public.are_friends((select auth.uid()), j.user_id)))
  );
$$;

-- 친구에게 공개된 기록에 실린 사진만 친구가 서명 URL로 읽을 수 있다
create policy diary_photos_select_friends on storage.objects
  for select to authenticated
  using (
    bucket_id = 'diary-photos'
    and exists (
      select 1 from public.user_journal j
       where j.user_id::text = (storage.foldername(name))[1]
         and j.visibility = 'friends'
         and name = any (j.photos)
         and public.are_friends((select auth.uid()), j.user_id)
    )
  );

-- ---------------------------------------------------------------- 좋아요
create table if not exists public.journal_likes (
  entry_id uuid not null references public.user_journal(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
alter table public.journal_likes enable row level security;

create policy journal_likes_select on public.journal_likes
  for select to authenticated
  using (public.can_see_entry(entry_id) and not public.is_blocked_between((select auth.uid()), user_id));
create policy journal_likes_insert on public.journal_likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_see_entry(entry_id));
create policy journal_likes_delete on public.journal_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- 댓글
create table if not exists public.journal_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.user_journal(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- 댓글 쓴 사람이 글 주인의 친구가 아닐 수 있고(친구의 친구) profiles는 본인만 읽게 막아 두었으므로
  -- 이름은 쓰는 순간 복사해 둔다
  author_name text,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists journal_comments_entry_idx on public.journal_comments (entry_id, created_at);

create or replace function public.set_comment_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_name := coalesce(
    (select nullif(p.name, '') from public.profiles p where p.id = new.user_id), '이름 없음');
  return new;
end;
$$;
drop trigger if exists journal_comments_author on public.journal_comments;
create trigger journal_comments_author
  before insert on public.journal_comments
  for each row execute function public.set_comment_author();

alter table public.journal_comments enable row level security;

create policy journal_comments_select on public.journal_comments
  for select to authenticated
  using (public.can_see_entry(entry_id) and not public.is_blocked_between((select auth.uid()), user_id));
create policy journal_comments_insert on public.journal_comments
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_see_entry(entry_id));
-- 내 댓글, 또는 내 기록에 달린 댓글은 지울 수 있다
create policy journal_comments_delete on public.journal_comments
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.user_journal j where j.id = entry_id and j.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------- 신고
-- 심사 가이드라인 1.2: 신고 수단이 있어야 하고 운영자가 보고 조치해야 한다.
-- 읽기 정책이 없어서 앱에서는 못 읽는다 — Supabase 대시보드(Table Editor)에서 확인한다.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('entry', 'comment', 'user')),
  target_id uuid not null,
  target_user uuid,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  handled boolean not null default false
);
alter table public.content_reports enable row level security;
create policy content_reports_insert on public.content_reports
  for insert to authenticated with check ((select auth.uid()) = reporter);

-- ---------------------------------------------------------------- 실행 권한
-- 기본값은 PUBLIC 실행 허용이라 anon에게도 열린다. 로그인한 사용자에게만 연다.
revoke all on function public.my_invite_code()                 from public, anon;
revoke all on function public.send_friend_request(text)        from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid)              from public, anon;
revoke all on function public.block_user(uuid)                 from public, anon;
revoke all on function public.unblock_user(uuid)               from public, anon;
revoke all on function public.list_friends()                   from public, anon;
revoke all on function public.list_blocked()                   from public, anon;
revoke all on function public.are_friends(uuid, uuid)          from public, anon;
revoke all on function public.is_blocked_between(uuid, uuid)   from public, anon;
revoke all on function public.can_see_entry(uuid)              from public, anon;

grant execute on function public.my_invite_code()                 to authenticated;
grant execute on function public.send_friend_request(text)        to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid)              to authenticated;
grant execute on function public.block_user(uuid)                 to authenticated;
grant execute on function public.unblock_user(uuid)               to authenticated;
grant execute on function public.list_friends()                   to authenticated;
grant execute on function public.list_blocked()                   to authenticated;
grant execute on function public.are_friends(uuid, uuid)          to authenticated;
grant execute on function public.is_blocked_between(uuid, uuid)   to authenticated;
grant execute on function public.can_see_entry(uuid)              to authenticated;
