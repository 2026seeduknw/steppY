-- Talky 질문·답변: 탈퇴해도 글은 남기고, 본인 글은 직접 지울 수 있게 (2026-11-12)
--
-- 이용약관 제18조·개인정보처리방침 3항과 맞춘다.
--   1) 탈퇴(auth.users 삭제) 때 질문·답변을 같이 지우던(on delete cascade) 것을
--      작성자 연결만 끊는 것(on delete set null)으로 바꾼다. 화면에는 원래 이름이
--      나오지 않으므로(답변 A·B…), 남은 글로 작성자를 알아볼 수 없다.
--   2) 남는 글을 탈퇴 전에 본인이 지울 수 있도록 본인 행 삭제 정책을 둔다.
--      질문을 지우면 그 질문에 달린 답변도 함께 지워진다(question_id on delete cascade).
--
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행하면 된다. 여러 번 실행해도 안전하다.

alter table public.mentor_questions alter column author_id drop not null;
alter table public.mentor_answers   alter column author_id drop not null;

-- 기존 외래키 이름을 모를 수 있어 auth.users를 가리키는 author_id 외래키를 찾아 지운 뒤 다시 건다
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.conrelid in ('public.mentor_questions'::regclass, 'public.mentor_answers'::regclass)
      and a.attname = 'author_id'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.mentor_questions
  add constraint mentor_questions_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;
alter table public.mentor_answers
  add constraint mentor_answers_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

drop policy if exists mentor_questions_delete_own on public.mentor_questions;
create policy mentor_questions_delete_own on public.mentor_questions
  for delete to authenticated using ((select auth.uid()) = author_id);

drop policy if exists mentor_answers_delete_own on public.mentor_answers;
create policy mentor_answers_delete_own on public.mentor_answers
  for delete to authenticated using ((select auth.uid()) = author_id);
