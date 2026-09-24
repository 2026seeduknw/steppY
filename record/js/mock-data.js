/**
 * Mock data — 백엔드/DB/실제 API 없이 클릭 데모를 구동하기 위한 정적 데이터.
 * §7 세부 규정(연세대 국제처 2027-1 기준)을 참고해 현실적인 값 범위로 작성했습니다.
 * 실제 서비스에서는 대학별 규정 데이터를 관리하는 CMS/DB로 대체되어야 합니다.
 */

const MOCK = {};

/* ---------------------------------------------------------------------
 * 사용자 프로필 (§4.1) — 단일 프로필 엔티티로 F2/F4에서 공유
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
 * 국가 목록 — F1 상단 마퀴(스플릿플랩)용
 * ------------------------------------------------------------------- */
MOCK.countries = [
  '미국', '영국', '독일', '프랑스', '일본', '중국', '네덜란드', '싱가포르',
  '캐나다', '스웨덴', '스페인', '호주', '대만', '이탈리아', '스위스', '핀란드'
];

/* ---------------------------------------------------------------------
 * 학교 데이터 (F3 검색/비교, F2/F4 지망·확정 카드)
 * ------------------------------------------------------------------- */
MOCK.schools = [
  {
    id: 'uwash', lat: 39.2098, lng: -76.0658,
    scores: { security: 85, costOfLiving: 70, commerce: 35, transitMobility: 30, travelMobility: 25 },
    logo: null,
    name: 'Washington College',
    nameKo: '워싱턴 칼리지',
    country: '미국', region: '북미', city: '체스터타운',
    qsRank: 421, slot: 4,
    track: 'english', langTest: { type: 'TOEFL', cut: 79 }, gpaCut: 3.0,
    majors: ['경영학과', '경제학과', '국제학부'],
    seasons: ['봄학기', '가을학기'],
    climate: {
      '봄학기': '한국의 4월과 비슷한 선선한 날씨예요',
      '가을학기': '한국의 10월과 비슷해요. 일교차가 큰 편이에요'
    },
    security: '치안 상, 대학 자체 셔틀 운영으로 야간 이동도 비교적 안전', securityLevel: 'high',
    access: '소도시라 상권은 크지 않지만 캠퍼스 중심 생활에 적합, 도보 10분 내 다운타운', commerceLevel: 'low', climateType: 'four-season',
    creditRecommend: ['국제경영론', '거시경제학', '조직행동론'],
    reviews: ['기숙사 식비가 저렴한 편', '작은 마을이라 차 없이도 생활 가능'],
    wishlistCount: { rank1: 3, total: 11 },
    officialLink: 'https://www.washcoll.edu',
    mapNote: '메릴랜드주 동부, 워싱턴 D.C.에서 차로 약 2시간'
  },
  {
    id: 'amherst', lat: 42.3732, lng: -72.5199,
    scores: { security: 88, costOfLiving: 55, commerce: 50, transitMobility: 35, travelMobility: 45 },
    logo: null,
    name: 'Amherst College',
    nameKo: '애머스트 칼리지',
    country: '미국', region: '북미', city: '애머스트',
    qsRank: 198, slot: 2,
    track: 'english', langTest: { type: 'TOEFL', cut: 100 }, gpaCut: 3.4,
    majors: ['경영학과', '경제학과', '심리학과', '영어영문학과'],
    seasons: ['가을학기'],
    climate: { '가을학기': '한국의 11월과 비슷해요. 단풍이 아름다운 시기예요' },
    security: '대학촌 특성상 치안이 매우 안정적', securityLevel: 'high',
    access: '보스턴까지 버스로 2시간, 캠퍼스 도보권에 카페·서점 밀집', commerceLevel: 'medium', climateType: 'four-season',
    creditRecommend: ['미시경제학', '통계학개론'],
    reviews: ['수업 난이도가 높은 편, 발표·토론 비중 큼', '기숙사 룸메이트 랜덤 배정'],
    wishlistCount: { rank1: 6, total: 14 },
    officialLink: 'https://www.amherst.edu',
    mapNote: '매사추세츠주 서부, 보스턴에서 북서쪽으로 약 145km'
  },
  {
    id: 'lse', lat: 51.5144, lng: -0.116,
    scores: { security: 60, costOfLiving: 25, commerce: 90, transitMobility: 92, travelMobility: 88 },
    logo: null,
    name: 'London School of Economics and Political Science (LSE)',
    nameKo: '런던정경대학',
    country: '영국', region: '유럽', city: '런던',
    qsRank: 45, slot: 2,
    track: 'english', langTest: { type: 'TOEFL', cut: 100 }, gpaCut: 3.6,
    majors: ['경영학과', '경제학과', '정치외교학과', '국제학부'],
    seasons: ['가을학기', '봄학기'],
    climate: {
      '가을학기': '한국의 초겨울처럼 흐리고 쌀쌀해요, 우산 필수',
      '봄학기': '한국의 3월 같은 날씨, 비가 잦은 편이에요'
    },
    security: '도심 대학 특성상 소지품 관리 주의, 야간 혼자 이동 비권장 구역 있음', securityLevel: 'medium',
    access: '지하철 3개 노선 도보권, 상권·문화시설 풍부', commerceLevel: 'high', climateType: 'four-season',
    creditRecommend: ['국제금융론', '계량경제학', '정치경제학'],
    reviews: ['생활비가 매우 높은 편(특히 주거비)', '전세계 학생 네트워킹에 강점'],
    wishlistCount: { rank1: 9, total: 21 },
    officialLink: 'https://www.lse.ac.uk',
    mapNote: '런던 중심부 홀본 지역'
  },
  {
    id: 'keio', lat: 35.6484, lng: 139.7454,
    scores: { security: 90, costOfLiving: 45, commerce: 88, transitMobility: 95, travelMobility: 75 },
    logo: null,
    name: 'Keio University',
    nameKo: '게이오기주쿠대학',
    country: '일본', region: '아시아', city: '도쿄',
    qsRank: 179, slot: 6,
    track: 'nonEnglish', langTest: { type: 'JLPT', cut: 'N2' }, gpaCut: 2.9,
    majors: ['경영학과', '상경계열', '국제학부'],
    seasons: ['봄학기', '가을학기'],
    climate: {
      '봄학기': '한국의 4월과 비슷해요, 벚꽃 시즌과 겹쳐요',
      '가을학기': '한국의 9월 같은 늦더위가 조금 남아있어요'
    },
    security: '치안 매우 우수, 심야 이동도 비교적 안전한 편', securityLevel: 'high',
    access: '미타역 도보 1분, 상권·편의시설 최상급', commerceLevel: 'high', climateType: 'four-season',
    creditRecommend: ['일본경제론', '마케팅원론', '조직행동론'],
    reviews: ['주거비가 높은 편, 기숙사 경쟁 치열', '동아리(서클) 활동이 활발함'],
    wishlistCount: { rank1: 5, total: 17 },
    officialLink: 'https://www.keio.ac.jp',
    mapNote: '도쿄 미나토구 미타 캠퍼스'
  },
  {
    id: 'nus', lat: 1.2966, lng: 103.7764,
    scores: { security: 93, costOfLiving: 35, commerce: 85, transitMobility: 90, travelMobility: 85 },
    logo: null,
    name: 'National University of Singapore',
    nameKo: '싱가포르국립대학',
    country: '싱가포르', region: '아시아', city: '싱가포르',
    qsRank: 8, slot: 3,
    track: 'english', langTest: { type: 'TOEFL', cut: 88 }, gpaCut: 3.5,
    majors: ['경영학과', '컴퓨터공학과', '경제학과'],
    seasons: ['가을학기', '봄학기'],
    climate: {
      '가을학기': '한국의 한여름과 비슷해요, 일년 내내 고온다습',
      '봄학기': '역시 무더운 편이에요, 스콜성 소나기에 대비하세요'
    },
    security: '치안 매우 우수, 아시아 최상위권', securityLevel: 'high',
    access: '지하철(MRT) 인접, 대형 쇼핑몰 다수', commerceLevel: 'high', climateType: 'hot',
    creditRecommend: ['데이터베이스', '국제경영전략', '미시경제학'],
    reviews: ['물가가 높은 편(특히 외식)', '영어 강의 비중 100%'],
    wishlistCount: { rank1: 8, total: 19 },
    officialLink: 'https://www.nus.edu.sg',
    mapNote: '싱가포르 켄트리지 지역'
  },
  {
    id: 'fudan', lat: 31.2989, lng: 121.503,
    scores: { security: 72, costOfLiving: 65, commerce: 65, transitMobility: 80, travelMobility: 55 },
    logo: null,
    name: 'Fudan University',
    nameKo: '푸단대학',
    country: '중국', region: '아시아', city: '상하이',
    qsRank: 34, slot: 5,
    track: 'nonEnglish', langTest: { type: 'HSK', cut: '5급' }, gpaCut: 2.9,
    majors: ['경영학과', '중어중문학과', '국제학부'],
    seasons: ['봄학기', '가을학기'],
    climate: {
      '봄학기': '한국의 5월과 비슷해요, 습도가 조금 더 높아요',
      '가을학기': '한국의 10월과 비슷하지만 미세먼지에 유의하세요'
    },
    security: '치안 양호, 다만 관광지 인파 밀집 지역 소지품 주의', securityLevel: 'medium',
    access: '지하철 2개 노선 인접, 대형 상권 도보권', commerceLevel: 'medium', climateType: 'four-season',
    creditRecommend: ['중국경제론', '국제무역론'],
    reviews: ['현지 결제는 모바일페이 필수(위챗페이/알리페이)', '기숙사 시설 최신화됨'],
    wishlistCount: { rank1: 2, total: 8 },
    officialLink: 'https://www.fudan.edu.cn',
    mapNote: '상하이 양푸구 한단 캠퍼스'
  },
  {
    id: 'uva', lat: 52.3676, lng: 4.9041,
    scores: { security: 68, costOfLiving: 40, commerce: 82, transitMobility: 85, travelMobility: 92 },
    logo: null,
    name: 'University of Amsterdam',
    nameKo: '암스테르담대학교',
    country: '네덜란드', region: '유럽', city: '암스테르담',
    qsRank: 55, slot: 4,
    track: 'english', langTest: { type: 'TOEFL', cut: 92 }, gpaCut: 3.2,
    majors: ['경영학과', '경제학과', '사회학과'],
    seasons: ['가을학기'],
    climate: { '가을학기': '한국의 11월처럼 흐리고 바람이 많이 불어요' },
    security: '치안 양호, 자전거 도난만 주의', securityLevel: 'medium',
    access: '트램·자전거 인프라 최상급, 도심 전체가 상권', commerceLevel: 'high', climateType: 'four-season',
    creditRecommend: ['유럽경제통합론', '국제마케팅'],
    reviews: ['기숙사 배정이 늦게 확정되는 편', '자전거 구매 필수'],
    wishlistCount: { rank1: 4, total: 12 },
    officialLink: 'https://www.uva.nl',
    mapNote: '암스테르담 시내 로에티스담 캠퍼스'
  },
  {
    id: 'kth', lat: 59.3498, lng: 18.0687,
    scores: { security: 85, costOfLiving: 35, commerce: 55, transitMobility: 82, travelMobility: 70 },
    logo: null,
    name: 'KTH Royal Institute of Technology',
    nameKo: 'KTH 왕립공과대학',
    country: '스웨덴', region: '유럽', city: '스톡홀름',
    qsRank: 87, slot: 3,
    track: 'english', langTest: { type: 'TOEFL', cut: 90 }, gpaCut: 3.3,
    majors: ['컴퓨터공학과', '전기전자공학과', '기계공학과'],
    seasons: ['가을학기', '봄학기'],
    climate: {
      '가을학기': '한국보다 해가 짧아지는 속도가 빨라요, 방한용품 필수',
      '봄학기': '한국의 초봄처럼 쌀쌀하지만 백야가 시작돼요'
    },
    security: '치안 우수, 대중교통 야간 운행도 안정적', securityLevel: 'high',
    access: '지하철(Tunnelbana) 인접, 학생 할인 폭 넓음', commerceLevel: 'medium', climateType: 'cold',
    creditRecommend: ['알고리즘', '임베디드시스템'],
    reviews: ['그룹 프로젝트 비중이 매우 큼', '생활비는 높지만 학생 보조금 다양'],
    wishlistCount: { rank1: 3, total: 9 },
    officialLink: 'https://www.kth.se',
    mapNote: '스톡홀름 시내 발할라베겐 인근'
  },
  {
    id: 'ubc', lat: 49.2606, lng: -123.246,
    scores: { security: 87, costOfLiving: 45, commerce: 58, transitMobility: 60, travelMobility: 50 },
    logo: null,
    name: 'The University of British Columbia',
    nameKo: 'UBC',
    country: '캐나다', region: '북미', city: '밴쿠버',
    qsRank: 41, slot: 5,
    track: 'english', langTest: { type: 'TOEFL', cut: 90 }, gpaCut: 3.1,
    majors: ['컴퓨터공학과', '경영학과', '환경학과'],
    seasons: ['가을학기', '봄학기'],
    climate: {
      '가을학기': '한국의 늦가을과 비슷해요, 비가 잦아요',
      '봄학기': '한국의 초봄처럼 온화한 편이에요'
    },
    security: '치안 우수, 캠퍼스 자체가 반도에 위치해 안전한 편', securityLevel: 'high',
    access: '버스 중심 대중교통, 시내까지 30분 내외', commerceLevel: 'medium', climateType: 'mild-winter',
    creditRecommend: ['데이터구조', '환경정책론'],
    reviews: ['한국인 교환학생 커뮤니티가 활발함', '날씨가 흐린 날이 많음'],
    wishlistCount: { rank1: 5, total: 13 },
    officialLink: 'https://www.ubc.ca',
    mapNote: '밴쿠버 포인트그레이 반도'
  },
  {
    id: 'unimelb', lat: -37.7963, lng: 144.9614,
    scores: { security: 85, costOfLiving: 50, commerce: 78, transitMobility: 85, travelMobility: 40 },
    logo: null,
    name: 'University of Melbourne',
    nameKo: '멜버른대학교',
    country: '호주', region: '오세아니아', city: '멜버른',
    qsRank: 13, slot: 4,
    track: 'english', langTest: { type: 'TOEFL', cut: 79 }, gpaCut: 3.0,
    majors: ['경영학과', '심리학과', '법학과'],
    seasons: ['봄학기', '가을학기'],
    climate: {
      '봄학기': '남반구라 계절이 반대예요. 한국의 가을 같은 날씨',
      '가을학기': '한국의 봄 같은 날씨지만 하루에도 날씨가 자주 바뀌어요'
    },
    security: '치안 우수, 대중교통 야간 운행 시간대만 확인 필요', securityLevel: 'high',
    access: '트램망이 도시 전체를 촘촘히 연결, 상권 풍부', commerceLevel: 'high', climateType: 'four-season',
    creditRecommend: ['소비자행동론', '국제법개론'],
    reviews: ['남반구라 학사일정이 국내와 반대(입학·방학 시기 유의)', '워킹홀리데이 학생과 교류 많음'],
    wishlistCount: { rank1: 4, total: 10 },
    officialLink: 'https://www.unimelb.edu.au',
    mapNote: '멜버른 파크빌 캠퍼스'
  },
  {
    id: 'ntu-tw', lat: 25.0174, lng: 121.5405,
    scores: { security: 92, costOfLiving: 78, commerce: 80, transitMobility: 88, travelMobility: 65 },
    logo: null,
    name: 'National Taiwan University',
    nameKo: '국립대만대학',
    country: '대만', region: '아시아', city: '타이베이',
    qsRank: 68, slot: 6,
    track: 'nonEnglish', langTest: { type: 'HSK', cut: '4급' }, gpaCut: 2.8,
    majors: ['경영학과', '전자공학과', '중어중문학과'],
    seasons: ['가을학기', '봄학기'],
    climate: {
      '가을학기': '한국의 초가을과 비슷하지만 습도가 높아요',
      '봄학기': '한국의 늦봄 같아요, 우기가 시작될 수 있어요'
    },
    security: '치안 매우 우수, 심야 편의점·야시장 이용도 안전', securityLevel: 'high',
    access: '지하철(MRT) 촘촘, 야시장 등 상권 풍부하고 물가 저렴', commerceLevel: 'high', climateType: 'hot',
    creditRecommend: ['중국어권 비즈니스', '반도체개론'],
    reviews: ['오토바이 교통 밀도가 높아 도로 횡단 주의', '생활 물가가 저렴한 편'],
    wishlistCount: { rank1: 2, total: 7 },
    officialLink: 'https://www.ntu.edu.tw',
    mapNote: '타이베이 다안구 캠퍼스'
  },
  {
    id: 'sciencespo', lat: 48.8534, lng: 2.3269,
    scores: { security: 65, costOfLiving: 30, commerce: 75, transitMobility: 88, travelMobility: 90 },
    logo: null,
    name: "Institut d'études politiques de Paris",
    nameKo: '시앙스포',
    country: '프랑스', region: '유럽', city: '파리',
    qsRank: 78, slot: 3,
    track: 'nonEnglish', langTest: { type: 'DELF', cut: 'B2' }, gpaCut: 3.2,
    majors: ['정치외교학과', '국제학부', '경제학과'],
    seasons: ['가을학기'],
    climate: { '가을학기': '한국의 초겨울과 비슷해요, 흐린 날이 많아요' },
    security: '중심가는 안전하나 소매치기 등 소지품 관리 주의', securityLevel: 'medium',
    access: '지하철 다수 노선 인접, 도보로 주요 관광지 이동 가능', commerceLevel: 'medium', climateType: 'cold',
    creditRecommend: ['유럽정치론', '국제기구론'],
    reviews: ['토론·에세이 과제 비중이 매우 큼', '행정 처리(비자 등)가 다소 느린 편'],
    wishlistCount: { rank1: 3, total: 8 },
    officialLink: 'https://www.sciencespo.fr',
    mapNote: '파리 7구 생제르맹 캠퍼스'
  }
];

