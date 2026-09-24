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

/**
 * 기록할 때 고르는 일상 태그. 한 태그가 보고서 항목 하나 이상에 걸린다 — 예를 들어 "밥·카페"는
 * 거주 및 식사와 문화 적응 경험 양쪽에 쓸 수 있다. 기록에는 일상 태그 id를 저장하고,
 * 보고서 쪽은 categoriesOfTags()로 항목을 풀어서 센다. 옛 기록에 저장된 항목 id(housing 등)는
 * 그대로 통과한다.
 */
const EVERYDAY_TAGS = [
  { id: 'food',         emoji: '🍽️', ko: '밥·카페',      cats: ['housing', 'culture'] },
  { id: 'dorm',         emoji: '🏠', ko: '기숙사·집',    cats: ['housing'] },
  { id: 'class',        emoji: '📖', ko: '수업',         cats: ['academics'] },
  { id: 'study',        emoji: '📚', ko: '공부·도서관',  cats: ['academics', 'facilities'] },
  { id: 'campus',       emoji: '🏫', ko: '캠퍼스',       cats: ['facilities', 'overview'] },
  { id: 'neighborhood', emoji: '🌆', ko: '동네 산책',    cats: ['surroundings'] },
  { id: 'transit',      emoji: '🚌', ko: '교통·이동',    cats: ['surroundings', 'tips'] },
  { id: 'shopping',     emoji: '🛒', ko: '장보기·물가',  cats: ['surroundings', 'housing'] },
  { id: 'friends',      emoji: '🧑‍🤝‍🧑', ko: '친구·모임', cats: ['culture'] },
  { id: 'event',        emoji: '🎉', ko: '행사·파티',    cats: ['culture', 'facilities'] },
  { id: 'language',     emoji: '💬', ko: '언어·소통',    cats: ['culture', 'academics'] },
  { id: 'admin',        emoji: '📄', ko: '서류·행정',    cats: ['support', 'resources'] },
  { id: 'help',         emoji: '🙋', ko: '도움 받음',    cats: ['resources', 'support'] },
  { id: 'trip',         emoji: '🗺️', ko: '여행',         cats: ['culture', 'surroundings'] },
  { id: 'tip',          emoji: '💡', ko: '꿀팁',         cats: ['tips', 'resources'] }
];
const EVERYDAY_MAP = Object.fromEntries(EVERYDAY_TAGS.map(t => [t.id, t]));

/** 기록의 tags(일상 태그 id 또는 옛 항목 id)를 교환보고서 항목 id 목록으로 푼다. */
function categoriesOfTags(tags) {
  const out = [];
  (tags || []).forEach(t => {
    const list = EVERYDAY_MAP[t] ? EVERYDAY_MAP[t].cats : [t];
    list.forEach(c => { if (CATEGORY_MAP[c] && !out.includes(c)) out.push(c); });
  });
  return out;
}
