-- ============================================================
-- Mentor's Step — 질문·답변 게시판 + 크레딧
--
-- 국가만 필수, 학교는 선택 태그다. 소수 인원만 가는 학교는 "이 학교 질문 = 누구"로
-- 짐작될 수 있어서, 답변까지 익명이 기본이고(작성자 이름·이메일은 어디서도 노출하지
-- 않는다 — js/consult.js가 UI에서 절대 표시하지 않는다) 학교 지정 자체도 강제하지 않는다.
--
-- 크레딧은 반드시 아래 RPC(ask_question / submit_answer)로만 움직인다. profiles처럼
-- authenticated가 직접 update할 수 있는 테이블에 넣으면 누구나 자기 잔액을 원하는
-- 값으로 고쳐 쓸 수 있어서(RLS는 행 단위지, 컬럼 단위가 아니다) user_credits를 따로
-- 두고 select만 허용한다 — insert/update 정책 자체가 없으므로 오직 SECURITY DEFINER
-- 함수(테이블 소유자 권한으로 실행)만 잔액을 바꿀 수 있다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- auth_schema.sql이 먼저 적용돼 있어야 한다(profiles, handle_new_user 등을 재사용).
-- ============================================================

-- ---------------------------------------------------------------- 질문/답변
create table if not exists public.mentor_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  country text not null,
  -- 학교는 선택이다 — 적으면 답변이 더 정확해지지만 강제하지 않는다.
  school_id text references public.schools(id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.mentor_questions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- 질문 즐겨찾기(북마크). 학교 즐겨찾기(user_favorites)와는 별개 테이블.
create table if not exists public.mentor_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.mentor_questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists mentor_questions_country_idx on public.mentor_questions (country);
create index if not exists mentor_questions_school_idx  on public.mentor_questions (school_id);
create index if not exists mentor_answers_question_idx  on public.mentor_answers (question_id);
create index if not exists mentor_favorites_user_idx    on public.mentor_favorites (user_id);

-- ---------------------------------------------------------------------- 크레딧
create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 잔액 변동 이력 — "왜 깎였지?" 문의 대응, 나중에 관리 화면을 만들 때도 재사용.
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('signup_bonus', 'ask_question', 'answer_reward')),
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_idx on public.credit_transactions (user_id);

-- ------------------------------------------------------------------------ RLS
alter table public.mentor_questions   enable row level security;
alter table public.mentor_answers     enable row level security;
alter table public.mentor_favorites   enable row level security;
alter table public.user_credits       enable row level security;
alter table public.credit_transactions enable row level security;

-- 질문·답변은 누구나 읽는다(비로그인 포함 — 둘러보기). 쓰기 정책은 일부러 두지
-- 않는다: insert는 아래 ask_question/submit_answer RPC로만 가능하다. 그래야
-- "질문 1건당 -10크레딧"이 클라이언트가 아니라 서버에서 강제된다.
create policy mentor_questions_public_read on public.mentor_questions
  for select to anon, authenticated using (true);
create policy mentor_answers_public_read on public.mentor_answers
  for select to anon, authenticated using (true);

create policy mentor_favorites_select_own on public.mentor_favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy mentor_favorites_insert_own on public.mentor_favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy mentor_favorites_delete_own on public.mentor_favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- user_credits/credit_transactions: select만 허용하고 insert/update 정책은
-- 아예 만들지 않는다 — 클라이언트가 REST로 직접 잔액을 못 건드리게 막는 핵심 장치.
create policy user_credits_select_own on public.user_credits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy credit_transactions_select_own on public.credit_transactions
  for select to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------ 가입 보너스(+30, 임의값)
-- auth_schema.sql의 handle_new_user()를 재정의한다 — 원래 하던 profiles insert는
-- 그대로 두고 크레딧 지급만 추가한다. 같은 트리거(on_auth_user_created)가 이 새
-- 정의를 그대로 쓰므로 트리거를 다시 만들 필요는 없다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;

  insert into public.user_credits (user_id, balance)
  values (new.id, 30)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, delta, reason)
  values (new.id, 30, 'signup_bonus');

  return new;
end;
$$;

-- ------------------------------------------------------- 질문 (-10크레딧)
-- update ... where balance >= v_cost 한 문장으로 "잔액 확인 + 차감"을 원자적으로
-- 처리한다. 행 잠금이 UPDATE 자체에 걸리므로 동시에 두 번 눌러도 이중 차감되지 않는다.
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
  v_cost constant integer := 10;
  v_balance integer;
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

  update public.user_credits
    set balance = balance - v_cost, updated_at = now()
    where user_id = v_uid and balance >= v_cost
    returning balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient_credits'
      using errcode = 'check_violation', hint = '크레딧이 부족해요.';
  end if;

  insert into public.mentor_questions (author_id, country, school_id, title, body)
  values (v_uid, btrim(p_country), p_school_id, btrim(p_title), btrim(p_body))
  returning * into v_row;

  insert into public.credit_transactions (user_id, delta, reason, ref_id)
  values (v_uid, -v_cost, 'ask_question', v_row.id);

  return v_row;
end;
$$;

-- --------------------------------------------------------- 답변 (+10크레딧)
-- 자기 질문에 자기가 답해서 크레딧만 챙기는 것을 막는다 — 채택제 없이 제출 즉시
-- 지급하는 단순한 구조라, 이 한 줄이 없으면 바로 악용된다.
create or replace function public.submit_answer(p_question_id uuid, p_body text)
returns public.mentor_answers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reward constant integer := 10;
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
    raise exception 'cannot_answer_own_question'
      using errcode = 'check_violation', hint = '자기 질문에는 답변으로 크레딧을 받을 수 없어요.';
  end if;

  insert into public.mentor_answers (question_id, author_id, body)
  values (p_question_id, v_uid, btrim(p_body))
  returning * into v_row;

  insert into public.user_credits (user_id, balance)
  values (v_uid, v_reward)
  on conflict (user_id) do update
    set balance = public.user_credits.balance + v_reward, updated_at = now();

  insert into public.credit_transactions (user_id, delta, reason, ref_id)
  values (v_uid, v_reward, 'answer_reward', v_row.id);

  return v_row;
end;
$$;

-- 로그인한 사람만 부르게 한다. 함수 안에서도 auth.uid() is null을 막지만,
-- 이 revoke/grant가 없으면 Supabase 기본값상 anon도 호출 자체는 시도할 수 있다.
revoke execute on function public.ask_question(text, text, text, text) from anon, public;
revoke execute on function public.submit_answer(uuid, text) from anon, public;
grant execute on function public.ask_question(text, text, text, text) to authenticated;
grant execute on function public.submit_answer(uuid, text) to authenticated;

-- handle_new_user()는 트리거 전용(auth_schema.sql과 같은 이유) — 외부에서 RPC로
-- 직접 불러 크레딧을 또 받는 것을 막는다.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