/* ---------------------------------------------------------------------
 * 오늘의 할 일 (§4.2) — F2/F4 공통, 최대 4개 노출
 * ------------------------------------------------------------------- */
MOCK.todos = [
  { id: 't1', title: '여행자보험 가입증명서 제출', date: '2027-01-05', done: false, tag: '서류' },
  { id: 't2', title: '온라인 지원서 최종 제출', date: '2026-09-20', done: false, tag: '지원' },
  { id: 't3', title: 'TOEFL 성적표 유효기간 확인', date: '2026-09-01', done: true, tag: '어학' },
  { id: 't4', title: '초과학기 등록 서약서 작성', date: '2027-01-10', done: false, tag: '서류' },
  { id: 't5', title: '출국신고서 제출', date: '2027-01-12', done: false, tag: '서류' }
];

/* ---------------------------------------------------------------------
 * 비자·서류 체크리스트 (F4)
 * ------------------------------------------------------------------- */
MOCK.checklist = [
  {
    id: 'c1', title: '출국신고서 제출', done: false, dueOffset: '출국 전',
    source: '연세대 국제처 2027-1학기 해외파견프로그램 안내', updatedAt: '2026-08-01',
    detail: '국제처 포털에서 출국신고서를 작성 후 온라인 제출합니다. 파견 확정 학생 전원 필수 항목입니다.'
  },
  {
    id: 'c2', title: '여행자보험 가입증명서 제출', done: false, dueOffset: '출국 1주 전까지',
    source: '연세대 국제처 2027-1학기 해외파견프로그램 안내 §7.4', updatedAt: '2026-08-01',
    detail: '출국일 기준 전체 파견 기간을 포함하는 여행자보험에 가입하고, 가입증명서를 출국 1주 전까지 제출해야 합니다.'
  },
  {
    id: 'c3', title: '비자/거주허가 신청', done: false, dueOffset: '국가별 상이 — 본인 확인 필요',
    source: '국가별 대사관·영사관 공지 (더블 체크 필요)', updatedAt: '확인 필요',
    detail: '비자 취득은 전적으로 학생 본인 책임입니다. 국가·목적(학생비자 등)별 요건이 달라 파견 확정 대학의 최신 공지를 반드시 재확인하세요.'
  },
  {
    id: 'c4', title: '초과학기 등록 서약서 제출', done: false, dueOffset: '해당자만',
    source: '연세대 국제처 2027-1학기 해외파견프로그램 안내 §7.4', updatedAt: '2026-08-01',
    detail: '마지막 학기(4년제 8학기/건축 5년제 10학기)에 파견되는 경우에만 제출이 필요합니다.'
  }
];

