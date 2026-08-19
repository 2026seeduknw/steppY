-- ============================================================
-- 날개가방(exchange-prep-demo) 참고 데이터 스키마 — v2
--
-- v1(mock-data.js 12개교 기준)을 실제 2027-1 파견대학 원본 데이터
-- (공유용.zip, 263개교 + QS + 물가/이동지수 + 기숙사비 + 국가별 보험/통신/계좌
-- + 연세대 전공/개설과목)로 교체한 버전. supabase/build_import.py로 생성한
-- supabase/generated/*.json을 이 스키마에 맞춰 적재함.
--
-- 지금은 로그인 이전 단계라 전부 "누구나 읽기 가능(public SELECT)" 데이터예요.
-- 프로필/지망·즐겨찾기/확정 학교/할일처럼 사용자별로 달라지는 데이터는 아직
-- localStorage에 남아 있고 이 스키마에는 없습니다.
--
-- 알려진 한계:
--   - checklist_items / scholarships / living_prep / course_matches / tips /
--     nearby_spots 는 실제 데이터로 대체된 게 아직 없어 mock-data.js 기준 그대로 유지.
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣고 Run.
-- ============================================================

-- ---- 파견대학 (263개교 + UC 9개 캠퍼스 분리 = 271행) ----
create table if not exists schools (
  id                            text primary key,
  name                          text not null,
  name_ko                       text,
  country_en                    text not null,
  country_ko                    text,
  continent                     text,
  region_ko                     text,
  city                          text,
  lat                           double precision,
  lng                           double precision,
  qs_rank                       integer,
  open_undergrad                boolean,
  open_grad                     boolean,
  quota                         numeric,
  quota_unit                    text,
  academic_system               text,
  language                      text,
  track                         text check (track in ('english', 'nonEnglish')),
  toefl_ibt                     text,
  toefl_subscores               text,
  language_level                text,
  language_notes                text,
  gpa_required                  numeric(3,2),
  fall_available                boolean,
  fall_calendar_year            boolean,
  spring_available              boolean,
  spring_calendar_year          boolean,
  fall_nomination_deadline      text,
  fall_application_deadline     text,
  spring_nomination_deadline    text,
  spring_application_deadline   text,
  available_areas               text,
  restricted_areas              text,
  admission_notes               text,
  housing_guaranteed            text, -- 'Yes' | 'No' | 'Partial' | null
  housing_info                  text,
  scholarship_note              text,
  notice_from_oia               text,
  transcript_note               text,
  website                       text,
  factsheet_url                 text,
  detail_link                   text,
  security_score                numeric check (security_score between 0 and 100), -- 2027-1_치안.xlsx 최종 치안점수 (Numbeo+GPI+외교부 여행경보 가중합)
  security_level                text check (security_level in ('high', 'medium', 'low')), -- 치안 등급(매우양호·양호→high, 보통→medium, 주의·고위험→low) 원본이 '산출불가'면 null
  cost_score                    numeric,
  commerce_score                numeric,
  mobility_score                numeric,
  travel_mobility_score         numeric,
  overall_ref_score             numeric,
  monthly_living_cost_usd       numeric,
  monthly_living_cost_krw       numeric,
  dorm_currency                 text,
  dorm_semester_avg_local       numeric,
  dorm_semester_avg_krw         numeric,
  dorm_confidence               text,
  updated_at                    timestamptz not null default now()
);

-- ---- 국가별 통신/보험/계좌 준비 정보 (32개국) ----
create table if not exists country_prep (
  id                     serial primary key,
  region                 text,
  country_en             text not null,
  country_ko             text,
  dispatch_school_count  integer,
  telecom_recommend      text,
  telecom_price          text,
  telecom_note           text,
  telecom_source         text,
  insurance              text,
  insurance_price        text,
  insurance_note         text,
  insurance_source       text,
  bank_recommend         text,
  account_docs           text,
  bank_note_source       text,
  confidence_grade       text,
  survey_date            date
);

-- ---- 연세대 단과대학별 전공 리스트 (76개 전공) ----
create table if not exists yonsei_majors (
  id          serial primary key,
  sort_order  integer,
  college     text not null,
  division    text,
  major_name  text not null
);

-- ---- 연세대 2026학년도 개설과목 (신촌캠퍼스, 9765개 — 학점인정 매칭 F5용 참고자료) ----
create table if not exists yonsei_courses (
  id           serial primary key,
  semester     text,
  year         integer,
  campus       text,
  college      text,
  department   text,
  course_id    text, -- 학정번호(분반 포함) — 같은 과목이 복수 학과에 교차개설되어 유일값 아님
  course_code  text,
  section      text,
  course_name  text not null,
  credits      numeric,
  instructor   text,
  class_time   text,
  classroom    text,
  language     text,
  grading      text
);
create index if not exists yonsei_courses_course_id_idx on yonsei_courses(course_id);
create index if not exists yonsei_courses_department_idx on yonsei_courses(department);

-- ---- 비자·서류 체크리스트 (F4) — 학교와 무관한 공통 항목 (아직 mock 유지) ----
create table if not exists checklist_items (
  id          text primary key,
  title       text not null,
  due_offset  text,
  source      text,
  updated_at  date,
  detail      text,
  sort_order  integer not null default 0
);

-- 장학금 (F4) — 아직 mock 유지
create table if not exists scholarships (
  id          serial primary key,
  name        text not null,
  amount      text not null,
  eligibility text not null,
  sort_order  integer not null default 0
);

-- 생활 준비 카드 — 보험/장학금/통신사/계좌 (F4) — 아직 mock 유지 (country_prep으로 대체는 후속 작업)
create table if not exists living_prep (
  key      text primary key, -- 'insurance' | 'scholarship' | 'telecom' | 'bank'
  title    text not null,
  summary  text not null,
  caution  text not null
);

-- 강의계획서 유사도 비교 (F5) — 아직 mock 유지 (host측 과목 원본 데이터가 없어 실매칭 불가)
-- school_id는 mock 시절 학교 id(uwash 등) 기준이라 실제 schools.id(슬러그)와 안 맞음 —
-- 의도적으로 FK 없이 text로만 둠. 실제 학교에 맞는 예시가 큐레이션되면 그때 매핑.
create table if not exists course_matches (
  id              text primary key,
  school_id       text not null,
  home_course     text not null,
  target_course   text not null,
  similarity      integer not null check (similarity between 0 and 100),
  matched_topics  text[] not null default '{}',
  note            text
);

-- 전공 매칭 (F-신규) — 연세대 전공 -> 해외 파견교 전공 유사도 매칭.
-- major-matching 파이프라인(seed/major-matching, multilingual embedding + CIP taxonomy
-- hybrid ranking)이 majors.csv를 실제 schools 원본과 동일한 university name 기준으로
-- 만들어서 school_id/korean_major_id 모두 실제 FK가 걸린다 — school_id는 mock id 문제가
-- 있던 course_matches와 달리 처음부터 정확한 값이라 FK를 둔다.
create table if not exists major_matches (
  id               text primary key,
  korean_major_id  integer not null references yonsei_majors(id),
  home_major       text not null,
  school_id        text not null references schools(id),
  target_major     text not null,
  similarity       integer not null check (similarity between 0 and 100),
  semantic_score   numeric not null,
  taxonomy_score   numeric not null,
  matched_topics   text[] not null default '{}',
  note             text,
  rank             integer not null
);
create index if not exists major_matches_korean_major_id_idx on major_matches(korean_major_id);
create index if not exists major_matches_school_id_idx on major_matches(school_id);

-- 꿀강 (F4) — 아직 mock 유지, school_id FK 없음 (위 course_matches와 동일한 이유)
create table if not exists tips (
  id         serial primary key,
  school_id  text not null,
  title      text not null,
  summary    text not null
);

-- 주변 가볼만한 곳 (F4) — 아직 mock 유지, school_id FK 없음 (위와 동일)
create table if not exists nearby_spots (
  id         serial primary key,
  school_id  text not null,
  title      text not null,
  summary    text not null
);

-- ---- RLS: 전부 공개 참고 데이터 — 읽기는 누구나, 쓰기는 서비스 롤(대시보드/서버)에서만 ----
alter table schools           enable row level security;
alter table country_prep      enable row level security;
alter table yonsei_majors     enable row level security;
alter table yonsei_courses    enable row level security;
alter table checklist_items   enable row level security;
alter table scholarships      enable row level security;
alter table living_prep       enable row level security;
alter table course_matches    enable row level security;
alter table tips              enable row level security;
alter table nearby_spots      enable row level security;
alter table major_matches     enable row level security;

create policy "public read" on schools         for select using (true);
create policy "public read" on country_prep     for select using (true);
create policy "public read" on yonsei_majors    for select using (true);
create policy "public read" on yonsei_courses   for select using (true);
create policy "public read" on checklist_items  for select using (true);
create policy "public read" on scholarships     for select using (true);
create policy "public read" on living_prep      for select using (true);
create policy "public read" on course_matches   for select using (true);
create policy "public read" on tips             for select using (true);
create policy "public read" on nearby_spots     for select using (true);
create policy "public read" on major_matches    for select using (true);
