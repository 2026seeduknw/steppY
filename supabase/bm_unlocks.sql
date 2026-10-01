-- ============================================================
-- BM 2단계 — 크레딧으로 여는 기능 + 유효기간 있는 크레딧
--
--   1) 유효기간 있는 크레딧(credit_grants)
--      가입 보너스(30일)와 프리미엄 증정 크레딧(구독 끝나면 소멸)은 기한이 있다.
--      user_credits.balance는 지금처럼 "기한 없는 크레딧"(구매·답변 보상)만 들고,
--      기한 있는 것은 묶음(lot)별로 따로 둔다. 쓸 때는 곧 사라질 것부터 쓴다.
--      화면에 보이는 잔액 = balance + 아직 안 지난 묶음의 remaining 합.
--
--   2) 쓰는 곳 — 전부 서버 RPC에서 잔액 확인·차감·기록을 한 번에 한다
--      - ask_question         멘토 질문 -10 (mentor_step.sql을 이 방식으로 다시 정의)
--      - unlock_match_list    매칭 목록 3개 더 보기 -10
--      - spend_photo_credit   하루 무료 3장을 넘긴 사진 1장 -5
--
--   3) 가입 보너스 30 → 50 (30일 유효)
--
-- 실행 순서: auth_schema.sql → mentor_step.sql → premium.sql → 이 파일.
-- 숫자를 바꾸면 js/state.js의 BM 상수도 같이 바꿀 것(화면 표시용).
-- ============================================================

-- ------------------------------------------------------------ 거래 사유 확장
alter table public.credit_transactions drop constraint if exists credit_transactions_reason_check;
alter table public.credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('signup_bonus', 'ask_question', 'answer_reward', 'purchase',
                    'premium_bonus', 'match_unlock', 'photo_extra'));

-- ------------------------------------------------------ 유효기간 있는 크레딧 묶음
create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  remaining integer not null check (remaining >= 0),
  reason text not null check (reason in ('signup_bonus', 'premium_bonus')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists credit_grants_user_idx on public.credit_grants (user_id, expires_at);

alter table public.credit_grants enable row level security;
-- 읽기만 — 화면이 "N일 뒤 사라지는 크레딧"을 보여줄 수 있게. 쓰기는 RPC만.
drop policy if exists credit_grants_select_own on public.credit_grants;
create policy credit_grants_select_own on public.credit_grants
  for select to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------- 내부 도우미
-- 쓸 수 있는 총 잔액(기한 없는 것 + 아직 안 지난 묶음)
create or replace function public._credit_total(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select balance from public.user_credits where user_id = p_uid), 0)
       + coalesce((select sum(remaining) from public.credit_grants
                   where user_id = p_uid and remaining > 0 and expires_at > now()), 0)::integer;
$$;

-- 차감 — 곧 사라질 묶음부터 쓰고, 모자라면 기한 없는 잔액에서 뺀다.
-- user_credits 행을 먼저 잠가서 같은 사람이 동시에 두 번 눌러도 이중 차감되지 않는다.
create or replace function public._spend_credits(p_uid uuid, p_cost integer, p_reason text, p_ref uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left integer := p_cost;
  v_lot record;
  v_take integer;
  v_bal integer;
begin
  insert into public.user_credits (user_id, balance) values (p_uid, 0) on conflict (user_id) do nothing;
  perform 1 from public.user_credits where user_id = p_uid for update;

  if public._credit_total(p_uid) < p_cost then
    raise exception 'insufficient_credits' using errcode = 'check_violation', hint = '크레딧이 부족해요.';
  end if;

  for v_lot in
    select id, remaining from public.credit_grants
    where user_id = p_uid and remaining > 0 and expires_at > now()
    order by expires_at
    for update
  loop
    exit when v_left = 0;
    v_take := least(v_left, v_lot.remaining);
    update public.credit_grants set remaining = remaining - v_take where id = v_lot.id;
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    update public.user_credits
      set balance = balance - v_left, updated_at = now()
      where user_id = p_uid and balance >= v_left
      returning balance into v_bal;
    if v_bal is null then
      raise exception 'insufficient_credits' using errcode = 'check_violation', hint = '크레딧이 부족해요.';
    end if;
  end if;

  insert into public.credit_transactions (user_id, delta, reason, ref_id)
  values (p_uid, -p_cost, p_reason, p_ref);

  return public._credit_total(p_uid);
end;
$$;

revoke execute on function public._credit_total(uuid) from anon, authenticated, public;
revoke execute on function public._spend_credits(uuid, integer, text, uuid) from anon, authenticated, public;

-- 화면용 잔액 — 클라이언트가 두 테이블을 따로 더하지 않아도 되게
create or replace function public.my_credit_total()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public._credit_total(auth.uid());
$$;
grant execute on function public.my_credit_total() to authenticated;

-- ------------------------------------------------ 가입 보너스 50 (30일 유효)
-- mentor_step.sql의 handle_new_user를 다시 정의한다. 보너스는 기한 없는 balance가
-- 아니라 30일짜리 묶음으로 준다.
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
  values (new.id, 0)
  on conflict (user_id) do nothing;

  insert into public.credit_grants (user_id, amount, remaining, reason, expires_at)
  values (new.id, 50, 50, 'signup_bonus', now() + interval '30 days');

  insert into public.credit_transactions (user_id, delta, reason)
  values (new.id, 50, 'signup_bonus');

  return new;
end;
$$;

-- ------------------------------------------------ 멘토 질문 (-10) — 묶음부터 쓰게
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

  -- 잔액이 모자라면 여기서 예외 → 위 insert도 함께 되돌려진다
  perform public._spend_credits(v_uid, 10, 'ask_question', v_row.id);

  return v_row;
end;
$$;

-- ------------------------------------------------ 매칭 목록 3개 더 보기 (-10)
-- list_key는 화면이 정한다: "과목|전공|학교" 모드·연세 전공·확정 학교 조합.
-- 필터(국가·관련도)는 키에 넣지 않는다 — 같은 목록을 거르는 것일 뿐이다.
create table if not exists public.match_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  list_key text not null check (char_length(list_key) <= 200),
  steps integer not null default 0 check (steps >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, list_key)
);