/* ---------------------------------------------------------------------
 * 생활 준비 정보 카드 (F4) — 보험/장학금/통신사/계좌
 * ------------------------------------------------------------------- */
MOCK.livingPrep = {
  insurance: {
    title: '여행자보험',
    summary: '출국 1주 전까지 가입증명서 제출 의무 (§7.4)',
    caution: '보장 범위·면책 조항은 상품마다 달라요. 반드시 약관을 직접 확인하세요.'
  },
  scholarship: {
    title: '장학금',
    summary: '자격에 맞는 장학금 최대 4종 확인 가능',
    caution: '금액·자격 기준은 학기마다 변경될 수 있어요. 국제처 최신 공지를 더블 체크하세요.'
  },
  telecom: {
    title: '통신사',
    summary: '현지 유심/이심 및 로밍 비교 (확인 필요: 데이터 소스)',
    caution: '학교 규정집에 없는 항목으로, 별도 제휴처 데이터 연동이 필요해요.'
  },
  bank: {
    title: '계좌',
    summary: '현지 계좌 개설 절차 안내 (확인 필요: 데이터 소스)',
    caution: '은행 정책은 변경이 잦아 최신 정보 검증 프로세스가 필요해요.'
  }
};

MOCK.scholarships = [
  { name: '미래에셋 해외교환장학생', amount: '학기당 아시아 550만원 / 그외 지역 750만원', eligibility: '대한민국 국적, GPA 2.87/4.3↑, 소득분위 1~8분위' },
  { name: '글로벌리더 장학금', amount: '학기당 400만원', eligibility: '대한민국 국적, GPA 3.1/4.3↑, 학자금지원구간 3구간 이내' },
  { name: '교류활성화 장학금 (Go Abroad)', amount: '학기당 200만원', eligibility: '지정 교류활성화 대상 대학 파견 신규 교환학생 (매 학기 변동)' },
  { name: '이윤재 글로벌 인재 육성 장학금', amount: '학기당 400만원', eligibility: '일본 ICU 파견 신규 교환/방문학생 (자동 대상)' }
];

