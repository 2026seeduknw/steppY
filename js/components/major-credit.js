/**
 * 내 전공으로 그 파견교에서 학점 인정이 예상되는 과목 수.
 *
 * 출처는 전공 매칭 결과(MOCK.majorMatches)다. 한 줄이 (연세대 전공, 파견교) 한 쌍이고,
 * note 에 "소속 과목 11개 중 실제 관련 과목 5개 확인" 처럼 세어 둔 수가 적혀 있다.
 * matchedTopics 는 대표 과목을 3개까지만 담아서 그 길이를 쓰면 3에서 막힌다 —
 * note 의 숫자를 먼저 읽고, 못 읽을 때만 matchedTopics 길이로 대신한다.
 *
 * 학교 찾기 카드와 내 저장 비교표가 같이 쓴다.
 */

/** "신소재공학전공" → "신소재공학". 문장 안에 넣을 때 '전공'이 두 번 나오지 않게 한다. */
function majorShortLabel(major) {
  return String(major || '').replace(/(전공|학과|학부)$/, '');
}

/** 매칭 한 줄에서 인정 예상 과목 수를 읽는다. */
function creditCountOf(match) {
  const note = match.note || '';
  const m = note.match(/실제 관련 과목\s*(\d+)개/) || note.match(/과목\s*\d+개\s*중\s*(\d+)개/);
  if (m) return parseInt(m[1], 10);
  return (match.matchedTopics || []).length;
}

/** school.id → 인정 예상 과목 수. 매칭 자료가 없는 학교는 Map 에 들어가지 않는다. */
function buildMajorCreditMap(major) {
  const map = new Map();
  if (!major) return map;
  (MOCK.majorMatches || []).forEach((m) => {
    if (m.homeMajor !== major) return;
    const n = creditCountOf(m);
    if (n > (map.get(m.school) || 0)) map.set(m.school, n);
  });
  return map;
}

/** 2,654,337 → "약 265만 원". 값이 없으면 '-'. */
function formatMonthlyCost(krw) {
  if (krw == null || isNaN(krw)) return '-';
  return `약 ${Math.round(krw / 10000).toLocaleString('ko-KR')}만 원`;
}
