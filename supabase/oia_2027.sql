-- ============================================================
-- 국제처 2027-2 안내 반영 (docs/oia/2027F_product_notes.md)
--
--   1) 희망대학표 — 1~3지망 → 최대 25개, 학교마다 지원 학과·파견 기간
--   2) 프로필 학적 정보 — 과정·계열·이수 학기·편입·백분위·어학 면제 등
--   3) 학교 목록이 어느 학기 명단인지
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- 여러 번 돌려도 안전하다(if not exists / 제약 이름 확인).
--
-- 이 파일을 돌리기 전에도 앱은 깨지지 않는다(js/state.js):
--   - 희망대학표는 1~3순위만 서버에 저장되고 4순위부터는 저장 실패 안내가 뜬다.
--   - 학적 정보는 저장되지 않고 조용히 넘어간다(다른 프로필 값은 그대로 저장).
-- ============================================================

-- ------------------------------------------------------------ 1) 희망대학표
do $$
declare c text;
begin
  -- auth_schema.sql 의 인라인 check(rank between 1 and 3)는 이름이 자동으로 붙는다 — 찾아서 지운다
  for c in
    select con.conname from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'user_wishlist' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%rank%'
  loop
    execute format('alter table public.user_wishlist drop constraint %I', c);
  end loop;
end $$;

alter table public.user_wishlist
  add constraint user_wishlist_rank_range check (rank between 1 and 25);

-- 학교마다 고르는 지원 학과(파견교 학과명, 자유 입력)와 파견 기간(1 = 한 학기·두 쿼터, 2 = 1년)
alter table public.user_wishlist add column if not exists apply_major text;
alter table public.user_wishlist add column if not exists apply_length smallint
  check (apply_length is null or apply_length in (1, 2));

-- ------------------------------------------------------------ 2) 학적 정보
-- 화면에서 다루는 모양(js/state.js profile.academic):
--   { degree: 'undergrad'|'master'|'doctor', field: 'humsoc'|'sci',
--     semesters: 지원 시점 이수 학기 수, transfer: null|'2'|'3',
--     percentile: 성적표 백분위, langExempt: bool, lastSemester: bool }
alter table public.profiles add column if not exists academic jsonb;

-- ------------------------------------------------------------ 3) 학교 목록 학기
-- 지금 들어 있는 271곳은 2027-1 명단이다. 2027-2 명단(2026-12-15 공지)을 가져오면
-- build_import.py 결과를 넣은 뒤 term 을 '2027-2' 로 바꾼다.
alter table public.schools add column if not exists term text default '2027-1';
update public.schools set term = '2027-1' where term is null;
