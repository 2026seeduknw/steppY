/**
 * Mock data — 백엔드/DB 없이도 페이지가 죽지 않게 하는 로컬 전용 상태의 기본값과,
 * Supabase가 아직 채워주지 않는 컬렉션의 빈 껍데기만 남아 있습니다.
 *
 * schools/checklist/scholarships/livingPrep/courseMatches/tips/nearbySpots/
 * yonseiMajors/visaRequirements는 전부 js/data-source.js가 Supabase에서 채웁니다
 * (SUPABASE_CONFIGURED가 false거나 네트워크 오류면 빈 상태로 남아요 — 예전처럼
 * 목업 문구로 대신 채우지 않습니다. §CLAUDE.md 참고).
 */

const MOCK = {};

/* ---------------------------------------------------------------------
 * 사용자 프로필 (§4.1) — 단일 프로필 엔티티로 F2/F4에서 공유.
 * 로그인 전이라 서버에 없고, js/state.js가 localStorage 초기값으로 사용.
 * ------------------------------------------------------------------- */
MOCK.defaultProfile = {
  name: '이서연',
  major: '경영학과',
  gpa: 3.62,
  gpaScale: 4.3,
  languageTests: [
    { type: 'TOEFL', score: 96 }
  ],
  exchangeTerm: { unit: 'semester', season: '가을학기', year: 2027 },
  targetScoreSimUsed: false
};

/* ---------------------------------------------------------------------
 * 오늘의 할 일 (§4.2) — F2/F4 공통, 최대 4개 노출.
 * 사용자별 로컬 상태 초기값(js/state.js)이라 Supabase 대상이 아님.
 * ------------------------------------------------------------------- */
MOCK.todos = [
  { id: 't1', title: '여행자보험 가입증명서 제출', date: '2027-01-05', done: false, tag: '서류' },
  { id: 't2', title: '온라인 지원서 최종 제출', date: '2026-09-20', done: false, tag: '지원' },
  { id: 't3', title: 'TOEFL 성적표 유효기간 확인', date: '2026-09-01', done: true, tag: '어학' },
  { id: 't4', title: '초과학기 등록 서약서 작성', date: '2027-01-10', done: false, tag: '서류' },
  { id: 't5', title: '출국신고서 제출', date: '2027-01-12', done: false, tag: '서류' }
];

/* ---------------------------------------------------------------------
 * 학교 데이터 (F3 검색/비교, F2/F4 지망·확정 카드) — Supabase schools 테이블
 * (271개교, 실제 2027-1 파견대학 원본)로 채워짐.
 * ------------------------------------------------------------------- */
MOCK.schools = [];

/* ---------------------------------------------------------------------
 * 국가별 비자 서류 정보 (F3 학교 상세 모달) — Supabase visa_requirements/
 * visa_documents 테이블에서 채워짐 (js/data-source.js::loadVisaRequirements).
 * ------------------------------------------------------------------- */
MOCK.visaRequirements = {};

/* ---------------------------------------------------------------------
 * 비자·서류 체크리스트 (F4) — 학교와 무관하게 누구에게나 같은 준비 항목.
 * 문구는 아래 sources의 공식 안내에 있는 내용만 옮겼다(2026-10 확인).
 * 마감(D-day)은 근거가 없어 두지 않는다 — 처리 기간은 문구에 적고, 언제
 * 시작할지는 학생이 출국일에 맞춰 정한다.
 *
 * dynamicSource가 있는 항목은 출처를 확정 학교 기준으로 화면에서 붙인다
 * (js/components/prepare-view.js):
 *   'visa'      파견국 주한 대사관·이민 당국 (visa_requirements, exchange-doc-crawler)
 *   'insurance' 국가별 보험 조사 자료 (country_prep)
 *   'school'    파견교 공식 사이트·OIA 학교 정보 (schools)
 * Supabase checklist_items 테이블은 비어 있어 이 목록이 쓰인다.
 * ------------------------------------------------------------------- */
