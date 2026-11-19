-- 크레딧·결제·해금 없애기 (2026-11-08)
--
-- 앱 화면에서는 크레딧을 모두 뺐다(js/state.js, layout.js, consult.js, credits.js).
-- 서버 쪽에서 아직 크레딧을 건드리는 건 멘토 질문·답변 두 RPC뿐이다:
--   ask_question  — 질문 1건에 10 크레딧을 깎고, 모자라면 'insufficient_credits'로 막는다
--   submit_answer — 답변하면 10 크레딧을 적립한다
-- 질문이 막히지 않도록 두 함수를 크레딧 없이 다시 정의한다. 이름·인자·반환형은 그대로라
-- 앱 코드는 바꿀 필요가 없다. user_credits / credit_transactions / match_unlocks 테이블은
-- 기록으로 남겨 두고(지우지 않는다) 더는 쓰지 않는다.
--
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행하면 된다.

create or replace function public.ask_question(
  p_country text, p_school_id text, p_title text, p_body text
)
returns public.mentor_questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.mentor_questions;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_country is null or btrim(p_country) = '' then
    raise exception 'country_required' using errcode = '22023';
  end if;
  if p_title is null or btrim(p_title) = '' or p_body is null or btrim(p_body) = '' then
    raise exception 'title_and_body_required' using errcode = '22023';
  end if;

  insert into public.mentor_questions (author_id, country, school_id, title, body)
  values (v_uid, btrim(p_country), p_school_id, btrim(p_title), btrim(p_body))
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.submit_answer(p_question_id uuid, p_body text)
returns public.mentor_answers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_row public.mentor_answers;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'body_required' using errcode = '22023';
  end if;

  select author_id into v_author from public.mentor_questions where id = p_question_id;
  if v_author is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  if v_author = v_uid then
    raise exception 'cannot_answer_own_question' using errcode = 'check_violation';
  end if;

  insert into public.mentor_answers (question_id, author_id, body)
  values (p_question_id, v_uid, btrim(p_body))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.ask_question(text, text, text, text) to authenticated;
grant execute on function public.submit_answer(uuid, text) to authenticated;
