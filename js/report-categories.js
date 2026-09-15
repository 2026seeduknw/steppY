/**
 * 교환 경험보고서 9개 항목.
 *
 * 기록 탭(js/diary-view.js)의 태그 칩과 교환보고서 페이지(js/report.js)가 같은 정의를
 * 써야 한다. 각자 들고 있으면 한쪽만 고쳐졌을 때 "기록에 붙인 태그"와 "보고서 항목"이
 * 어긋나서, 분명히 태그를 달았는데 보고서에는 안 나오는 일이 생긴다.
 */
const REPORT_CATEGORIES = [
  { id: 'overview',     ko: '교환대학 개요',     color: '#4E6B93' },
  { id: 'surroundings', ko: '대학 주변 환경',    color: '#5A5D96' },
  { id: 'housing',      ko: '거주 및 식사',      color: '#3F6B52' },
  { id: 'academics',    ko: '학업 환경',         color: '#454E86' },
  { id: 'support',      ko: '국제학생 지원부서', color: '#A15A42' },
  { id: 'facilities',   ko: '캠퍼스 시설',       color: '#9C7B2E' },
  { id: 'culture',      ko: '문화 적응 경험',    color: '#6B4E85' },
  { id: 'resources',    ko: '도움 받을 곳',      color: '#3F7A82' },
  { id: 'tips',         ko: '기타 및 한마디',    color: '#8A4F42' }
];
const CATEGORY_MAP = Object.fromEntries(REPORT_CATEGORIES.map(c => [c.id, c]));