alter table public.match_unlocks enable row level security;
drop policy if exists match_unlocks_select_own on public.match_unlocks;
create policy match_unlocks_select_own on public.match_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.unlock_match_list(p_list_key text)
returns table (steps integer, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_bal integer;
  v_steps integer;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if p_list_key is null or btrim(p_list_key) = '' then
    raise exception 'list_key_required' using errcode = '22023';
  end if;

  v_bal := public._spend_credits(v_uid, 10, 'match_unlock', null);

  insert into public.match_unlocks as m (user_id, list_key, steps)
  values (v_uid, p_list_key, 1)
  on conflict (user_id, list_key) do update
    set steps = m.steps + 1, updated_at = now()
  returning m.steps into v_steps;

  return query select v_steps, v_bal;
end;
$$;
grant execute on function public.unlock_match_list(text) to authenticated;

-- ------------------------------------------------ 사진 1장 더 (-5)
-- 하루 무료 3장 한도 자체는 기기별 카운터(js/state.js)라 서버는 차감만 한다.
create or replace function public.spend_photo_credit()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  return public._spend_credits(v_uid, 5, 'photo_extra', null);
end;
$$;
grant execute on function public.spend_photo_credit() to authenticated;

-- ------------------------------------------ 프리미엄 결제 후: 기간 + 증정 크레딧
-- premium.sql의 grant_premium_after_payment를 다시 정의한다. 한 달에 100씩,
-- 결제한 기간만큼을 한 번에 주고 구독이 끝나는 시각에 사라지게 한다.
-- (달마다 나눠 주려면 pg_cron 같은 예약 작업이 필요하다 — 지금은 한 번에.)
create or replace function public.grant_premium_after_payment(p_user_id uuid, p_plan_id text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_months integer;
  v_row public.profiles;
begin
  select days into v_days from public.premium_plans where id = p_plan_id and active;
  if v_days is null then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;
  v_months := greatest(1, round(v_days / 30.0)::integer);

  update public.profiles
    set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => v_days)
    where id = p_user_id
    returning * into v_row;

  -- 구독 중에 기간을 늘렸다면 아직 남은 증정 크레딧도 새 만료일까지 같이 늘린다
  update public.credit_grants
    set expires_at = v_row.premium_until
    where user_id = p_user_id and reason = 'premium_bonus' and remaining > 0 and expires_at > now();

  insert into public.credit_grants (user_id, amount, remaining, reason, expires_at)
  values (p_user_id, 100 * v_months, 100 * v_months, 'premium_bonus', v_row.premium_until);

  insert into public.credit_transactions (user_id, delta, reason)
  values (p_user_id, 100 * v_months, 'premium_bonus');

  return v_row;
end;
$$;
revoke execute on function public.grant_premium_after_payment(uuid, text) from anon, authenticated, public;
