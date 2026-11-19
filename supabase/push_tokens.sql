-- ============================================================
-- 푸시 알림 — 기기 토큰(알림을 보낼 "주소") 저장
--
-- 흐름
--   1) 앱(js/push.js)이 알림 권한을 받으면 iOS가 기기 토큰을 준다.
--   2) 앱이 register_push_token()으로 그 토큰을 "지금 로그인한 사람" 것으로 저장한다.
--   3) 알림은 Edge Function(supabase/functions/send-push)이 이 표를 읽어 보낸다.
--   4) 로그아웃하면 unregister_push_token()으로 이 기기 토큰을 지운다
--      (다른 사람 알림이 이 폰으로 오면 안 되니까).
--   계정을 지우면 auth.users on delete cascade로 같이 사라진다.
--
-- 왜 표에 직접 쓰지 않고 함수로 쓰나
--   같은 폰에서 A가 로그아웃하고 B가 로그인하면, 토큰은 같은데 주인이 바뀐다.
--   RLS 정책(user_id = auth.uid())으로는 "남의 행"을 내 것으로 바꿀 수 없어서
--   upsert가 막힌다. 그래서 security definer 함수가 토큰 주인을 호출자로 덮어쓴다.
--   클라이언트는 표를 읽을 수도 쓸 수도 없다 — 함수 두 개만 열어 둔다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- (2026-11-19 MCP로 원격 프로젝트에 이미 적용함 — 다시 돌려도 안전하다)
-- ============================================================

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- 정책을 하나도 두지 않는다 = anon/authenticated는 직접 접근 불가.
-- service_role(Edge Function)은 RLS를 건너뛰므로 읽고 지울 수 있다.
revoke all on public.push_tokens from anon, authenticated;

-- ---------------------------------------------------------------- 등록
create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  -- APNs 토큰은 64자 hex, FCM 토큰은 150자 안팎. 그 밖의 길이는 잘못 들어온 값이다.
  if p_token is null or length(p_token) < 32 or length(p_token) > 512 then
    raise exception 'invalid_token';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), coalesce(p_platform, 'ios'))
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------- 해제 (로그아웃)
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens
  where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;
