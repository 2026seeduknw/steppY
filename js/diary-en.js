/**
 * 기록하기 — 필름 테마의 영어 화면.
 *
 * 필름 테마(body[data-theme="film"])에서는 화면 글자를 RECORD·CAMERA처럼 영어 대문자로 보여준다.
 * 글자가 여러 파일의 템플릿에 흩어져 있어서, 화면에 그려진 뒤 글자만 바꿔 끼운다
 * (MutationObserver). 그래서 원본 한국어 코드는 그대로이고, 유리 테마(?theme=glass)에서는
 * 아무것도 바꾸지 않는다.
 *
 * 바꾸는 것: 화면 이름·라벨·버튼·요일·달 이름·태그 이름·안내 문구.
 * 바꾸지 않는 것: 사용자가 쓴 제목·내용, 도시·나라 이름 같은 데이터, 그리고 기록 쓰기/수정 창(한글 그대로).
 *   → 글자 전체가 사전의 한국어와 정확히 같을 때만 바꾼다(부분 치환은 아래 패턴에 한정).
 */
(function () {
  const isFilm = () => document.body && document.body.dataset.theme === 'film';

  // 글자 전체가 정확히 같을 때
  const DICT = {
    '기록': 'RECORD', '일 연속': 'DAY STREAK',
    '오늘의 기록': 'TODAY', '어제의 기록': 'YESTERDAY', '가장 최근 기록': 'LATEST', '첫 우표': 'FIRST FRAME',
    '카메라': 'CAMERA', '기록하기': 'ADD',
    '오늘의 질문': "TODAY'S QUESTION", '답하기': 'ANSWER', '닫기': 'CLOSE',
    '첫 기록을 남겨보세요': 'START YOUR FIRST ROLL', '사진 한 장이면 첫 우표가 붙어요': 'ONE PHOTO IS ENOUGH FOR THE FIRST FRAME',
    '일': 'SUN', '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU', '금': 'FRI', '토': 'SAT',
    '오늘': 'TODAY', '어제': 'YESTERDAY',
    '수정': 'EDIT', '이 기록 삭제': 'DELETE ENTRY', '기록 수정': 'EDIT ENTRY', '수정 저장': 'SAVE CHANGES', '기록 저장': 'SAVE ENTRY',
    '장소': 'PLACE', '날씨': 'WEATHER', '시간대': 'TIME', '태그': 'TAGS',
    '오늘의 노래': "TODAY'S SONG", '그때 듣던 노래': 'NOW PLAYING', '이 순간의 노래': 'SONG OF THE MOMENT',
    '파견 중 기록': 'ABROAD', '출국 전 기록': 'BEFORE DEPARTURE',
    '제목 (선택)': 'TITLE (OPTIONAL)', '오늘 하루는 어땠나요? (선택)': 'HOW WAS YOUR DAY? (OPTIONAL)',
    '한 줄로 답해보세요 (선택)': 'ANSWER IN ONE LINE (OPTIONAL)',
    '오늘 뭘 했나요? (여러 개 골라도 돼요)': 'WHAT DID YOU DO? PICK ANY',
    '고른 태그는 나중에 교환보고서 항목에 자동으로 나뉘어 들어가요': 'TAGS ARE SORTED INTO YOUR EXCHANGE REPORT AUTOMATICALLY',
    '사진을 누르면 대표 사진(우표에 크게 나오는 사진)이 돼요': 'TAP A PHOTO TO MAKE IT THE COVER',
    '그때 듣던 노래 (선택)': 'NOW PLAYING (OPTIONAL)', '곡 제목을 검색해보세요': 'SEARCH A SONG',
    '더 보기': 'MORE', '이번 달 정리': 'MONTHLY WRAP-UP', '경험보고서 미리보기': 'REPORT PREVIEW', '우표첩': 'CONTACT SHEET',
    '이전 달': 'PREVIOUS MONTH', '다음 달': 'NEXT MONTH', '닫기 ': 'CLOSE',
    '오늘의 질문 보기': "TODAY'S QUESTION", '바로 사진 찍어 기록하기': 'TAKE A PHOTO', '바로 사진 찍기': 'TAKE A PHOTO',
    '사진 빼기': 'REMOVE PHOTO', '대표': 'COVER',
    '기록을 저장했어요': 'ENTRY SAVED', '기록을 수정했어요': 'ENTRY UPDATED', '대표 사진으로 바꿨어요': 'COVER PHOTO SET',
    '사진 또는 글 중 하나는 있어야 해요': 'ADD A PHOTO OR A NOTE',
    '오늘의 순간을 기록해보세요': 'CAPTURE TODAY',
    '이 날짜엔 아직 기록이 없어요': 'NOTHING RECORDED THIS DAY',
    '이 기록을 삭제할까요? 되돌릴 수 없어요.': 'DELETE THIS ENTRY?',
    '가장 많이 쓴 태그': 'TOP TAG', '기록한 날': 'DAYS RECORDED', '방문 도시': 'CITIES', '보고서 항목별 채움': 'REPORT SECTIONS',
    '홈에서 출국일 입력하기 →': 'SET YOUR DEPARTURE DATE →',
    '교환 종료': 'EXCHANGE ENDED', '출국까지': 'TO DEPARTURE',
    '위치 확인 중…': 'LOCATING…', '위치 권한이 거부됐어요 (위치 없이 저장돼요)': 'LOCATION DENIED · SAVED WITHOUT A PLACE',
    '위치 정보를 사용할 수 없어요': 'LOCATION UNAVAILABLE', '위치는 저장했지만 지명 변환에 실패했어요': 'LOCATION SAVED · PLACE NAME UNAVAILABLE', '위치 확인됨': 'LOCATION FOUND',
    '맑음': 'CLEAR', '흐림': 'CLOUDY', '비': 'RAIN', '눈': 'SNOW', '폭풍': 'STORM',
    '아침': 'MORNING', '오후': 'AFTERNOON', '저녁': 'EVENING', '밤': 'NIGHT',
    // 태그
    '밥·카페': 'FOOD · CAFE', '기숙사·집': 'HOME', '수업': 'CLASS', '공부·도서관': 'STUDY', '캠퍼스': 'CAMPUS',
    '동네 산책': 'WALK', '교통·이동': 'TRANSIT', '장보기·물가': 'SHOPPING', '친구·모임': 'FRIENDS', '행사·파티': 'EVENT',
    '언어·소통': 'LANGUAGE', '서류·행정': 'PAPERWORK', '도움 받음': 'HELP', '여행': 'TRIP', '꿀팁': 'TIPS',
    // 옛 기록의 항목 이름 태그
    '교환대학 개요': 'OVERVIEW', '대학 주변 환경': 'SURROUNDINGS', '거주 및 식사': 'HOUSING & FOOD', '학업 환경': 'ACADEMICS',
    '국제학생 지원부서': 'SUPPORT OFFICE', '캠퍼스 시설': 'FACILITIES', '문화 적응 경험': 'CULTURE', '도움 받을 곳': 'RESOURCES', '기타 및 한마디': 'NOTES'
  };
  // 앱바 제목처럼 자리에 따라 뜻이 다른 글자
  const BY_CLASS = [['appbar__title', { '기록하기': 'RECORD' }], ['tabbar__item', { '기록하기': 'RECORD' }]];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const ym = (y, m) => `${String(y).slice(2)}.${MONTHS[Number(m) - 1]}`;   // 2026, 9 → 26.SEP

  // 숫자가 섞인 문장 — 앞뒤를 정확히 맞춰 쓴다
  const PATTERNS = [
    [/^(\d{4})년 (\d{1,2})월$/, (m) => ym(m[1], m[2])],
    [/^귀국까지 (\d+)일 · 지금까지 (\d+)일 기록했어요$/, (m) => `${m[1]} DAYS LEFT · ${m[2]} DAYS RECORDED`],
    [/^지금까지 (\d+)일 기록했어요$/, (m) => `${m[1]} DAYS RECORDED`],
    [/^우표 (\d+)장(?: · 도시 (\d+)곳)?$/, (m) => `${m[1]} FRAMES${m[2] ? ` · ${m[2]} CITIES` : ''}`],
    [/^(\d{4})년 (\d{1,2})월 정리$/, (m) => `${ym(m[1], m[2])} WRAP-UP`],
    [/^(\d+)일 남음$/, (m) => `${m[1]} DAYS LEFT`],
    [/^(\d{4}-\d{2}-\d{2}) 출국$/, (m) => `DEPARTS ${m[1]}`],
    [/^(\d+)일 연속$/, (m) => `${m[1]} DAY STREAK`],
    [/^💭 오늘의 질문$/, () => "💭 TODAY'S QUESTION"],
    [/^(\d+)개$/, (m) => `${m[1]}`]
  ];
  const EMOJI_PREFIX = /^([\p{Extended_Pictographic}️‍]+)\s+(.+)$/u;

  function translate(text, parent) {
    const raw = text;
    const t = text.trim();
    if (!t) return null;
    for (const [cls, map] of BY_CLASS) {
      if (parent && parent.closest && parent.closest('.' + cls) && map[t]) return map[t];
    }
    if (DICT[t]) return DICT[t];
    for (const [re, fn] of PATTERNS) {
      const m = t.match(re);
      if (m) return fn(m);
    }
    // "🎵 오늘의 노래", "🌆 저녁", "☁️ 흐림 18°" — 이모지 뒤 글자
    const e = t.match(EMOJI_PREFIX);
    if (e) {
      const rest = e[2];
      const w = rest.match(/^(맑음|흐림|비|눈|폭풍)(\s.*)?$/);
      if (w) return `${e[1]} ${DICT[w[1]]}${w[2] || ''}`;
      if (DICT[rest]) return `${e[1]} ${DICT[rest]}`;
    }
    return null;
  }

  const ATTRS = ['aria-label', 'placeholder', 'title'];

  function apply(root) {
    if (!isFilm() || !root) return;
    const scope = root.nodeType === 1 || root.nodeType === 11 ? root : root.parentNode;
    if (!scope) return;
    // 사용자가 쓴 글이 담기는 자리는 건드리지 않는다
    const skip = (n) => n.closest && n.closest('#entryModalScrim, .diary-stamp__title, .diary-stamp__blank, .diary-ticket-text, .diary-featured__title, .diary-featured__loc, .stampbook__item small, .diary-postmark, .report-entry, textarea, input, script, style');
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      const p = n.parentElement;
      if (!p || skip(p)) return;
      const out = translate(n.nodeValue, p);
      if (out != null && out !== n.nodeValue.trim()) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), out);
    });
    const els = scope.querySelectorAll ? scope.querySelectorAll('[aria-label],[placeholder],[title]') : [];
    els.forEach((el) => {
      if (el.closest && el.closest('#entryModalScrim')) return;   // 기록 창은 한글 그대로
      ATTRS.forEach((a) => {
        const v = el.getAttribute(a);
        if (!v) return;
        const out = translate(v, el);
        if (out != null && out !== v) el.setAttribute(a, out);
      });
    });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(() => { scheduled = false; apply(document.body); });
  }

  function start() {
    const mo = new MutationObserver((muts) => {
      if (!isFilm()) return;
      for (const m of muts) {
        if (m.type === 'attributes' && m.target === document.body) { schedule(); return; }
        if (m.type === 'childList' && m.addedNodes.length) { schedule(); return; }
        if (m.type === 'characterData') { schedule(); return; }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-theme'] });
    schedule();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
