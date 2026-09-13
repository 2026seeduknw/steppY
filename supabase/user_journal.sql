-- 기록하기 탭이 쓰는 테이블. Supabase에 이미 적용돼 있고, 여기 파일은 그 기록이다.
-- (다른 supabase/*.sql과 같은 목적 — 대시보드에서 돌린 DDL을 버전 관리에 남긴다)
--
-- 출국 준비 중에도, 교환을 가서도 같은 곳에 이어 쓴다. 그래서 테이블을 나누지 않고
-- phase 한 칸으로 구분한다. 나중에 "준비 기간만 모아보기" 같은 화면을 만들 때
-- 필터 한 줄이면 되고, 교환을 떠나는 순간 기록이 두 곳으로 찢어지지도 않는다.

create table if not exists public.user_journal (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null default current_date,
  phase       text not null default 'prepare' check (phase in ('prepare', 'abroad')),
  title       text,
  body        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 목록은 항상 "내 것 중 최신순"으로만 읽는다
create index if not exists user_journal_user_date_idx
  on public.user_journal (user_id, entry_date desc, created_at desc);

-- 남의 일기를 읽을 수 있으면 안 되는 데이터다. anon 키는 클라이언트에 박혀 있으므로
-- 실제 차단은 전적으로 아래 RLS가 한다(user_todos와 같은 소유자 전용 정책).
alter table public.user_journal enable row level security;

create policy user_journal_select_own on public.user_journal
  for select using ((select auth.uid()) = user_id);
create policy user_journal_insert_own on public.user_journal
  for insert with check ((select auth.uid()) = user_id);
create policy user_journal_update_own on public.user_journal
  for update using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id);
create policy user_journal_delete_own on public.user_journal
  for delete using ((select auth.uid()) = user_id);
