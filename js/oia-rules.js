/**
 * 연세대 국제처 해외파견 규칙 — 일정, 지원 전형, 어학 환산, 공통 자격, 배정 점수, 학점 인정 한도, 장학금.
 *
 * 근거는 국제처가 학기마다 내는 안내 책자다(docs/oia/2027F_OIA_booklet.pdf, 요약은 같은 폴더 .md).
 * 수치·날짜는 학기마다 바뀌므로 화면 코드에 흩지 않고 여기 한 곳에 둔다. 새 책자가 나오면
 * TERMS 에 학기를 하나 더하고, 바뀐 기준(TOEFL 최소 점수 등)만 고친다.
 *
 * 학기 키는 연세대 표기를 따른다 — 가을 파견 = 'YYYY-2', 봄 파견 = 'YYYY-1'.
 * 여름·겨울학기는 국제처 계절학기 프로그램이라 일정이 따로 나온다(아직 자료 없음).
 */
const OIA = (function () {
  /* ------------------------------------------------------------ 학기별 일정 */

  /*
   * 일정 항목 — 화면은 phase 로 묶어 보여준다.
   *   apply  지원(명단 공지 ~ 배정 발표)
   *   placed 배정 후 ~ 출국 전
   *   abroad 파견 중
   *   return 귀국 후
   * 날짜가 있는 항목은 date(하루) 또는 from~to(기간), 시각까지 필요하면 'YYYY-MM-DDTHH:mm'.
   * rel 은 사용자 출국일·귀국일 기준 날짜 — { from: 'start'|'end', days: -7 } 꼴.
   *   책자에 기한이 적힌 것(출국 1주일 전)만 쓴다. 기한이 없는 일에 날짜를 지어내지 않는다.
   * only 는 해당하는 사람에게만 보여줄 때 — 'nonEnglish' | 'lastSemester'.
   * info: true 는 할 일이 아니라 알아둘 일(체크 칸 없음).
   * approx: 'month' 는 책자에 'O월 중'으로만 나온 일 — 날짜는 정렬용이고 화면에는 달만 보인다.
   */
  const TERMS = {
    '2027-2': {
      label: '2027 가을학기',
      source: '2027-2학기 국제처 해외파견프로그램 안내',
      startsOn: '2027-09-01',
      // 어학 성적은 파견 시작일 기준 2년 안에 본 것만 인정
      langValidFrom: '2025-09-01',
      schoolListAt: '2026-12-15',
      applyFrom: '2027-01-07T10:00',
      applyTo: '2027-01-08T17:00',
      placementAt: '2027-01-20T10:00',
      cancelBy: '2027-07-30',
      events: [
        { id: 'list', phase: 'apply', date: '2026-12-15', title: '배정가능 대학 명단 공지', detail: '국제처 홈페이지 공지. 지난 학기 명단은 참고만 하세요.', info: true },
        { id: 'passport', phase: 'apply', title: '여권 발급·만료일 확인', detail: '대부분의 파견교가 2차 서류에서 여권을 요구해요. 파견이 끝나기 전에 만료되면 미리 갱신하세요.' },
        { id: 'langcert', phase: 'apply', from: '2026-12-28T10:00', to: '2026-12-31T17:00', only: 'nonEnglish', title: '비영어권 어학증명서 사전 제출', detail: '연세포탈 → 국제학생교류 → (국제처) 비영어권 어학증명서 제출. 이 기간에 내지 않으면 비영어권 전형에 지원할 수 없어요.' },
        // 책자는 '별도 공지'였지만 설명회 슬라이드가 비영어권 어학증명서와 같은 기간으로 못박았다(docs/oia/2027F_OIA_slides.md)
        { id: 'exempt', phase: 'apply', from: '2026-12-28T10:00', to: '2026-12-31T17:00', title: '어학 면제 신청·편입생/대학원생 성적표 제출 (해당자만)', detail: '비영어권 어학증명서와 같은 서류 사전제출 기간이에요. 제출 방법은 국제처 홈페이지 공지를 확인하세요. 기간이 지나면 받지 않아요.' },
        { id: 'apply', phase: 'apply', from: '2027-01-07T10:00', to: '2027-01-08T17:00', title: '온라인 지원서 제출 + 전형료 10,000원', detail: '연세포탈 → 학사정보시스템 → 학사행정 → 국제학생교류 → (국제처)해외파견프로그램신청. 영문 이름은 여권과 철자·띄어쓰기·하이픈까지 같게. 전형료는 우리은행 126-000350-18-377(연세대학교), 송금자명은 이름+소속(예. 김연세경영). 마감 뒤에는 희망 대학·기간을 바꿀 수 없어요.' },
        { id: 'review', phase: 'apply', from: '2027-01-11', to: '2027-01-15', title: '1차 서류 심사', info: true },
        { id: 'result', phase: 'apply', date: '2027-01-20T10:00', title: '배정 결과 발표', detail: '연세포탈. 배정된 학교는 어떤 이유로도 바꿀 수 없어요.', info: true },
        { id: 'doc2', phase: 'placed', title: '파견교 2차 서류 제출', detail: '마감은 학교마다 달라요. 파견교 메일을 자주 확인하세요.' },
        { id: 'acceptance', phase: 'placed', title: '입학허가서 사본을 국제처에 제출', detail: '입학허가서를 직접 받은 경우에만. 국제처로 오면 따로 안내해줘요.' },
        { id: 'visa', phase: 'placed', title: '비자·체류허가 신청', detail: '입학허가서를 받은 뒤 주한 대사관·영사관에 직접 신청해요. 국제처는 대행하지 않아요.' },
        { id: 'scholar-mirae', phase: 'placed', date: '2027-03-01', approx: 'month', title: '미래에셋 해외교환장학생 공고 확인 (3월)', detail: '미래에셋박현주재단 홈페이지에서 직접 접수.', info: true },
        { id: 'scholar-oia', phase: 'placed', date: '2027-04-01', approx: 'month', title: '글로벌리더·교류활성화 장학금 선발 (4월)', info: true },
        { id: 'orientation', phase: 'placed', date: '2027-05-01', approx: 'month', title: '파견예정자 사전교육 (5월 중)', detail: '정확한 날짜는 추후 공지.', info: true },
        { id: 'cancel', phase: 'placed', date: '2027-07-30', title: '파견 취소 신청 마감', detail: '취소하면 시점과 상관없이 패널티와 봉사 의무가 생기고, 이후 정규학기 국제처 파견에 다시 지원할 수 없어요.', info: true },
        { id: 'tuition', phase: 'placed', title: '연세대 등록금 납부 (휴학 중이면 복학 신청)', detail: '본교 학사일정에 맞춰요. 미납하거나 휴학하면 미등록 제적돼요. 출국한 뒤여도 기간 안에만 하면 돼요.' },
        { id: 'departure-report', phase: 'placed', rel: { from: 'start', days: -7 }, title: '출국신고서 + 여행자보험 증서 제출', detail: '출국 1주일 전까지 연세포탈로.' },
        { id: 'extra-pledge', phase: 'placed', rel: { from: 'start', days: -7 }, only: 'lastSemester', title: '초과학기 서약서 제출', detail: '정규학기 마지막 학기(8학기, 건축 5년제 10학기)에 파견되는 경우.' },
        { id: 'no-leave', phase: 'abroad', title: '파견 중에는 휴학할 수 없어요', detail: '파견 기간 중간의 연세대 계절학기도 들을 수 없어요(파견 전후 계절학기는 가능).', info: true },
        { id: 'summer-credit', phase: 'abroad', title: '해외 계절학기로 학점을 받으려면 2개월 전 승인', detail: '교무처 학사지원팀에 유학생 자격으로 미리 승인받아야 해요(yshaksa@yonsei.ac.kr). 다른 대학 계절학기는 승인 없으면 인정되지 않아요.', info: true },
        { id: 'return-report', phase: 'return', title: '귀국신고 등록', detail: '연세포탈 → 국제학생교류 → (국제처)귀국신고등록.' },
        { id: 'experience', phase: 'return', title: '경험보고서 등록', detail: '연세포탈 → 국제학생교류 → (국제처)경험보고서 등록. 귀국신고와 경험보고서를 마쳐야 학점인정을 신청할 수 있어요.' },
        { id: 'transcript', phase: 'return', title: '파견교 공식 성적표 제출', detail: '파견교가 국제처(exch@yonsei.ac.kr)로 보내요. 성적표가 와야 국제처가 인정 학점을 환산해 입력해요.' },
        { id: 'credit-transfer', phase: 'return', title: '학점인정 신청', detail: '학사정보시스템 → 성적 → 인정학점 → 교류학생학점인정(국제처). 이수 학점이 없어도 꼭 신청해야 해요 — 안 하면 졸업·수료에 불이익이 있어요.' }
      ]
    }
  };

  /** 교환 시기(profile.exchangeTerm) → 학기 키. 봄·가을만. */
  function termKeyOf(term) {
    if (!term || !term.year) return null;
    const s = String(term.season || '');
    if (s.includes('가을')) return `${term.year}-2`;
    if (s.includes('봄')) return `${term.year}-1`;
    return null;
  }

  /** 학기 키를 사람이 읽는 말로 — '2027-2' → '2027 가을학기'. */
  function termLabel(key) {
    if (!key) return '';
    const [y, n] = key.split('-');
    return `${y} ${n === '2' ? '가을학기' : '봄학기'}`;
  }

  function termOf(profile) {
    const key = termKeyOf(profile && profile.exchangeTerm);
    return { key, data: key ? TERMS[key] || null : null };
  }

  /* --------------------------------------------------------- 날짜 다루기 */

  // 국제처 시각은 모두 한국 시간이다. 'T' 가 없으면 그날 자정.
  function kst(iso) {
    if (!iso) return null;
    return new Date(iso.includes('T') ? `${iso}:00+09:00` : `${iso}T00:00:00+09:00`);
  }
  function addDays(iso, days) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  /** 'YYYY-MM-DDTHH:mm' → '1월 7일(목) 10:00'. 연도가 올해가 아니면 앞에 붙인다. */
  function fmtDate(iso, { withTime = true } = {}) {
    if (!iso) return '';
    const d = kst(iso);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    // 1년 안쪽이면 연도를 떼도 헷갈리지 않는다 — 늘 붙이면 기간 표시가 두 줄로 접힌다
    const far = Math.abs(d.getTime() - Date.now()) > 300 * 86400000;
    const y = far ? `${d.getFullYear()}년 ` : '';
    const t = withTime && iso.includes('T') ? ` ${iso.slice(11, 16)}` : '';
    return `${y}${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]})${t}`;
  }
  /** 오늘부터 그날까지 남은 날(오늘이면 0, 지났으면 음수). */
  function daysUntil(iso) {
    const today = kst(typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
    const target = kst(iso.slice(0, 10));
    return Math.round((target - today) / 86400000);
  }

  /**
   * 이 사람에게 해당하는 일정 — 날짜를 계산해 붙이고(rel), 해당 없는 항목(only)은 뺀다.
   * 반환: [{ ...event, due, dueTo, phase }] — due 는 마감(또는 그날), dueTo 는 기간의 끝.
   */
  function scheduleFor(profile, range) {
    const { data } = termOf(profile);
    if (!data) return [];
    const track = profile && profile.exchangeTerm && profile.exchangeTerm.track;
    const a = (profile && profile.academic) || {};
    return data.events.filter(ev => {
      if (ev.only === 'nonEnglish') return track && track !== 'english';
      if (ev.only === 'lastSemester') return !!a.lastSemester;
      return true;
    }).map(ev => {
      let due = ev.date || ev.from || null;
      let dueTo = ev.to || null;
      if (ev.rel) {
        const base = range && (ev.rel.from === 'start' ? range.start : range.end);
        due = base ? addDays(base, ev.rel.days) : null;
      }
      return Object.assign({}, ev, { due, dueTo });
    });
  }

  /** 지금 기준으로 다가오는(또는 진행 중인) 일정 n개. 날짜 없는 항목은 뺀다. */
  function upcoming(profile, range, n = 2) {
    const now = Date.now();
    // 시각이 없는 날짜는 그날 하루가 끝날 때까지 '다가오는' 일정으로 둔다
    const endOf = (iso) => kst(iso).getTime() + (iso.includes('T') ? 0 : 86400000);
    return scheduleFor(profile, range)
      .filter(ev => ev.due && endOf(ev.dueTo || ev.due) > now)
      .sort((x, y) => kst(x.due) - kst(y.due))
      .slice(0, n);
  }

  /** 배정 발표 전인가 — 그 전에 학교를 등록하면 '미리 준비'로 본다. */
  function beforePlacement(profile) {
    const { data } = termOf(profile);
    if (!data || !data.placementAt) return false;
    return Date.now() < kst(data.placementAt).getTime();
  }

  /* ------------------------------------------------------- 전형과 어학 시험 */

  const TRACKS = [
    { key: 'english', label: '영어권', lang: '영어', tests: ['TOEFL'] },
    { key: 'de', label: '독일어권', lang: '독일어', tests: ['Goethe', 'FLEX'] },
    { key: 'ru', label: '러시아어권', lang: '러시아어', tests: ['TORFL', 'FLEX'] },
    { key: 'es', label: '스페인어권', lang: '스페인어', tests: ['DELE', 'FLEX'] },
    { key: 'fr', label: '프랑스어권', lang: '프랑스어', tests: ['DELF', 'FLEX'] },
    { key: 'ja', label: '일본어권', lang: '일본어', tests: ['JLPT'] },
    { key: 'zh', label: '중국어권', lang: '중국어', tests: ['HSK'] }
  ];
  const trackOf = (key) => TRACKS.find(t => t.key === key) || null;
  const trackLabel = (key) => (trackOf(key) || {}).label || '';

  /*
   * 시험 — score 는 숫자, level 은 등급. 등급은 높은 것부터 적는다(앞일수록 높다).
   * IELTS 는 연세대 1차 지원에 낼 수 없지만, 예전에 입력해 둔 값을 보여줄 수는 있어야 해서 남긴다.
   */
  const TESTS = {
    TOEFL: { kind: 'score', max: 120, step: 1, placeholder: '96', lang: 'english' },
    FLEX: { kind: 'score', max: 1500, step: 1, placeholder: '950', lang: null },
    Goethe: { kind: 'level', levels: ['C2', 'C1', 'B2', 'B1', 'A2', 'A1'], lang: 'de' },
    TORFL: { kind: 'level', levels: ['4급', '3급', '2급', '1급', '기본', '기초'], lang: 'ru' },
    DELE: { kind: 'level', levels: ['C2', 'C1', 'B2', 'B1', 'A2', 'A1'], lang: 'es' },
    DELF: { kind: 'level', levels: ['C2', 'C1', 'B2', 'B1', 'A2', 'A1'], lang: 'fr' },
    JLPT: { kind: 'level', levels: ['N1', 'N2', 'N3', 'N4', 'N5'], lang: 'ja' },
    HSK: { kind: 'level', levels: ['6급', '5급', '4급', '3급', '2급', '1급'], lang: 'zh' },
    IELTS: { kind: 'score', max: 9, step: 0.5, lang: 'english', notAccepted: true }
  };
  // 연세대 1차 지원에 내지 못하는 영어 시험
  const NOT_ACCEPTED = 'IELTS, TOEFL Home Edition, TOEFL ITP, Duolingo, TOEFL Best Score';

  /** 이 시험이 그 전형에 쓰이는가. FLEX 는 언어를 따로 적어 둔다(test.lang). */
  function testFitsTrack(test, track) {
    const def = test && TESTS[test.type];
    if (!def || def.notAccepted) return false;
    return (def.lang || test.lang) === track;
  }

  /** 전형에 맞는 내 시험 성적. 없으면 null. */
  function testFor(profile, track) {
    return ((profile && profile.languageTests) || []).find(t => testFitsTrack(t, track)) || null;
  }

  /** 시험 성적 한 줄 표시 — 'TOEFL 96', 'DELF B2', 'FLEX(프랑스어) 950'. */
  function testText(t) {
    if (!t) return '';
    const v = t.level || (t.score != null ? t.score : '');
    const lang = t.type === 'FLEX' && t.lang ? `(${(trackOf(t.lang) || {}).lang || t.lang})` : '';
    return `${t.type}${lang} ${v}`.trim();
  }

  /**
   * 비영어권 어학 반영 점수(40점 만점). 책자 3.2.2 표 그대로.
   * 해당 없는 등급이면 0, 판단할 값이 없으면 null.
   */
  function langPoints(test) {
    if (!test) return null;
    const def = TESTS[test.type];
    if (!def) return null;
    if (test.type === 'FLEX') {
      const s = Number(test.score);
      if (!Number.isFinite(s)) return null;
      return s >= 1000 ? 40 : s >= 901 ? 35 : s >= 800 ? 30 : 0;
    }
    if (def.kind !== 'level' || !test.level) return null;
    const idx = def.levels.indexOf(test.level);
    if (idx < 0) return null;
    const top = { Goethe: 'B2', DELE: 'B2', DELF: 'B2', TORFL: '1급', JLPT: 'N1', HSK: '6급' }[test.type];
    const topIdx = def.levels.indexOf(top);
    if (idx <= topIdx) return 40;
    if (idx === topIdx + 1) return 35;
    return 0;
  }

  /** 같은 계열 등급끼리 견준다 — 내 등급이 요구 등급 이상이면 true, 견줄 수 없으면 null. */
  function levelAtLeast(test, required) {
    if (!test || !test.level || !required) return null;
    const def = TESTS[test.type];
    if (!def || !def.levels) return null;
    const req = String(required).trim().toUpperCase().replace(/^HSK\s*/, '').replace(/^(\d)$/, '$1급');
    const mine = def.levels.indexOf(test.level);
    const need = def.levels.findIndex(l => l.toUpperCase() === req);
    if (mine < 0 || need < 0) return null;
    return mine <= need;
  }

  /** 어학 성적이 이 학기 기준으로 유효한가 — 응시일을 모르면 null. */
  function testValid(test, termData) {
    if (!test || !test.date || !termData) return null;
    const d = test.date.length === 7 ? `${test.date}-01` : test.date;
    return d >= termData.langValidFrom;
  }

  /* --------------------------------------------------------- 학적·공통 자격 */

  const DEGREES = [
    { key: 'undergrad', label: '학부' },
    { key: 'master', label: '석사' },
    { key: 'doctor', label: '박사' }
  ];
  // 연세대가 정한 TOEFL iBT 최소 점수(120점 만점). 학교 컷이 더 낮아도 이 아래면 지원할 수 없다.
  const FIELDS = [
    { key: 'humsoc', label: '인문·사회', toefl: 79 },
    { key: 'sci', label: '자연·공학·예체능·의치간', toefl: 68 }
  ];
  const GRAD_TOEFL = 100;
  const MIN_GPA = 2.8;

  function minToefl(profile) {
    const a = (profile && profile.academic) || {};
    if (a.degree && a.degree !== 'undergrad') return GRAD_TOEFL;
    const f = FIELDS.find(x => x.key === a.field);
    return f ? f.toefl : null;
  }

  /** 지원 시점까지 본교에서 이수해야 하는 학기 수. */
  function minSemesters(profile) {
    const a = (profile && profile.academic) || {};
    if (a.degree && a.degree !== 'undergrad') return 1;
    return a.transfer === '3' ? 1 : 2;
  }

  /**
   * 학교와 상관없는 연세대 공통 자격. 하나라도 fail 이면 어느 학교에도 지원할 수 없다.
   * 반환: [{ key, label, status: 'ok'|'fail'|'unknown', detail }]
   */
  function commonChecks(profile) {
    const p = profile || {};
    const a = p.academic || {};
    const track = p.exchangeTerm && p.exchangeTerm.track;
    const { data: termData } = termOf(p);
    const out = [];

    out.push(p.gpa == null
      ? { key: 'gpa', label: `학점 ${MIN_GPA} 이상`, status: 'unknown', detail: '학점을 입력해 주세요' }
      : { key: 'gpa', label: `학점 ${MIN_GPA} 이상`, status: p.gpa >= MIN_GPA ? 'ok' : 'fail', detail: `내 학점 ${formatGpa(p.gpa)}` });

    const need = minSemesters(p);
    out.push(a.semesters == null
      ? { key: 'semesters', label: `본교 ${need}학기 이상 이수`, status: 'unknown', detail: '지원서 낼 때까지 마친 학기 수를 입력해 주세요' }
      : { key: 'semesters', label: `본교 ${need}학기 이상 이수`, status: a.semesters >= need ? 'ok' : 'fail', detail: `지원 시점 ${a.semesters}학기` });

    if (!track) {
      out.push({ key: 'lang', label: '어학 기준', status: 'unknown', detail: '영어권·비영어권 중 지원할 전형을 정해 주세요' });
      return out;
    }
    if (a.langExempt) {
      out.push({ key: 'lang', label: '어학 기준', status: 'ok', detail: '어학 면제 대상 — 기간 안에 국제처 승인을 받아야 해요' });
      return out;
    }
    const test = testFor(p, track);
    if (track === 'english') {
      const min = minToefl(p);
      const label = `TOEFL ${min || '68~79'} 이상`;
      if (!test || test.score == null) out.push({ key: 'lang', label, status: 'unknown', detail: 'TOEFL iBT 점수를 입력해 주세요' });
      else if (!min) out.push({ key: 'lang', label, status: test.score >= 79 ? 'ok' : test.score >= 68 ? 'unknown' : 'fail', detail: `내 점수 ${test.score} · 계열을 정하면 정확히 판정해요` });
      else out.push({ key: 'lang', label, status: test.score >= min ? 'ok' : 'fail', detail: `내 점수 ${test.score}` });
    } else {
      const pts = langPoints(test);
      const label = `${(trackOf(track) || {}).lang} 공인 성적`;
      if (pts == null) out.push({ key: 'lang', label, status: 'unknown', detail: `${trackOf(track).tests.join(' 또는 ')} 성적을 입력해 주세요` });
      else out.push({ key: 'lang', label, status: pts >= 30 ? 'ok' : 'fail', detail: pts ? `${testText(test)} → 반영 ${pts}/40점` : `${testText(test)}은 반영 점수가 없어요` });
    }
    const valid = testValid(test, termData);
    if (valid === false) {
      out.push({ key: 'langDate', label: '어학 성적 유효기간', status: 'fail', detail: `${termData.langValidFrom.slice(0, 7).replace('-', '.')} 이후 응시한 성적만 인정돼요` });
    }
    return out;
  }

  /* ----------------------------------------------------------- 학교 언어권 */

  const LANG_WORDS = { english: 'english', french: 'fr', german: 'de', spanish: 'es', japanese: 'ja', chinese: 'zh', russian: 'ru' };
  /** 원본 Language 열('English, French') → ['english', 'fr']. */
  function parseLanguages(raw) {
    return String(raw || '').split(',').map(w => LANG_WORDS[w.trim().toLowerCase()]).filter(Boolean);
  }
  /** 이 학교에 그 전형으로 지원할 수 있는가. 언어 자료가 없으면 막지 않는다. */
  function schoolOffersTrack(school, track) {
    if (!track || !school) return true;
    const langs = school.languages || [];
    if (!langs.length) return true;
    return langs.includes(track);
  }

  /* ---------------------------------------------------------------- 배정 점수 */

  /**
   * 배정 총점 — 영어권 320(학점 백분위×2 + TOEFL), 비영어권 140(백분위 + 어학 40).
   * 학점 → 백분위 환산식이 책자에 없어서 백분위는 성적표의 값을 직접 받는다.
   * 어학 면제자는 "만점 × 내 학점 비율"로 환산한다는 책자 문장을 그대로 계산한 추정치다.
   */
  function totalScore(profile) {
    const p = profile || {};
    const a = p.academic || {};
    const track = p.exchangeTerm && p.exchangeTerm.track;
    if (!track || a.percentile == null) return null;
    const english = track === 'english';
    const gpaPart = english ? a.percentile * 2 : a.percentile;
    let langPart = null;
    let estimated = false;
    if (a.langExempt && p.gpa != null) {
      langPart = (english ? 120 : 40) * (p.gpa / 4.3);
      estimated = true;
    } else {
      const test = testFor(p, track);
      langPart = english ? (test && test.score != null ? Number(test.score) : null) : langPoints(test);
    }
    if (langPart == null) return null;
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
      total: round1(gpaPart + langPart),
      max: english ? 320 : 140,
      gpaPart: round1(gpaPart), gpaMax: english ? 200 : 100,
      langPart: round1(langPart), langMax: english ? 120 : 40,
      estimated
    };
  }

  /* -------------------------------------------------------------- 학점 인정 */

  /**
   * 학부 학기당 최대 인정 학점 — 1학기 졸업학점의 1/8, 1년 1/4 (5년제 건축 1/10, 1/5).
   * 대학원은 학기당 12학점. 소수점은 올림.
   */
  function creditLimit({ gradCredits, semesters = 1, arch5 = false, graduate = false }) {
    if (graduate) return 12 * semesters;
    if (!gradCredits) return null;
    const frac = semesters >= 2 ? (arch5 ? 1 / 5 : 1 / 4) : (arch5 ? 1 / 10 : 1 / 8);
    return Math.ceil(gradCredits * frac);
  }

  /**
   * 파견교에서 딴 학점 → 연세대 학점. ECTS 는 절반, 쿼터제는 2/3, 둘 다 올림.
   * 학기제는 그대로(실제로는 국제처가 수업 일수·시간을 보고 환산한다).
   */
  function convertCredits(earned, system) {
    const n = Number(earned);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (system === 'ects') return Math.ceil(n / 2);
    if (system === 'quarter') return Math.ceil(n * 2 / 3);
    return Math.ceil(n);
  }

  /** 학교 원본의 학제(academic_system) → 계산기의 학제. 유럽은 ECTS 로 본다. */
  function creditSystemOf(school) {
    if (!school) return 'semester';
    const sys = String(school.academicSystem || '').toLowerCase();
    if (sys === 'quarter') return 'quarter';
    if (school.region && String(school.region).includes('유럽')) return 'ects';
    return 'semester';
  }

  /* ------------------------------------------------------------------ 장학금 */

  const SCHOLARSHIPS = [
    { id: 'mirae', name: '미래에셋 해외교환장학생', amount: '아시아 650만 · 그 외 850만 원', when: '3월 공고 (가을 파견)',
      cond: '한국 국적 학부생 · 전학년·직전학기 2.87 이상 · 학자금 지원구간 8구간 이내',
      check: (p) => (p.gpa == null ? null : p.gpa >= 2.87) },
    { id: 'global', name: '글로벌리더 장학금', amount: '학기당 400만 원', when: '4월 (미래에셋 발표 후)',
      cond: '한국 국적 · 신촌/국제캠 학부생 · 전체 3.1 이상 · 학자금 3구간 이내',
      check: (p) => (p.gpa == null ? null : p.gpa >= 3.1) },
    { id: 'goabroad', name: '교류활성화 장학금', amount: '학기당 200만 원', when: '4월 대상자에게 개별 안내',
      cond: '교류활성화 대상 대학으로 가는 교환학생 · 다른 교환 장학금과 중복 불가 (대상 대학은 명단에서 확인)',
      check: () => null },
    { id: 'icu', name: '이윤재 글로벌 인재 장학금', amount: '학기당 400만 원', when: '자동 수혜',
      cond: '일본 International Christian University(ICU)로 가는 학부생',
      // ICU 로 가는 사람에게만 '해당'이라고 알린다 — 다른 학교면 미달이 아니라 해당이 없는 것
      check: (p, school) => (school && /International Christian University/i.test(school.name) ? true : null) },
    { id: 'vsp', name: 'VSP 장학금', amount: '연세대 등록금의 80%', when: '방문학생 선발 시',
      cond: '방문학생 프로그램(VSP) 참가자 · 교내 다른 장학금과 중복 불가',
      check: () => null }
  ];

  return {
    TERMS, TRACKS, TESTS, DEGREES, FIELDS, MIN_GPA, GRAD_TOEFL, NOT_ACCEPTED, SCHOLARSHIPS,
    WISHLIST_MAX: 25,
    // 지금 학교 목록(schools 테이블)이 어느 학기 명단인지. 새 명단을 가져오면 바꾼다.
    SCHOOLS_TERM: '2027-1',
    termKeyOf, termLabel, termOf, kst, fmtDate, daysUntil, addDays,
    scheduleFor, upcoming, beforePlacement,
    trackOf, trackLabel, testFitsTrack, testFor, testText, langPoints, levelAtLeast, testValid,
    minToefl, minSemesters, commonChecks,
    parseLanguages, schoolOffersTrack,
    totalScore, creditLimit, convertCredits, creditSystemOf
  };
})();
