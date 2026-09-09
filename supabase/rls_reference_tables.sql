-- ============================================================
-- 참고 데이터 테이블 RLS 잠금
--
-- anon 키는 클라이언트 JS(js/supabase-client.js)에 그대로 들어가므로 누구나 볼 수
-- 있다. RLS가 꺼진 public 테이블은 그 키만으로 읽기·쓰기·삭제가 전부 가능했다.
-- (Supabase 어드바이저 rls_disabled_in_public / ERROR)
--
-- "전부 공개 읽기"로 열지 않은 이유:
--   js/ 전체를 확인한 결과 클라이언트가 실제로 조회하는 건 school_exchange_reports
--   하나뿐이고, 나머지 6개(출처·산출근거·컬럼정의 등 문서성 테이블)는 참조가 0건이다.
--   읽을 필요가 없는 것은 정책 없이 잠그는 쪽이 안전하다. 나중에 화면에서 쓰게 되면
--   그때 SELECT 정책을 추가하면 된다.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 붙여넣고 Run.
-- (이미 적용된 프로젝트: iejxyrqjhqevbmgwcmwf)
-- ============================================================

-- ---- 클라이언트가 읽지 않는 6개: RLS만 켜고 정책 없음(= 완전 차단) ----
alter table public.country_prep_sources           enable row level security;
alter table public.country_prep_steps             enable row level security;
alter table public.school_livability_score_basis  enable row level security;
alter table public.livability_methodology_notes   enable row level security;
alter table public.livability_column_definitions  enable row level security;
alter table public.livability_coord_caveats       enable row level security;

-- ---- 클라이언트가 읽는 1개: 읽기만 허용, 쓰기·삭제는 차단 ----
-- js/data-source.js가 후기 챗봇(F6)과 학교 상세 모달에서 조회한다.
alter table public.school_exchange_reports enable row level security;

create policy school_exchange_reports_public_read
  on public.school_exchange_reports
  for select to anon, authenticated
  using (true);

-- ------------------------------------------------------------------ 검증
-- 소유자 기준 실제 행 수와 anon 기준 조회 결과를 비교하면 "차단"과 "원래 비어 있음"을
-- 구분할 수 있다. 아래는 적용 직후 실측값이다.
--
--   owner : prep_sources 150 / prep_steps 96 / score_basis 262 /
--           method_notes 8 / col_defs 31 / coord_caveats 4 / exchange_reports 0
--   anon  : prep_steps 0, coord_caveats 0  → 차단됨
--           schools 271                    → 정상 조회(기존 정책 유지)
--
-- anon INSERT 시도 → 42501: new row violates row-level security policy
