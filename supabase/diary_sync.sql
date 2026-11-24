-- 다이어리 꾸밈·폴더·내 스티커를 기기 사이에 잇는 테이블 (js/diary-sync.js)
--
-- 한 행 = 문서 하나. doc_key 는 'folders', 'stickers', 'page:<페이지 키>' 다.
-- 사진은 여기 넣지 않는다. diary-photos 버킷에 올리고 data 안에는 'asset:<경로>' 만 남긴다.
-- deleted 는 다른 기기에 남은 사본이 지운 페이지를 되살리지 않게 하는 표시다.
-- 여러 번 실행해도 안전하다.

create table if not exists public.user_diary_docs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  doc_key    text not null check (char_length(doc_key) <= 200),
  data       jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_key),
  constraint user_diary_docs_size check (data is null or pg_column_size(data) <= 5242880)
);

-- 기기 시계가 달라도 순서가 꼬이지 않게 수정 시각은 서버가 정한다
create or replace function public.user_diary_docs_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_diary_docs_touch on public.user_diary_docs;
create trigger user_diary_docs_touch
  before insert or update on public.user_diary_docs
  for each row execute function public.user_diary_docs_touch();

alter table public.user_diary_docs enable row level security;

drop policy if exists user_diary_docs_select_own on public.user_diary_docs;
create policy user_diary_docs_select_own on public.user_diary_docs
  for select using ((select auth.uid()) = user_id);
drop policy if exists user_diary_docs_insert_own on public.user_diary_docs;
create policy user_diary_docs_insert_own on public.user_diary_docs
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists user_diary_docs_update_own on public.user_diary_docs;
create policy user_diary_docs_update_own on public.user_diary_docs
  for update using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id);
drop policy if exists user_diary_docs_delete_own on public.user_diary_docs;
create policy user_diary_docs_delete_own on public.user_diary_docs
  for delete using ((select auth.uid()) = user_id);

revoke all on public.user_diary_docs from anon;
grant select, insert, update, delete on public.user_diary_docs to authenticated;
