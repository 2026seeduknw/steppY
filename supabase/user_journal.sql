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

-- ---------------------------------------------------------------------------
-- 사진 다이어리(기록 탭)를 붙이면서 추가한 것. 이미 적용돼 있다.
-- ---------------------------------------------------------------------------

alter table public.user_journal
  add column if not exists photos   text[] not null default '{}',
  add column if not exists tags     text[] not null default '{}',
  add column if not exists location jsonb;

comment on column public.user_journal.tags is
  'overview/surroundings/housing/academics/support/facilities/culture/resources/tips';
comment on column public.user_journal.photos is 'diary-photos 버킷 내 경로 목록';

-- 파견 기간. exchange_term('2027 가을학기')만으로는 며칠째인지 셀 수 없어서
-- D-day 계산에 쓸 실제 날짜가 따로 필요하다.
alter table public.profiles
  add column if not exists program_start date,
  add column if not exists program_end   date;

-- 사진은 행이 아니라 Storage에 둔다. base64로 넣으면 행이 수 MB로 불어나
-- 목록 조회가 통째로 느려진다. 비공개 버킷이라 읽기도 정책을 탄다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diary-photos', 'diary-photos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 경로는 <user_id>/<uuid>.jpg. 첫 칸이 자기 id인 파일만 다룰 수 있다.
create policy diary_photos_select_own on storage.objects for select
  using (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy diary_photos_insert_own on storage.objects for insert
  with check (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy diary_photos_delete_own on storage.objects for delete
  using (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2026-09-17 — 기록에 노래·날씨 붙이기 (js/song.js)
-- 스키마를 고정하지 않고 jsonb로 둔다: 추천 엔진(Last.fm)이 돌려주는 필드가 바뀔 수
-- 있고, 링크·앨범아트처럼 표시용으로만 쓰는 값이라 쿼리 대상이 아니다.
alter table public.user_journal
  add column if not exists song jsonb,        -- 저장 후 자동 추천된 "오늘의 노래"
  add column if not exists now_playing jsonb, -- 사용자가 직접 고른 "그때 듣던 노래"
  add column if not exists weather jsonb;     -- {code, temp} — 추천 무드 계산 + 카드 표시용
