-- ============================================================
-- Mentor's Step — 국가 즐겨찾기
--
-- 별표한 국가(한글 국가명)를 profiles 한 칸에 배열로 둔다. 사람마다 몇 개
-- 안 되는 짧은 목록이라 별도 테이블 대신 한 칸이면 충분하다. profiles는
-- 이미 "자기 행만 읽기/쓰기" RLS가 걸려 있어 정책을 따로 만들 필요가 없다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- ============================================================
alter table public.profiles
  add column if not exists favorite_countries text[] not null default '{}';
