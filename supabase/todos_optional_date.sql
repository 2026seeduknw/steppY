-- ============================================================
-- 직접 추가하는 할 일의 기한을 선택으로
--
-- 체크리스트 항목을 To-Do로 옮길 때 기한은 사용자가 알면 넣고, 모르면 비워 둔다
-- (서류·비자 처리 기간처럼 앱이 정해 줄 근거가 없는 경우가 많다).
-- 예전 제약은 직접 추가한 할 일에 due_date를 강제했다 — 제목만 있으면 되게 푼다.
--
-- 실행: Supabase SQL Editor에 붙여넣고 Run. auth_schema.sql 이후.
-- ============================================================
alter table public.user_todos drop constraint if exists user_todos_shape;
alter table public.user_todos add constraint user_todos_shape check (
  (base_id is not null) or (title is not null)
);
