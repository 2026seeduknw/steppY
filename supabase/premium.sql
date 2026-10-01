-- ============================================================
-- BM 환경 구축 1단계 — 크레딧 가격 / 프리미엄 해금
--
-- 아직 PG(결제대행사)를 정하지 않아 실제 결제는 붙어 있지 않다. 이 파일은
-- "결제가 끝나면 서버가 무엇을 해야 하는지"만 미리 만들어 둔다:
--   - 가격표(credit_packages / premium_plans)는 누구나 읽을 수 있어 화면에
--     그대로 띄울 수 있다.
--   - 실제 지급(grant_credits_after_payment / grant_premium_after_payment)은
--     authenticated에게 열어주지 않는다 — 클라이언트가 "결제했다"고 자기
--     입으로 부르면 공짜로 크레딧이 생기는 구멍이 된다. PG를 정하고 나면
--     결제 검증 서버(Edge Function 등, service_role 키 사용)에서만 불러야
--     한다. 지금은 Supabase 대시보드에서 관리자가 수동으로 부르는 용도.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- auth_schema.sql, mentor_step.sql이 먼저 적용돼 있어야 한다(profiles, user_credits 재사용).
-- ============================================================

-- ---------------------------------------------------------------- 프리미엄 상태
-- null이거나 과거 시각이면 비프리미엄. 만료 시각만 두면 "구독 중이었다가
-- 끝난" 이력도 따로 지우지 않고 자연스럽게 표현된다.
alter table public.profiles
  add column if not exists premium_until timestamptz;

-- ---------------------------------------------------------------- 가격표
-- 가격은 전부 자리표시자(placeholder)다 — 실제 금액은 PG 연동 시점에
-- 다시 정하고 update로 바꾼다. 화면은 이 테이블을 그대로 읽으므로
-- 여기 값만 바꾸면 코드를 고치지 않아도 가격이 바뀐다.
create table if not exists public.credit_packages (
  id text primary key,
  credits integer not null check (credits > 0),
  price_krw integer not null check (price_krw > 0),
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.premium_plans (
  id text primary key,
  days integer not null check (days > 0),
  price_krw integer not null check (price_krw > 0),
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

-- credits는 보너스를 포함한 총 지급량, bonus는 그중 덤(화면에 "+N 보너스"로 보인다)
alter table public.credit_packages add column if not exists bonus integer not null default 0;

-- 1크레딧 ≈ 11원. 큰 묶음일수록 보너스를 얹는다(10% / 20% / 30%).
-- do update라서 이 파일을 다시 실행하면 가격이 새 값으로 바뀐다.
insert into public.credit_packages (id, credits, bonus, price_krw, label, sort_order) values
  ('credit_100',  100,  0,   1100,  '100 크레딧',  1),
  ('credit_330',  330,  30,  3300,  '330 크레딧',  2),
  ('credit_600',  600,  100, 5500,  '600 크레딧',  3),
  ('credit_1300', 1300, 300, 11000, '1300 크레딧', 4)
on conflict (id) do update
  set credits = excluded.credits, bonus = excluded.bonus, price_krw = excluded.price_krw,
      label = excluded.label, sort_order = excluded.sort_order, active = true;

-- 예전 자리표시자 묶음은 지우지 않고 내린다(이미 팔린 기록이 id를 가리킬 수 있다)
update public.credit_packages set active = false where id in ('credit_300', 'credit_1500');

insert into public.premium_plans (id, days, price_krw, label, sort_order) values
  ('premium_1m', 30,  4400,  '프리미엄 1개월', 1),
  ('premium_6m', 180, 22000, '프리미엄 6개월', 2)
on conflict (id) do update
  set days = excluded.days, price_krw = excluded.price_krw, label = excluded.label,
      sort_order = excluded.sort_order, active = true;

alter table public.credit_packages enable row level security;
alter table public.premium_plans   enable row level security;

create policy credit_packages_public_read on public.credit_packages
  for select to anon, authenticated using (active);
create policy premium_plans_public_read on public.premium_plans
  for select to anon, authenticated using (active);

-- ------------------------------------------------------- credit_transactions 사유 확장
-- 기존 체크 제약(signup_bonus/ask_question/answer_reward)에 크레딧 구매를 추가한다.
alter table public.credit_transactions drop constraint if exists credit_transactions_reason_check;
alter table public.credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('signup_bonus', 'ask_question', 'answer_reward', 'purchase'));

-- --------------------------------------------------- 결제 완료 후 지급 (관리자/서버 전용)
-- 결제 검증이 끝난 뒤 호출한다고 가정한다 — 여기서는 결제 자체를 확인하지
-- 않는다(그건 PG 웹훅의 몫). anon/authenticated에게서 실행권을 회수해
-- 클라이언트가 직접 부를 수 없게 막는다.
create or replace function public.grant_credits_after_payment(p_user_id uuid, p_package_id text)
returns public.user_credits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credits integer;
  v_row public.user_credits;
begin
  select credits into v_credits from public.credit_packages where id = p_package_id and active;
  if v_credits is null then
    raise exception 'unknown_package' using errcode = '22023';
  end if;

  insert into public.user_credits (user_id, balance)
  values (p_user_id, v_credits)
  on conflict (user_id) do update
    set balance = public.user_credits.balance + v_credits, updated_at = now()
  returning * into v_row;

  insert into public.credit_transactions (user_id, delta, reason, ref_id)
  values (p_user_id, v_credits, 'purchase', null);

  return v_row;
end;
$$;

create or replace function public.grant_premium_after_payment(p_user_id uuid, p_plan_id text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_row public.profiles;
begin
  select days into v_days from public.premium_plans where id = p_plan_id and active;
  if v_days is null then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;

  update public.profiles
    -- 이미 프리미엄이면 남은 기간 위에 더한다 — 만료 전에 또 결제해도 손해가 없도록.
    set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => v_days)
    where id = p_user_id
    returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.grant_credits_after_payment(uuid, text) from anon, authenticated, public;
revoke execute on function public.grant_premium_after_payment(uuid, text) from anon, authenticated, public;