MOCK.tips = [
  { school: 'keio', title: '게이오 상경계열 꿀강 리스트', summary: '출석 대신 기말 리포트 100%인 과목 위주로 정리했어요' },
  { school: 'nus', title: 'NUS 경영대 조모임 꿀팁', summary: '조모임 플랫폼은 대부분 Telegram, 초반 스케줄 조율이 관건' }
];

MOCK.nearbySpots = [
  { school: 'keio', title: '미타 캠퍼스 도보 15분, 시바공원', summary: '벚꽃 시즌 로컬 피크닉 명소' },
  { school: 'nus', title: '켄트리지에서 버스 20분, 클락키', summary: '야경 명소이자 학생 모임 단골 장소' }
];

/* ---------------------------------------------------------------------
 * 멘토 없는 멘토 상담(F6) — 교환학생 경험보고서 기반 태그된 후기 목업.
 * 위시리스트 기본 학교(keio/nus/ubc) 위주로 풍부하게 채움. 나머지 학교는
 * school.reviews(일반 후기 2줄)로 챗봇이 폴백함.
 * ------------------------------------------------------------------- */
MOCK.schoolReviews = {
  keio: [
    { tag: '기숙사', author: '경영학과 · 2025년 봄학기 파견', semester: '2025-1', text: '미타 캠퍼스 인근 대학 기숙사는 신청 경쟁이 치열해서 최대한 빨리 지원하는 걸 추천해요. 방음이 약한 편이라 이어플러그는 거의 필수였어요.' },
    { tag: '기숙사', author: '상경계열 · 2024년 가을학기 파견', semester: '2024-2', text: '기숙사 대신 학교 근처 셰어하우스를 구하는 선배들도 많아요. 월세는 비싸지만 위치가 좋아서 통학이 훨씬 편했어요.' },
    { tag: '교통', author: '국제학부 · 2024년 가을학기 파견', semester: '2024-2', text: '미타역에서 도보 1분이라 지하철 통학이 정말 편했어요. 야마노테선 환승도 쉬워서 도쿄 어디든 30분 내로 갈 수 있어요.' },
    { tag: '상권', author: '경영학과 · 2025년 봄학기 파견', semester: '2025-1', text: '학교 주변에 편의점·카페·서점이 밀집해 있어서 생활하기 편했어요. 시부야·롯폰기까지도 금방이에요.' },
    { tag: '치안', author: '상경계열 · 2023년 가을학기 파견', semester: '2023-2', text: '밤 11시에도 혼자 다녀도 크게 위험하다고 느낀 적이 없어요. 다만 만원 지하철에서 소매치기는 주의하라는 얘기를 들었어요.' },
    { tag: '학업', author: '국제학부 · 2024년 봄학기 파견', semester: '2024-1', text: '수업은 대부분 일본어라 초반엔 따라가기 벅찼는데, 동아리(서클) 활동을 하면서 언어가 빨리 늘었어요. 상경계열은 기말 리포트 비중이 큰 과목이 많아요.' },
    { tag: '날씨', author: '경영학과 · 2025년 봄학기 파견', semester: '2025-1', text: '봄학기엔 벚꽃 시즌과 겹쳐서 정말 예뻤어요. 가을엔 늦더위가 좀 남아있으니 얇은 옷을 챙기세요.' },
    { tag: '생활비', author: '상경계열 · 2024년 가을학기 파견', semester: '2024-2', text: '도쿄 물가가 만만치 않아요, 특히 주거비가 부담됐어요. 학식은 저렴한 편이라 자주 이용했어요.' }
  ],
  nus: [
    { tag: '기숙사', author: '경영학과 · 2025년 봄학기 파견', semester: '2025-1', text: 'UTown 기숙사는 신청이 빠르면 배정 확률이 높아요. 에어컨이 기본이라 더위 걱정은 안 해도 돼요.' },
    { tag: '기숙사', author: '컴퓨터공학과 · 2024년 가을학기 파견', semester: '2024-2', text: '룸메이트는 다양한 국적으로 랜덤 배정되는데, 덕분에 친구를 빨리 사귈 수 있었어요.' },
    { tag: '교통', author: '경제학과 · 2024년 가을학기 파견', semester: '2024-2', text: 'MRT(지하철)가 캠퍼스 바로 앞까지 연결돼서 시내 이동이 정말 편했어요. 버스도 촘촘해서 차 없이도 생활 가능해요.' },
    { tag: '상권', author: '경영학과 · 2025년 봄학기 파견', semester: '2025-1', text: '켄트리지 인근에 대형 쇼핑몰이 많아서 생필품 사기 편했어요. 클락키까지 버스로 20분이면 야경 명소도 갈 수 있어요.' },
    { tag: '치안', author: '컴퓨터공학과 · 2023년 가을학기 파견', semester: '2023-2', text: '아시아 최상위권 치안이라고 느꼈어요. 밤늦게 캠퍼스에서 기숙사까지 걸어가도 불안하지 않았어요.' },
    { tag: '학업', author: '경제학과 · 2024년 봄학기 파견', semester: '2024-1', text: '영어 강의 100%라 언어 부담은 적은데, 조모임 과제가 많아서 스케줄 조율이 중요해요. Telegram으로 팀플하는 게 국룰이에요.' },
    { tag: '날씨', author: '경영학과 · 2025년 봄학기 파견', semester: '2025-1', text: '일년 내내 고온다습해서 스콜성 소나기에 대비해 우산은 항상 챙겨야 해요.' },
    { tag: '생활비', author: '컴퓨터공학과 · 2024년 가을학기 파견', semester: '2024-2', text: '외식 물가가 꽤 높은 편이라 학생식당을 자주 이용했어요. 그래도 교통비는 저렴한 편이었어요.' }
  ],
  ubc: [
    { tag: '기숙사', author: '컴퓨터공학과 · 2025년 봄학기 파견', semester: '2025-1', text: 'Totem Park 기숙사는 신입 교환학생에게 인기가 많아서 신청 초반에 마감돼요. 방은 깨끗하고 관리가 잘 되는 편이에요.' },
    { tag: '기숙사', author: '경영학과 · 2024년 가을학기 파견', semester: '2024-2', text: '기숙사 식단(밀플랜)이 다양해서 만족스러웠어요. 다만 비용이 꽤 나가는 편이에요.' },
    { tag: '교통', author: '환경학과 · 2024년 가을학기 파견', semester: '2024-2', text: '캠퍼스가 반도 끝에 있어서 시내까지 버스로 30분 정도 걸려요. U-Pass로 버스는 무제한 이용 가능해서 부담은 적어요.' },
    { tag: '상권', author: '컴퓨터공학과 · 2025년 봄학기 파견', semester: '2025-1', text: '캠퍼스 안에 빌리지가 있어서 웬만한 건 다 해결되지만, 시내만큼 다양하진 않아요. 다운타운은 버스로 금방이에요.' },
    { tag: '치안', author: '경영학과 · 2023년 가을학기 파견', semester: '2023-2', text: '캠퍼스 자체가 반도에 위치해서 안전하다고 느꼈어요. 다만 밤에 인적 드문 산책로는 피하는 게 좋아요.' },
    { tag: '학업', author: '환경학과 · 2024년 봄학기 파견', semester: '2024-1', text: '그룹 프로젝트와 참여 점수 비중이 큰 편이라 적극적으로 수업에 참여하는 게 중요해요. 한국인 교환학생 커뮤니티가 활발해서 정보 얻기 편했어요.' },
    { tag: '날씨', author: '컴퓨터공학과 · 2025년 봄학기 파견', semester: '2025-1', text: '비 오는 날이 정말 많아요. 방수 자켓이랑 우산은 필수템이에요.' },
    { tag: '생활비', author: '경영학과 · 2024년 가을학기 파견', semester: '2024-2', text: '밴쿠버 물가가 꽤 높은 편이에요, 특히 외식비. 학교 식당 밀플랜을 활용하면 절약할 수 있어요.' }
  ]
};

