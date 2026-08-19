-- 자동 생성됨: node supabase/generate-seed.js > supabase/seed.sql
-- mock-data.js 기준 시드 데이터 중, 아직 실제 데이터로 대체되지 않은 테이블만 대상.
-- schools/country_prep/yonsei_majors/yonsei_courses는 supabase/build_import.py +
-- supabase/generated/*.json (실제 2027-1 파견대학 원본) 기준으로 별도 적재함.

insert into checklist_items (id, title, due_offset, source, updated_at, detail, sort_order)
values
  ('c1', '출국신고서 제출', '출국 전', '연세대 국제처 2027-1학기 해외파견프로그램 안내', '2026-08-01', '국제처 포털에서 출국신고서를 작성 후 온라인 제출합니다. 파견 확정 학생 전원 필수 항목입니다.', 0),
  ('c2', '여행자보험 가입증명서 제출', '출국 1주 전까지', '연세대 국제처 2027-1학기 해외파견프로그램 안내 §7.4', '2026-08-01', '출국일 기준 전체 파견 기간을 포함하는 여행자보험에 가입하고, 가입증명서를 출국 1주 전까지 제출해야 합니다.', 1),
  ('c3', '비자/거주허가 신청', '국가별 상이 — 본인 확인 필요', '국가별 대사관·영사관 공지 (더블 체크 필요)', null, '비자 취득은 전적으로 학생 본인 책임입니다. 국가·목적(학생비자 등)별 요건이 달라 파견 확정 대학의 최신 공지를 반드시 재확인하세요.', 2),
  ('c4', '초과학기 등록 서약서 제출', '해당자만', '연세대 국제처 2027-1학기 해외파견프로그램 안내 §7.4', '2026-08-01', '마지막 학기(4년제 8학기/건축 5년제 10학기)에 파견되는 경우에만 제출이 필요합니다.', 3)
on conflict (id) do nothing;

insert into scholarships (name, amount, eligibility, sort_order)
values
  ('미래에셋 해외교환장학생', '학기당 아시아 550만원 / 그외 지역 750만원', '대한민국 국적, GPA 2.87/4.3↑, 소득분위 1~8분위', 0),
  ('글로벌리더 장학금', '학기당 400만원', '대한민국 국적, GPA 3.1/4.3↑, 학자금지원구간 3구간 이내', 1),
  ('교류활성화 장학금 (Go Abroad)', '학기당 200만원', '지정 교류활성화 대상 대학 파견 신규 교환학생 (매 학기 변동)', 2),
  ('이윤재 글로벌 인재 육성 장학금', '학기당 400만원', '일본 ICU 파견 신규 교환/방문학생 (자동 대상)', 3)
;

insert into living_prep (key, title, summary, caution)
values
  ('insurance', '여행자보험', '출국 1주 전까지 가입증명서 제출 의무 (§7.4)', '보장 범위·면책 조항은 상품마다 달라요. 반드시 약관을 직접 확인하세요.'),
  ('scholarship', '장학금', '자격에 맞는 장학금 최대 4종 확인 가능', '금액·자격 기준은 학기마다 변경될 수 있어요. 국제처 최신 공지를 더블 체크하세요.'),
  ('telecom', '통신사', '현지 유심/이심 및 로밍 비교 (확인 필요: 데이터 소스)', '학교 규정집에 없는 항목으로, 별도 제휴처 데이터 연동이 필요해요.'),
  ('bank', '계좌', '현지 계좌 개설 절차 안내 (확인 필요: 데이터 소스)', '은행 정책은 변경이 잦아 최신 정보 검증 프로세스가 필요해요.')
on conflict (key) do nothing;

insert into course_matches (id, school_id, home_course, target_course, similarity, matched_topics, note)
values
  ('m1', 'uva', '국제경영론 (3학점)', 'International Business Strategy (4 ECTS)', 86, ARRAY['글로벌 전략', '해외직접투자', '다국적기업 조직'], '핵심 주제 3/4 일치. 평가 방식(팀 프로젝트 비중)만 상이'),
  ('m2', 'amherst', '조직행동론 (3학점)', 'Organizational Behavior (3 credits)', 91, ARRAY['동기부여 이론', '리더십', '팀 다이내믹스'], '주차별 커리큘럼 순서까지 유사'),
  ('m3', 'nus', '데이터베이스 (3학점)', 'Database Systems (4 credits)', 74, ARRAY['관계형 모델', 'SQL', '트랜잭션'], '분산 데이터베이스 파트가 원 강의에 추가로 포함됨'),
  ('m4', 'lse', '미시경제학 (3학점)', 'Microeconomic Theory (3 credits)', 68, ARRAY['소비자이론', '게임이론 기초'], '수리적 난이도가 원 강의보다 높은 편, 선수 지식 확인 권장')
on conflict (id) do nothing;

insert into tips (school_id, title, summary)
values
  ('keio', '게이오 상경계열 꿀강 리스트', '출석 대신 기말 리포트 100%인 과목 위주로 정리했어요'),
  ('nus', 'NUS 경영대 조모임 꿀팁', '조모임 플랫폼은 대부분 Telegram, 초반 스케줄 조율이 관건')
;

insert into nearby_spots (school_id, title, summary)
values
  ('keio', '미타 캠퍼스 도보 15분, 시바공원', '벚꽃 시즌 로컬 피크닉 명소'),
  ('nus', '켄트리지에서 버스 20분, 클락키', '야경 명소이자 학생 모임 단골 장소')
;

