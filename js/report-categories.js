/**
 * 교환 경험보고서 9개 항목.
 *
 * 기록 탭(js/diary-view.js)의 태그 칩과 교환보고서 페이지(js/report.js)가 같은 정의를
 * 써야 한다. 각자 들고 있으면 한쪽만 고쳐졌을 때 "기록에 붙인 태그"와 "보고서 항목"이
 * 어긋나서, 분명히 태그를 달았는데 보고서에는 안 나오는 일이 생긴다.
 */
/*
 * 이름은 보고서 양식의 말이 아니라 기록할 때 쓰는 말로 적는다.
 *
 * '국제학생 지원부서'나 '기타 및 한마디'는 다 쓰고 나서 묶을 때나 어울리는
 * 제목이지, 사진 한 장 올리면서 고르는 이름이 아니다. 아홉 칸이 전부 그런
 * 말투라 태그를 고르는 일이 서류 작성처럼 느껴졌다.
 *
 * id는 그대로 둔다 — 이미 저장된 기록(user_journal.tags)이 id로 붙어 있어서,
 * id를 바꾸면 지금까지 달아둔 태그가 전부 떨어진다.
 */
const REPORT_CATEGORIES = [
  { id: 'overview',     ko: '학교 이야기',   color: '#4E6B93' },
  { id: 'surroundings', ko: '학교 주변',     color: '#5A5D96' },
  { id: 'housing',      ko: '집과 밥',       color: '#3F6B52' },
  { id: 'academics',    ko: '수업',          color: '#454E86' },
  { id: 'support',      ko: '학교 지원센터', color: '#A15A42' },
  { id: 'facilities',   ko: '캠퍼스 시설',   color: '#9C7B2E' },
  { id: 'culture',      ko: '문화 적응',     color: '#6B4E85' },
  { id: 'resources',    ko: '도움받을 곳',   color: '#3F7A82' },
  { id: 'tips',         ko: '그 밖에',       color: '#8A4F42' }
];
const CATEGORY_MAP = Object.fromEntries(REPORT_CATEGORIES.map(c => [c.id, c]));
