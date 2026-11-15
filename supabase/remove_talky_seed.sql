-- Talky 시드 글(목업) 삭제 — 2026-11-15
--
-- 질문 389개·답변 389개가 모두 한 계정(c47fb331-a287-45d8-8236-9641ea5870e6)이 날짜를 지정해 한꺼번에 넣은 글이라
-- 실제 사용자 글처럼 보이지 않도록 지운다. 지우기 전 전체를 백업해 두었다:
--   supabase/backup/talky_seed_2026-11-15.json  (되살리기: supabase/backup/restore_talky_seed.sql)
--
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행한다. 이 계정이 쓴 글만 지운다.

begin;
delete from public.mentor_answers   where author_id = 'c47fb331-a287-45d8-8236-9641ea5870e6';
delete from public.mentor_questions where author_id = 'c47fb331-a287-45d8-8236-9641ea5870e6';
commit;

-- 확인: 둘 다 0이면 끝
select (select count(*) from public.mentor_questions where author_id = 'c47fb331-a287-45d8-8236-9641ea5870e6') as questions_left,
       (select count(*) from public.mentor_answers   where author_id = 'c47fb331-a287-45d8-8236-9641ea5870e6') as answers_left;
