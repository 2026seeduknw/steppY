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
 * 비자·서류 체크리스트 (F4) — Supabase checklist_items 테이블(school_id 없이
 * 공통 항목)에서 채워지지만, 아직 실제로 채워 넣은 원본 자료가 없어 테이블이
 * 비어 있다. 학교마다 다른 실제 서류 요건 데이터가 아니라 일반적인 교환학생
 * 출국 준비 흐름을 보여주는 데모 콘텐츠 — Supabase에는 넣지 않고 여기 로컬
 * mock으로만 유지한다(진짜 서류 요건인 것처럼 보이면 안 되므로).
 * ------------------------------------------------------------------- */
MOCK.checklist = [
  { id: 'passport', title: '여권 유효기간 확인', done: false, dueOffset: 'D-90',
    detail: '출국일 기준으로 6개월 이상 유효기간이 남아있어야 해요. 만료가 임박했다면 지금 바로 재발급을 신청하세요.',
    source: 'steppY 가이드', updatedAt: '2026-01-01' },
  { id: 'visa', title: '학생비자 신청', done: false, dueOffset: 'D-75',
    detail: '파견 국가 영사관/대사관에 학생비자를 신청하세요. 국가별로 필요 서류와 처리 기간이 크게 다르니 학교 위치 확정 직후 바로 시작하는 게 안전해요.',
    source: 'steppY 가이드', updatedAt: '2026-01-01' },
  { id: 'transcript', title: '재학·성적증명서 발급', done: false, dueOffset: 'D-60',
    detail: '학교 포털에서 영문 재학증명서와 성적증명서를 발급받아 파견교 제출용으로 준비하세요.',
    source: 'steppY 가이드', updatedAt: '2026-01-01' },
  { id: 'insurance', title: '해외여행자보험 가입', done: false, dueOffset: 'D-45',
    detail: '파견 기간 전체를 커버하는 보험에 가입하세요. 파견교가 자체 보험(SHIP 등)을 요구하는 경우도 있으니 F4의 생활 준비 카드도 함께 확인하세요.',
    source: 'steppY 가이드', updatedAt: '2026-01-01' },
  { id: 'flight', title: '항공권 예약', done: false, dueOffset: 'D-30',
    detail: '오리엔테이션·기숙사 입주 일정에 맞춰 출국편을 예약하세요. 귀국편은 학기 종료일 확정 후 예약해도 늦지 않아요.',
    source: 'steppY 가이드', updatedAt: '2026-01-01' },
  { id: 'housing', title: '기숙사·숙소 신청', done: false, dueOffset: 'D-21',
    detail: '파견교 housing 포털에서 기숙사를 신청하거나, 자체적으로 숙소를 구하는 경우 계약서를 미리 확인하세요.',
    source: 'steppY 가이드', updatedAt: '2026-01-01' }
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