/* ---------------------------------------------------------------------
 * F5. 학점 인정 — 강의계획서 유사도 비교 목업
 * ------------------------------------------------------------------- */
MOCK.courseMatches = [
  {
    id: 'm1',
    homeMajor: '경영학과',
    homeCourse: '국제경영론 (3학점)',
    targetCourse: 'International Business Strategy (4 ECTS)',
    school: 'uva',
    similarity: 86,
    matchedTopics: ['글로벌 전략', '해외직접투자', '다국적기업 조직'],
    note: '핵심 주제 3/4 일치. 평가 방식(팀 프로젝트 비중)만 상이'
  },
  {
    id: 'm2',
    homeMajor: '경영학과',
    homeCourse: '조직행동론 (3학점)',
    targetCourse: 'Organizational Behavior (3 credits)',
    school: 'amherst',
    similarity: 91,
    matchedTopics: ['동기부여 이론', '리더십', '팀 다이내믹스'],
    note: '주차별 커리큘럼 순서까지 유사'
  },
  {
    id: 'm3',
    homeMajor: '컴퓨터과학과',
    homeCourse: '데이터베이스 (3학점)',
    targetCourse: 'Database Systems (4 credits)',
    school: 'nus',
    similarity: 74,
    matchedTopics: ['관계형 모델', 'SQL', '트랜잭션'],
    note: '분산 데이터베이스 파트가 원 강의에 추가로 포함됨'
  },
  {
    id: 'm4',
    homeMajor: '경제학과',
    homeCourse: '미시경제학 (3학점)',
    targetCourse: 'Microeconomic Theory (3 credits)',
    school: 'lse',
    similarity: 68,
    matchedTopics: ['소비자이론', '게임이론 기초'],
    note: '수리적 난이도가 원 강의보다 높은 편, 선수 지식 확인 권장'
  },
  {
    id: 'm5',
    homeMajor: '심리학과',
    homeCourse: '소비자심리학 (3학점)',
    targetCourse: 'Consumer Psychology (3 credits)',
    school: 'amherst',
    similarity: 82,
    matchedTopics: ['소비자 행동', '인지 편향', '실험 설계'],
    note: '실습 비중이 높아 조모임 발표가 추가로 있음'
  },
  {
    id: 'm6',
    homeMajor: '전기전자공학전공',
    homeCourse: '회로이론 (3학점)',
    targetCourse: 'Circuit Theory (5 ECTS)',
    school: 'kth',
    similarity: 79,
    matchedTopics: ['전기회로', '아날로그 회로', '회로 해석'],
    note: '실습(랩) 시수가 원 강의보다 많아 별도 신청 필요'
  },
  {
    id: 'm7',
    homeMajor: '국제학전공',
    homeCourse: '국제기구론 (3학점)',
    targetCourse: 'International Organizations (5 ECTS)',
    school: 'sciencespo',
    similarity: 88,
    matchedTopics: ['UN 체제', '국제 레짐', '다자 외교'],
    note: '토론·에세이 과제 비중이 커서 프랑스어보다 영어 트랙 권장'
  },
  {
    id: 'm8',
    homeMajor: '사회학과',
    homeCourse: '사회조사방법론 (3학점)',
    targetCourse: 'Social Research Methods (3 credits)',
    school: 'unimelb',
    similarity: 77,
    matchedTopics: ['설문 설계', '통계 분석', '질적 연구'],
    note: '통계 프로그램(R) 실습이 추가로 포함됨'
  },
  {
    id: 'm9',
    homeMajor: '화학과',
    homeCourse: '유기화학 (3학점)',
    targetCourse: 'Organic Chemistry (3 credits)',
    school: 'ntu-tw',
    similarity: 71,
    matchedTopics: ['반응 메커니즘', '입체화학', '분광학'],
    note: '실험 리포트는 영어로 작성해야 함, 안전교육 별도 이수 필요'
  },
  {
    id: 'm10',
    homeMajor: '인공지능학과',
    homeCourse: '머신러닝개론 (3학점)',
    targetCourse: 'Introduction to Machine Learning (4 credits)',
    school: 'nus',
    similarity: 85,
    matchedTopics: ['지도학습', '신경망 기초', '모델 평가'],
    note: '선수과목으로 선형대수·확률통계 요구, 사전 확인 필요'
  }
];

