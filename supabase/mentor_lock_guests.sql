-- ============================================================
-- Mentor's Step — 비로그인 잠금 (서버 쪽)
--
-- 화면(js/consult.js)은 비로그인에게 게시판을 가리지만, 질문·답변 읽기 정책이
-- anon 에게도 열려 있으면 anon 키로 API를 직접 불러 그대로 읽을 수 있다.
-- 실제로 잠그려면 읽기를 로그인한 사용자(authenticated)로 좁혀야 한다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- mentor_step.sql 이 먼저 적용돼 있어야 한다.
--
-- 되돌리기: 아래 두 create policy 를 지우고 mentor_step.sql 의
--   mentor_questions_public_read / mentor_answers_public_read 를 다시 만들면 된다.
-- ============================================================

drop policy if exists mentor_questions_public_read on public.mentor_questions;
drop policy if exists mentor_answers_public_read on public.mentor_answers;

create policy mentor_questions_authenticated_read on public.mentor_questions
  for select to authenticated using (true);
create policy mentor_answers_authenticated_read on public.mentor_answers
  for select to authenticated using (true);