MOCK.checklist = [
  { id: 'passport', title: '여권 유효기간 확인', done: false,
    detail: '입국할 때 요구하는 여권 잔여 유효기간은 나라마다 다르지만, 대체로 최종 여행일 기준 3~6개월이에요. 재발급은 정부24에서 온라인으로도 신청할 수 있고, 처리 기간은 근무일 기준 통상 8일이에요(성수기에는 늦어질 수 있어요).',
    sources: [
      { label: '외교부 여권안내', url: 'https://www.passport.go.kr/home/kor/contents.do?menuPos=7' },
      { label: '정부24 여권 발급', url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12600000001' },
      { label: '주스페인 대사관 · 여권 잔여 유효기간 안내', url: 'https://esp.mofa.go.kr/es-ko/brd/m_8086/view.do?seq=1327825' }
    ],
    checkedAt: '2026-10' },
  { id: 'visa', title: '학생비자 신청', done: false,
    detail: '파견 국가의 주한 대사관·이민 당국 안내에 따라 학생비자를 신청해요. 필요한 서류와 처리 기간은 나라마다 달라요.',
    dynamicSource: 'visa' },
  { id: 'transcript', title: '재학·성적증명서 발급', done: false,
    detail: '국문·영문 재학증명서와 성적증명서를 발급받을 수 있어요. 학사포탈에 로그인해 인터넷으로 바로 출력하면 무료이고, 백양누리 무인발급기나 언더우드관 B101호 종합서비스센터 창구(평일 9:00~17:20)에서도 받을 수 있어요(재학생 500원). 우편 발송도 되고, 해외는 EMS로 미국 기준 보통 3~5일 걸려요.',
    sources: [
      { label: '연세대 인터넷 증명 발급', url: 'https://www.yonsei.ac.kr/sc/405/subview.do' },
      { label: '연세대 FAQ · 증명서', url: 'https://www.yonsei.ac.kr/sc/302/subview.do' }
    ],
    checkedAt: '2026-10' },
  { id: 'insurance', title: '해외여행자보험 가입', done: false,
    detail: '파견 국가와 파견교가 요구하는 보험 조건을 확인하고 가입해요. 국가별 보험 정보는 아래 "생활 준비 — 준비물"의 보험 카드에 있어요.',
    dynamicSource: 'insurance' },
  { id: 'flight', title: '항공권 예약', done: false,
    detail: '파견교 오리엔테이션과 기숙사 입주 일정을 확인한 뒤 출국편을 예약해요.' },
  { id: 'housing', title: '기숙사·숙소 신청', done: false,
    detail: '기숙사 보장 여부와 신청 방법은 학교마다 달라요. 파견교 공식 사이트와 OIA 학교 정보에서 확인하세요.',
    dynamicSource: 'school' }
];

/* ---------------------------------------------------------------------
 * 생활 준비 정보 카드 (F4) — 보험/장학금/통신사/계좌. Supabase living_prep
 * 테이블에서 채워짐(장학금만 여기 해당 — 국가별 아님).
 * ------------------------------------------------------------------- */
MOCK.livingPrep = {};

/* 국가별 통신사/보험/계좌 실데이터 (32개국). Supabase country_prep 테이블에서
 * 채워짐. renderPrepareLiving()에서 확정 학교의 country_en으로 찾아 씀. */
MOCK.countryPrep = [];

/* Supabase scholarships 테이블에서 채워짐. */
MOCK.scholarships = [];

/* Supabase tips 테이블에서 채워짐. */
MOCK.tips = [];

/* Supabase nearby_spots 테이블에서 채워짐. */
MOCK.nearbySpots = [];

/* ---------------------------------------------------------------------
 * 멘토 없는 멘토 상담(F6) — 교환학생 경험보고서 기반 태그된 후기. Supabase
 * school_exchange_reports 테이블(188행, 실제 학교 id 기준)에서 채워짐.
 * ------------------------------------------------------------------- */
MOCK.schoolReviews = {};

/* ---------------------------------------------------------------------
 * Mentor's Step(F6) — 공개 질문·답변 게시판. Supabase mentor_questions/
 * mentor_answers 테이블(supabase/mentor_step.sql)에서 채워짐. 질문·답변은
 * 누구나 볼 수 있는 공개 글이라 사용자별 로컬 상태(js/state.js)가 아니라
 * 여기(MOCK)에 둔다 — 로그인한 본인이 새로 올린 질문/답변만 AppState.askQuestion/
 * submitAnswer가 이 배열에 직접 끼워 넣는다(js/state.js).
 * ------------------------------------------------------------------- */
MOCK.mentorQuestions = [];

/* ---------------------------------------------------------------------
 * BM 가격표 — Supabase credit_packages/premium_plans 테이블(supabase/premium.sql)
 * 에서 채워짐. 마이그레이션 전(또는 네트워크 실패)에는 이 자리표시자 가격이
 * 그대로 보인다 — DB 값과 동일하게 맞춰뒀다. 실제 금액은 PG 연동 시점에
 * DB 쪽만 바꾸면 된다(여기 값은 화면이 잠깐이라도 비어 보이지 않게 하는 fallback).
 * ------------------------------------------------------------------- */
// credits는 보너스를 포함한 총 지급량, bonus는 그중 덤으로 얹은 양(화면 표시용)
MOCK.creditPackages = [
  { id: 'credit_100',  credits: 100,  bonus: 0,   priceKrw: 1100,  label: '100 크레딧' },
  { id: 'credit_330',  credits: 330,  bonus: 30,  priceKrw: 3300,  label: '330 크레딧' },
  { id: 'credit_600',  credits: 600,  bonus: 100, priceKrw: 5500,  label: '600 크레딧' },
  { id: 'credit_1300', credits: 1300, bonus: 300, priceKrw: 11000, label: '1300 크레딧' }
];
MOCK.premiumPlans = [
  { id: 'premium_1m', days: 30,  priceKrw: 4400,  label: '프리미엄 1개월' },
  { id: 'premium_6m', days: 180, priceKrw: 22000, label: '프리미엄 6개월' }
];

/* ---------------------------------------------------------------------
 * 학교별 지원 서류 목록 — Supabase school_documents 테이블(999행, 실제
 * 학교 id 기준)에서 채워짐.
 * ------------------------------------------------------------------- */
MOCK.schoolDocuments = {};

/* ---------------------------------------------------------------------
 * F5. 학점 인정 — 강의계획서 유사도 비교. Supabase course_matches 테이블에서
 * 채워짐.
 * ------------------------------------------------------------------- */
MOCK.courseMatches = [];
MOCK.majorMatches = [];

/* ---------------------------------------------------------------------
 * 연세대 단과대학별 전공 마스터 리스트 — Supabase yonsei_majors 테이블
 * (76개, 실제 리스트)에서 채워짐.
 * ------------------------------------------------------------------- */
MOCK.yonseiMajors = [];

if (typeof module !== 'undefined') { module.exports = MOCK; }