/* ---------------------------------------------------------------------
 * 연세대 단과대학별 전공 마스터 리스트 (76개) — 검색 가능한 학과 드롭다운용.
 * 학교별 majors(지원 가능 전공)와는 다른, 연세대 자체 전공 목록입니다.
 * ------------------------------------------------------------------- */
MOCK.yonseiMajors = [
  { college: '문과대학', division: null, majorName: '국어국문학과' },
  { college: '문과대학', division: null, majorName: '중어중문학과' },
  { college: '문과대학', division: null, majorName: '영어영문학과' },
  { college: '문과대학', division: null, majorName: '독어독문학과' },
  { college: '문과대학', division: null, majorName: '불어불문학과' },
  { college: '문과대학', division: null, majorName: '노어노문학과' },
  { college: '문과대학', division: null, majorName: '사학과' },
  { college: '문과대학', division: null, majorName: '철학과' },
  { college: '문과대학', division: null, majorName: '문헌정보학과' },
  { college: '문과대학', division: null, majorName: '심리학과' },
  { college: '상경대학', division: null, majorName: '경제학과' },
  { college: '상경대학', division: null, majorName: '응용통계학과' },
  { college: '경영대학', division: null, majorName: '경영학과' },
  { college: '이과대학', division: null, majorName: '수학과' },
  { college: '이과대학', division: null, majorName: '물리학과' },
  { college: '이과대학', division: null, majorName: '화학과' },
  { college: '이과대학', division: null, majorName: '지구시스템과학과' },
  { college: '이과대학', division: null, majorName: '천문우주학과' },
  { college: '이과대학', division: null, majorName: '대기과학과' },
  { college: '공과대학', division: null, majorName: '화공생명공학전공' },
  { college: '공과대학', division: null, majorName: '전기전자공학전공' },
  { college: '공과대학', division: null, majorName: '건축공학 (4년제)' },
  { college: '공과대학', division: null, majorName: '건축학 (5년제)' },
  { college: '공과대학', division: null, majorName: '도시공학과' },
  { college: '공과대학', division: null, majorName: '건설환경공학전공' },
  { college: '공과대학', division: null, majorName: '기계공학전공' },
  { college: '공과대학', division: null, majorName: '신소재공학전공' },
  { college: '공과대학', division: null, majorName: '산업공학과' },
  { college: '공과대학', division: null, majorName: '시스템반도체공학과' },
  { college: '공과대학', division: null, majorName: '디스플레이융합공학과' },
  { college: '생명시스템대학', division: null, majorName: '시스템생물학과' },
  { college: '생명시스템대학', division: null, majorName: '생화학과' },
  { college: '생명시스템대학', division: null, majorName: '생명공학과' },
  { college: '인공지능융합대학', division: '첨단컴퓨팅학부', majorName: '컴퓨터과학과' },
  { college: '인공지능융합대학', division: '첨단컴퓨팅학부', majorName: '인공지능학과' },
  { college: '인공지능융합대학', division: '첨단컴퓨팅학부', majorName: '인공지능시스템학과' },
  { college: '인공지능융합대학', division: '첨단융합공학부', majorName: 'IT융합공학전공' },
  { college: '인공지능융합대학', division: '첨단융합공학부', majorName: '지능형반도체전공' },
  { college: '인공지능융합대학', division: '첨단융합공학부', majorName: '모빌리티시스템전공' },
  { college: '신과대학', division: null, majorName: '신학과' },
  { college: '사회과학대학', division: null, majorName: '정치외교학과' },
  { college: '사회과학대학', division: null, majorName: '행정학과' },
  { college: '사회과학대학', division: null, majorName: '언론홍보영상학부' },
  { college: '사회과학대학', division: null, majorName: '사회복지학과' },
  { college: '사회과학대학', division: null, majorName: '사회학과' },
  { college: '사회과학대학', division: null, majorName: '문화인류학과' },
  { college: '생활과학대학', division: null, majorName: '의류환경학과' },
  { college: '생활과학대학', division: null, majorName: '식품영양학과' },
  { college: '생활과학대학', division: null, majorName: '실내건축학과' },
  { college: '생활과학대학', division: null, majorName: '아동·가족학과' },
  { college: '생활과학대학', division: null, majorName: '통합디자인학과' },
  { college: '교육과학대학', division: null, majorName: '교육학전공' },
  { college: '교육과학대학', division: null, majorName: '체육교육학과' },
  { college: '교육과학대학', division: null, majorName: '스포츠응용산업학과' },
  { college: '언더우드국제대학', division: '언더우드학부', majorName: '비교문학과문화전공' },
  { college: '언더우드국제대학', division: '언더우드학부', majorName: '경제학전공' },
  { college: '언더우드국제대학', division: '언더우드학부', majorName: '국제학전공' },
  { college: '언더우드국제대학', division: '언더우드학부', majorName: '정치외교학전공' },
  { college: '언더우드국제대학', division: '언더우드학부', majorName: '생명과학공학전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '아시아학전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '문화디자인경영전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '정보·인터랙션디자인전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '창의기술경영전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '사회정의리더십전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '계량위험관리전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '과학기술정책전공' },
  { college: '언더우드국제대학', division: '융합인문사회과학부', majorName: '지속개발협력전공' },
  { college: '언더우드국제대학', division: '융합과학공학부', majorName: '나노과학공학전공' },
  { college: '언더우드국제대학', division: '융합과학공학부', majorName: '에너지환경융합전공' },
  { college: '언더우드국제대학', division: '융합과학공학부', majorName: '바이오융합전공' },
  { college: '의과대학', division: null, majorName: '의학과' },
  { college: '글로벌인재대학', division: '글로벌인재학부', majorName: '국제통상전공' },
  { college: '글로벌인재대학', division: '글로벌인재학부', majorName: '한국언어문화교육전공' },
  { college: '글로벌인재대학', division: '글로벌인재학부', majorName: '문화미디어전공' },
  { college: '글로벌인재대학', division: '글로벌인재학부', majorName: '바이오생활공학전공' },
  { college: '글로벌인재대학', division: '글로벌인재학부', majorName: '응용정보공학전공' }
];

/* ---------------------------------------------------------------------
 * Supabase 전용 데이터(필요서류/비자/국가별 생활준비) — 목업에는 없고
 * js/data-source.js가 로드에 성공하면 school.id / country_en 기준으로 채워짐.
 * 연결 실패 시에도 화면이 깨지지 않도록 빈 객체로 기본값을 둠.
 * ------------------------------------------------------------------- */
MOCK.schoolDocuments = {};
MOCK.visaByCountry = {};
MOCK.countryPrepByCountry = {};

if (typeof module !== 'undefined') { module.exports = MOCK; }
