-- 개인위치정보 수집·이용·제공사실 확인자료 (위치정보법 제16조 제2항) — 2026-11-12
--
-- 기록 쓰기에서 GPS 위치를 쓸 때마다, 그리고 위치정보 이용에 동의할 때 한 줄씩 남긴다.
-- 좌표는 남기지 않는다 — 누가(user_id) 언제(used_at) 무엇을 위해(purpose) 어디로 보냈는지(provided_to)만.
--   purpose: 'journal_place_weather'(기록의 도시·날씨) | 'consent'(동의)
--
-- 보관: 6개월. 다만 동의를 철회하거나 탈퇴하면 지체 없이 지운다(위치정보법 제24조 제4항) —
--   철회: 앱이 본인 행을 지운다(아래 삭제 정책) / 탈퇴: auth.users 외래키 on delete cascade.
--
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행하면 된다. 여러 번 실행해도 안전하다.

create table if not exists public.location_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  purpose text not null check (purpose in ('journal_place_weather', 'consent')),
  provided_to text[] not null default '{}'
);
create index if not exists location_logs_user_idx on public.location_logs (user_id, used_at desc);

alter table public.location_logs enable row level security;

-- 본인 것만 남길 수 있고, 동의를 철회하면 본인 것을 지울 수 있다. 읽기는 운영자만(대시보드) —
-- 이용자의 열람 요청은 문의처로 받아 운영자가 조회해 알린다(위치기반서비스 이용약관 제7조).
drop policy if exists location_logs_insert_own on public.location_logs;
create policy location_logs_insert_own on public.location_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists location_logs_delete_own on public.location_logs;
create policy location_logs_delete_own on public.location_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 6개월이 지난 확인자료 정리. pg_cron 확장을 켜 두었다면 매일 새벽에 돌린다.
-- (켜지 않았다면 아래 delete 한 줄을 한 달에 한 번 SQL Editor에서 직접 실행한다)
--   create extension if not exists pg_cron;
--   select cron.schedule('location_logs_cleanup', '0 4 * * *',
--     $$delete from public.location_logs where used_at < now() - interval '6 months'$$);
delete from public.location_logs where used_at < now() - interval '6 months';
