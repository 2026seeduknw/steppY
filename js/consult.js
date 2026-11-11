/**
 * Talky(옛 이름 Mentor's Step) — 공개 질문·답변 게시판.
 *
 * 질문·답변은 누구나(비로그인 포함) 읽을 수 있고, 올리려면 로그인이 필요하다.
 * 이름·이메일은 어디에도 표시하지 않는다 — 소수 인원만 가는 학교의 질문이면
 * "이 질문 = 누구"로 짐작될 수 있어서, 학교 태그(선택)와 별개로 작성자 표시
 * 자체를 아예 없앴다(질문·답변 둘 다).
 *
 * 크레딧이 걸린 두 동작(질문 등록 -10 / 답변 등록 +10)은 클라이언트에서 계산하지
 * 않는다 — supabase/mentor_step.sql의 ask_question/submit_answer RPC가 서버에서
 * 원자적으로 처리하고, js/state.js(AppState.askQuestion/submitAnswer)가 그 결과를
 * 받아서만 화면을 바꾼다.
 *
 * 학교별 "관련 후기"는 예전 챗봇(키워드 매칭, js/review-topics.js)의 로직을 그대로
 * 재사용해 질문 상세 보조 패널로 보여준다 — 학교를 지정한 질문에서만 뜬다.
 */
(function () {
  AppState.load();


  const state = { region: null, country: '', onlyFavorite: false };

  const listEl = document.getElementById('mentorList');
  const countryFilterMount = document.getElementById('mentorCountryFilter');
  const favToggle = document.getElementById('mentorFavToggle');
  const creditWrap = document.getElementById('mentorCredit');
  const creditNum = document.getElementById('mentorCreditNum');
  const askOpenBtn = document.getElementById('askOpenBtn');
  const pinsEl = document.getElementById('mentorPins');
  const panelEl = document.getElementById('mentorQaPanel');
  const ledeEl = document.getElementById('mentorLede');

  /**
   * 비로그인은 게시판을 통째로 잠근다 — 질문·답변·고정 글 모두 로그인해야 보인다.
   * 세션 확인은 비동기(Auth.init)라서, 끝나기 전에는 화면을 가려 둔다. 안 그러면
   * 로그인한 사람에게도 잠금 화면이 잠깐 번쩍인다. (서버 쪽 잠금은
   * supabase/mentor_lock_guests.sql — 화면만 가리면 API로는 여전히 읽힌다.)
   */
  function showGuestLock() {
    ledeEl.textContent = '교환 준비하며 궁금한 걸 남기면 다녀온 선배가 답해줘요.';
    // 블러 뒤에 깔리는 건 진짜 글이 아니라 모양만 같은 예시다 — 서버를 잠가도 같은 화면이 나온다.
    const pin = (kind, title) => pinCardHtml({ kind, title, meta: '운영진' });
    const row = (flag, country, title, count, meta) => questionCardHtml({ flag, country, title, count, meta });
    panelEl.innerHTML = `
      <div class="mentor-preview">
        <div class="mentor-preview__blur" aria-hidden="true" inert>
          <div class="m2-ask"><span class="m2-ask__in">다녀온 선배에게 궁금한 걸 물어보세요</span><span class="m2-ask__btn">✎ 질문</span></div>
          <div class="m2-sec"><h2>선배의 기록</h2></div>
          <div class="m2-cols">
            ${pin('report', '2026-1 교환보고서 모음')}
            ${pin('column', '교환 가기 전 챙길 서류 TOP 5')}
            ${pin('notice', '멘토스텝 이용 규칙')}
          </div>
          <div class="m2-sec"><h2>질문 · 답변</h2><span>최신순</span></div>
          <div class="mentor-list">
            ${row('🇫🇷', '프랑스', '리옹 기숙사 신청은 언제까지 해야 하나요?', 4, '2시간 전')}
            ${row('🇺🇸', '미국', '비자 인터뷰 때 가져가야 할 서류 알려주세요', 7, '5시간 전')}
            ${row('🇯🇵', '일본', '학점 인정 과목은 출국 전에 확정되나요?', 0, '1일 전')}
          </div>
        </div>
        <section class="mentor-preview__lock card card-pad">
          <div class="mentor-locked__icon" aria-hidden="true">🔒</div>
          <h2 class="mentor-locked__title">로그인하면 볼 수 있어요</h2>
          <p class="mentor-locked__desc">다녀온 선배의 질문·답변, 교환보고서와 칼럼을 읽고 직접 질문도 할 수 있어요.</p>
          <a class="btn btn--primary btn--block" href="auth.html">로그인 · 회원가입</a>
        </section>
      </div>`;
  }

  /*
   * 목업 — 아직 서버에 고정 글·질문이 하나도 없을 때만 보여 주는 예시. 진짜 글이 하나라도 생기면
   * 그쪽만 보이고 이 예시는 사라진다. 예시 질문에는 답변을 달 수 없고 즐겨찾기도 저장하지 않는다.
   */
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const SAMPLE_PINS = [
    { id: 'sample-p1', sample: true, kind: 'report', title: '리옹 한 학기,\n월 생활비 정산', author_label: 'Lyon 3 · 2026-1', created_at: ago(30),
      body: '기숙사(CROUS) 월 420유로, 식비는 장보기 위주로 월 250유로 정도였어요.\n교통은 학생 정기권이 월 25유로라 거의 걸어 다녔고, 여행비를 빼면 한 달 평균 80만 원 안팎이었어요.' },
    { id: 'sample-p2', sample: true, kind: 'column', title: '비자 인터뷰\n10분 컷 준비법', author_label: '선배 멘토 · 3일 전', image: 'assets/mock/cafe-laptop.webp', created_at: ago(72),
      body: '입학허가서, 재정 증명, 보험 증서 세 가지를 순서대로 클리어파일에 넣어 가면 질문이 거의 없어요.\n영문 이름 철자가 여권과 같은지 꼭 확인하세요.' },
    { id: 'sample-p3', sample: true, kind: 'notice', title: '질문·답변은\n이름 없이 올라가요', author_label: '운영진', created_at: ago(120),
      body: '누가 물었는지, 누가 답했는지 표시하지 않아요.\n다녀온 선배라면 아는 만큼 편하게 답해 주세요.' }
  ];
  const SAMPLE_QUESTIONS = [
    { id: 'sample-q1', sample: true, country: '프랑스', schoolName: 'Sciences Po', title: '기숙사 신청은 언제 열려요? 사설 기숙사도 괜찮을까요', createdAt: ago(2),
      body: '2027 가을학기 파견 예정이에요.\n학교 기숙사 신청 시기를 놓칠까 봐 걱정돼요.',
      answers: [
        { id: 'sa1', body: '합격 메일 오고 2주 뒤에 포털이 열렸어요.\nCROUS는 빨리 차니까 열리자마자 넣으세요.', createdAt: ago(1) },
        { id: 'sa2', body: '사설은 Studapart가 무난했어요.\n보증인 서비스(Visale)를 미리 신청해 두면 편해요.', createdAt: ago(0.7) },
        { id: 'sa3', body: '저는 학교 기숙사 떨어져서 홈스테이 했는데 오히려 불어가 많이 늘었어요.', createdAt: ago(0.5) }
      ] },
    { id: 'sample-q2', sample: true, country: '덴마크', schoolName: 'Aalborg Univ.', title: '덴마크 거주허가 나오기까지 얼마나 걸렸어요?', createdAt: ago(26),
      body: '6월 말에 신청하면 8월 출국 전에 받을 수 있을까요?',
      answers: [{ id: 'sa4', body: '저는 5주 걸렸어요.\n생체정보 등록 예약이 밀리니까 신청하자마자 잡으세요.', createdAt: ago(20) }] },
    { id: 'sample-q3', sample: true, country: '미국', schoolName: 'UC Riverside', title: '학점 인정 미리 받으려면 실라버스는 어디서 구해요?', createdAt: ago(75),
      body: '학과 홈페이지에는 과목 설명만 있고 실라버스가 없어요.', answers: [] },
    { id: 'sample-q4', sample: true, country: '핀란드', schoolName: 'Aalto Univ.', title: '겨울 옷은 한국에서 사 가는 게 나을까요?', createdAt: ago(170),
      body: '1월 파견이라 패딩이랑 방한화를 어디서 살지 고민이에요.',
      answers: [
        { id: 'sa5', body: '패딩은 한국에서 가져가고, 방한화는 현지 세일 때 사는 걸 추천해요.', createdAt: ago(160) },
        { id: 'sa6', body: '헬싱키 중고 가게(UFF)에 좋은 겨울 옷이 많아요.', createdAt: ago(150) }
      ] }
  ];
  const isSampleMode = () => !MOCK.mentorQuestions.length;
  const allQuestions = () => (isSampleMode() ? SAMPLE_QUESTIONS : MOCK.mentorQuestions);

  // 상단 고정 글 — 운영자가 mentor_pins 테이블(supabase/mentor_pins.sql)에 직접 넣는다.
  // 테이블이 없거나 읽지 못하면 조용히 비워 둔다(게시판은 그대로 보인다).
  const PIN_KIND = { notice: '공지', report: '교환보고서', column: '칼럼' };
  let pins = [];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function timeAgo(iso) {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const hr = Math.floor(diffMin / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}일 전`;
    return `${Math.floor(day / 30)}개월 전`;
  }

  function schoolName(id) {
    const s = MOCK.schools.find(x => x.id === id);
    return s ? s.name : null;
  }

  /**
   * 학교 찾기/국가별 후기(js/reviews.js)가 쓰는 대륙 묶음을 그대로 재사용한다 —
   * 국가 고르는 카드 자리를 새로 만들 때마다 대륙 분류가 어긋나지 않도록.
   */
  const REGION_ICON = { '미주': '🌎', '유럽': '🌍', '아시아/오세아니아': '🌏', '기타': '🌐' };
  const REGION_LABEL_EN = { '미주': 'Americas', '유럽': 'Europe', '아시아/오세아니아': 'Asia/Oceania', '기타': 'Other' };

  function buildCountryRegions() {
    const countryMap = new Map();
    (MOCK.schools || []).forEach(school => {
      const key = school.country;
      if (!key) return;
      if (!countryMap.has(key)) countryMap.set(key, { country: key, countryEn: school.countryEn, region: school.region || '기타', schoolCount: 0 });
      countryMap.get(key).schoolCount += 1;
    });
    const countries = [...countryMap.values()].sort((a, b) => (a.countryEn || a.country).localeCompare(b.countryEn || b.country));
    const regionMap = new Map();
    countries.forEach(c => {
      if (!regionMap.has(c.region)) regionMap.set(c.region, { region: c.region, countries: [], schoolCount: 0 });
      const r = regionMap.get(c.region);
      r.countries.push(c);
      r.schoolCount += c.schoolCount;
    });
    return [...regionMap.values()].sort((a, b) => b.schoolCount - a.schoolCount);
  }

  /* ---------------------------------------------------------------- 목록 */

  function renderCreditBadge() {
    // 크레딧을 없앴다 — 배지는 늘 숨긴다
    if (creditWrap) creditWrap.hidden = true;
    return;
    // eslint-disable-next-line no-unreachable
    creditNum.textContent = AppState.getCredits();
  }

  /**
   * 국가 필터 — 목록 위 칩 한 줄, 가로 스크롤. 예전 국가별 후기(js/reviews.js)와
   * 같은 순서로 고른다: 먼저 대륙 칩, 그중 하나를 누르면 그 대륙의 국가 칩으로
   * 바뀐다("← 대륙" 칩으로 되돌아갈 수 있다) — 32개국을 한 줄에 다 늘어놓지
   * 않고 먼저 좁힌 뒤 고르게 한다. 실제로 목록을 거르는 건 국가를 골랐을 때뿐이고,
   * 대륙은 그 목록을 좁히는 중간 단계일 뿐이다(눌러도 아래 글은 안 걸러짐).
   */
  function renderCountryFilter() {
    if (!countryFilterMount) return;
    const regions = buildCountryRegions();

    // 별표한 국가는 대륙을 거치지 않고 맨 앞에서 바로 고른다
    const allCountries = regions.flatMap(r => r.countries);
    const favs = AppState.getFavoriteCountries()
      .map(name => allCountries.find(c => c.country === name))
      .filter(Boolean);

    if (!state.region) {
      countryFilterMount.innerHTML = `
        <button type="button" class="chip${state.country === '' ? ' is-selected' : ''}" data-region="">전체</button>
        ${favs.map(c => `
          <button type="button" class="chip chip--fav${state.country === c.country ? ' is-selected' : ''}" data-country="${escapeHtml(c.country)}">
            <span class="chip__star" aria-hidden="true">★</span>${countryFlag(c.countryEn) || '🌍'} ${escapeHtml(c.country)}
          </button>`).join('')}
        ${regions.map(r => `
          <button type="button" class="chip" data-region="${r.region}">${REGION_LABEL_EN[r.region] || r.region}</button>
        `).join('')}`;
    } else {
      const region = regions.find(r => r.region === state.region);
      // 국가 칩마다 오른쪽에 별 — 한 알약 안에 "고르기"와 "별표" 버튼 두 개를 나란히 둔다
      countryFilterMount.innerHTML = `
        <button type="button" class="chip" data-region-back>← ${REGION_LABEL_EN[state.region] || state.region}</button>
        ${(region ? region.countries : []).map(c => {
          const fav = AppState.isCountryFavorite(c.country);
          return `
          <span class="chip country-chip${state.country === c.country ? ' is-selected' : ''}">
            <button type="button" class="country-chip__pick" data-country="${escapeHtml(c.country)}">
              ${countryFlag(c.countryEn) || '🌍'} ${escapeHtml(c.country)}
            </button>
            <button type="button" class="country-chip__star${fav ? ' is-on' : ''}" data-country-fav="${escapeHtml(c.country)}"
                    aria-pressed="${fav}" aria-label="${escapeHtml(c.country)} 즐겨찾기">${fav ? '★' : '☆'}</button>
          </span>`;
        }).join('')}`;
    }

    countryFilterMount.querySelectorAll('[data-country-fav]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
        const on = AppState.toggleCountryFavorite(btn.dataset.countryFav);
        btn.classList.toggle('is-on', on);
        btn.textContent = on ? '★' : '☆';
        btn.setAttribute('aria-pressed', String(on));
        if (typeof showToast === 'function') showToast(on ? '즐겨찾기한 국가는 맨 앞에서 바로 고를 수 있어요' : '국가 즐겨찾기를 뺐어요');
      });
    });

    countryFilterMount.querySelectorAll('[data-region]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.region = btn.dataset.region || null;
        state.country = '';
        renderCountryFilter();
        renderList();
      });
    });
    countryFilterMount.querySelectorAll('[data-region-back]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.region = null;
        state.country = '';
        renderCountryFilter();
        renderList();
      });
    });
    countryFilterMount.querySelectorAll('[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.country = btn.dataset.country;
        renderCountryFilter();
        renderList();
      });
    });
  }

  function filteredQuestions() {
    return allQuestions().filter(q => {
      if (state.country && q.country !== state.country) return false;
      if (state.onlyFavorite && (q.sample || !AppState.isQuestionFavorite(q.id))) return false;
      return true;
    });
  }

  /**
   * 카드 대신 네이버 카페식 게시글 목록 — 한 줄에 제목 + 답변 수, 그 아래 한
   * 줄에 국가/학교·시간·즐겨찾기만 작게. 게시글이 많아질수록(271개교 x 여러
   * 질문) 카드보다 이 밀도가 스크롤 없이 더 많이 훑어볼 수 있다.
   */
  /** 질문 카드 — 나라 · 제목 · 고정 보조 줄(학교 · 시간) + 답변 수 배지. 답변이 없으면 노란 '답변 기다리는 중' */
  function questionCardHtml({ flag, country, title, meta, count, fav, id }) {
    return `
      <${id ? 'button type="button"' : 'div'} class="m2-q"${id ? ` data-open-question="${id}"` : ''}>
        <span class="m2-q__top">
          <span>${flag ? flag + ' ' : ''}${escapeHtml(country)}</span>
          <span class="m2-q__star${fav ? ' is-on' : ''}"${id ? ` data-fav-toggle-q="${id}" role="button" aria-label="즐겨찾기" aria-pressed="${fav}"` : ''}>★</span>
        </span>
        <span class="m2-q__t">${escapeHtml(title)}</span>
        <span class="m2-q__foot">
          <span>${meta}</span>
          <span class="m2-ans${count ? '' : ' is-wait'}">${count ? `답변 ${count}` : '답변 기다리는 중'}</span>
        </span>
      </${id ? 'button' : 'div'}>`;
  }
  function questionRowTemplate(q) {
    const sName = q.schoolName || (q.schoolId ? schoolName(q.schoolId) : null);
    // 질문에는 한글 나라 이름만 있어서, 같은 나라 학교의 영문 이름으로 국기를 찾는다
    const en = ((MOCK.schools || []).find(sc => sc.country === q.country) || {}).countryEn;
    const flag = en && typeof countryFlag === 'function' ? countryFlag(en) : '';
    return questionCardHtml({
      id: q.id, flag, country: q.country, title: q.title, count: q.answers.length,
      fav: !q.sample && AppState.isQuestionFavorite(q.id),
      meta: `${sName ? `${escapeHtml(sName)} · ` : ''}${timeAgo(q.createdAt)}`
    });
  }

  function openAskSheet() {
    if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
    openAskSheetImpl();
  }

  /** 선배의 기록 — 고정 글을 홈 바로가기처럼 색 상자로 옆으로 넘긴다(교환보고서 · 칼럼 · 공지) */
  const PIN_TONE = { report: 'sand', column: 'sky', notice: 'plum' };
  function pinCardHtml({ kind, title, meta, id, image }) {
    const tag = id ? 'button type="button"' : 'div';
    const photo = image ? ` style="background-image:url('${escapeHtml(image)}')"` : '';
    return `
      <${tag} class="m2-col m2-col--${PIN_TONE[kind] || 'plum'}${image ? ' has-photo' : ''}"${id ? ` data-open-pin="${escapeHtml(id)}"` : ''}${photo}>
        <span class="m2-col__top">
          <span class="m2-col__k">${PIN_KIND[kind] || '공지'}</span>
          <small class="m2-col__meta">${meta}</small>
        </span>
        <span class="m2-col__t">${escapeHtml(title).replace(/\n/g, '<br>')}</span>
      </${id ? 'button' : 'div'}>`;
  }
  function pinRowTemplate(p) {
    // 사진(image_url)이 있는 글은 카드 바탕을 사진으로 — 칼럼에 사진을 붙일 수 있게
    return pinCardHtml({ id: p.id, kind: p.kind, title: p.title, image: p.image_url || p.image || '', meta: escapeHtml(p.author_label || '운영진') });
  }

  function renderPins() {
    // 즐겨찾기만 모아 볼 때는 고정 글을 접어 둔다 — 내가 찜한 글만 보이는 화면이라서
    if (!pins.length || state.onlyFavorite) { pinsEl.hidden = true; pinsEl.innerHTML = ''; return; }
    pinsEl.hidden = false;
    pinsEl.innerHTML = `<div class="m2-sec"><h2>선배의 기록</h2></div><div class="m2-cols">${pins.map(pinRowTemplate).join('')}</div>`;
    pinsEl.querySelectorAll('[data-open-pin]').forEach(el => {
      el.addEventListener('click', () => openPinPage(el.dataset.openPin));
    });
  }

  async function loadPins() {
    // mentor_pins.sql을 안 돌린 서버면 테이블이 없다(PGRST205) — 하루 동안은 다시 묻지 않고 예시 글을 쓴다
    const MISSING_KEY = 'steppy_mentor_pins_missing';
    let missing = false;
    try { missing = Date.now() - Number(localStorage.getItem(MISSING_KEY) || 0) < 864e5; } catch (e) { /* 무시 */ }
    pins = [];
    if (!missing) {
      try {
        const res = await supabaseClient.from('mentor_pins')
          .select('*')   // image_url 열이 생기면 그대로 받는다
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });
        if (res.error && res.error.code === 'PGRST205') { try { localStorage.setItem(MISSING_KEY, String(Date.now())); } catch (e) { /* 무시 */ } }
        pins = res.error ? [] : (res.data || []);
      } catch (e) { pins = []; }
    }
    if (!pins.length) pins = SAMPLE_PINS;
    renderPins();
  }

  function renderList() {
    renderCreditBadge();
    renderPins();
    const items = filteredQuestions();
    const secNote = document.getElementById('mentorListNote');
    if (secNote) secNote.textContent = isSampleMode() ? '예시 글' : '최신순';
    if (!items.length) {
      listEl.innerHTML = `
        <div class="m2-empty">
          <p>아직 질문이 없어요.<br>첫 질문을 남겨보세요.</p>
          <button type="button" class="m2-ask__btn" id="mentorEmptyAsk">✎ 질문하기</button>
        </div>`;
      const btn = document.getElementById('mentorEmptyAsk');
      if (btn) btn.addEventListener('click', openAskSheet);
      return;
    }
    listEl.innerHTML = items.map(questionRowTemplate).join('');
    listEl.querySelectorAll('[data-open-question]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-fav-toggle-q]')) return;
        openQuestionSheet(el.dataset.openQuestion);
      });
    });
    listEl.querySelectorAll('[data-fav-toggle-q]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
        if (String(btn.dataset.favToggleQ).startsWith('sample-')) { if (typeof showToast === 'function') showToast('예시 질문은 즐겨찾기할 수 없어요'); return; }
        const active = AppState.toggleQuestionFavorite(btn.dataset.favToggleQ);
        btn.classList.toggle('is-on', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    });
  }

  favToggle.addEventListener('click', () => {
    if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
    state.onlyFavorite = !state.onlyFavorite;
    favToggle.classList.toggle('is-selected', state.onlyFavorite);
    favToggle.setAttribute('aria-pressed', String(state.onlyFavorite));
    renderList();
  });
  askOpenBtn.addEventListener('click', openAskSheet);
  document.getElementById('askOpenField').addEventListener('click', openAskSheet);

  /* ---------------------------------------------------------- 바텀시트 공통 */

  function openSheet(html, { onOpen } = {}) {
    document.querySelectorAll('.app-sheet--mentor').forEach(el => el.remove());
    const sheet = document.createElement('div');
    sheet.className = 'app-sheet app-sheet--mentor';
    sheet.innerHTML = html;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    document.body.classList.add('is-sheet-open');
    const close = () => {
      sheet.classList.remove('is-open');
      document.body.classList.remove('is-sheet-open');
      setTimeout(() => sheet.remove(), 300);
    };
    sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    if (onOpen) onOpen(sheet, close);
    return { sheet, close };
  }

  /* ------------------------------------------------------------- 질문하기 */

  function openAskSheetImpl() {
    const html = `
      <div class="app-sheet__scrim" data-close></div>
      <div class="app-sheet__panel" role="dialog" aria-modal="true" aria-label="질문하기">
        <div class="app-sheet__grip" data-close></div>
        <div class="app-sheet__head"><h2>질문하기</h2><button type="button" class="app-sheet__done" data-close>닫기</button></div>
        <div class="app-sheet__body">
          <form class="mentor-form" id="askForm">
            <div class="mentor-form__field">
              <span class="mentor-form__label">국가</span>
              <button type="button" class="mentor-select-trigger" id="askCountryTrigger">
                <span id="askCountryTriggerLabel" class="is-placeholder">국가를 선택하세요</span>
                <span aria-hidden="true">›</span>
              </button>
            </div>
            <div class="mentor-form__field">
              <span class="mentor-form__label">학교 (선택)</span>
              <div id="askSchoolPicker"></div>
            </div>
            <label class="mentor-form__field">
              <span class="mentor-form__label">제목</span>
              <input type="text" name="title" maxlength="60" required placeholder="예: 기숙사 계약 언제부터 해요?">
            </label>
            <label class="mentor-form__field">
              <span class="mentor-form__label">내용</span>
              <textarea name="body" required placeholder="상황을 자세히 적어주면 상세한 답변을 받기 쉬워져요."></textarea>
            </label>
            <button type="submit" class="btn btn--accent btn--block" id="askSubmitBtn">질문 등록</button>
          </form>
        </div>
      </div>`;
    openSheet(html, {
      onOpen: (sheet, close) => {
        let selectedSchool = null;
        let selectedCountry = '';

        const pickerMount = sheet.querySelector('#askSchoolPicker');
        const items = MOCK.schools.map(s => ({ value: s.id, label: s.name, group: s.country }));
        const select = createSearchableSelect({
          items, selected: null, multiple: false,
          placeholder: '학교를 검색해서 선택하세요 (선택)',
          onChange: (value) => { selectedSchool = value || null; }
        });
        pickerMount.appendChild(select.el);

        const countryTrigger = sheet.querySelector('#askCountryTrigger');
        const countryLabel = sheet.querySelector('#askCountryTriggerLabel');
        countryTrigger.addEventListener('click', () => {
          openCountryPickerSheet((country) => {
            selectedCountry = country;
            countryLabel.textContent = country;
            countryLabel.classList.remove('is-placeholder');
          });
        });

        const form = sheet.querySelector('#askForm');
        const submitBtn = sheet.querySelector('#askSubmitBtn');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const title = (new FormData(form).get('title') || '').trim();
          const body = (new FormData(form).get('body') || '').trim();
          if (!selectedCountry) {
            if (typeof showToast === 'function') showToast('국가를 선택해 주세요.');
            return;
          }
          if (!title || !body) return;
          submitBtn.disabled = true;
          submitBtn.textContent = '등록 중…';
          const res = await AppState.askQuestion({ country: selectedCountry, schoolId: selectedSchool, title, body });
          if (!res.ok) {
            submitBtn.disabled = false;
            submitBtn.textContent = '질문 등록';
            if (typeof showToast === 'function') showToast('질문을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.');
            return;
          }
          if (typeof trackEvent === 'function') trackEvent('mentor_question_asked', { country: selectedCountry });
          close();
          renderList();
          if (typeof showToast === 'function') showToast('질문을 등록했어요');
        });
      }
    });
  }

  /**
   * 국가 선택 — 예전 국가별 후기(js/reviews.js)에 있던 대륙 → 국가 카드 방식을
   * 그대로 가져오되, 바텀시트 안이라 한 단 작게(3열) 줄였다. 질문하기 시트
   * 위에 한 장 더 쌓이는 자리라 body의 is-sheet-open은 건드리지 않는다 —
   * 이미 질문하기 시트가 잠가 둔 걸 여기서 풀면 뒤 시트 스크롤이 풀려버린다.
   */
  function openCountryPickerSheet(onPick) {
    const regions = buildCountryRegions();
    let activeRegion = null;

    function bodyHtml() {
      if (!activeRegion) {
        return `
          <div class="mentor-country-grid">
            ${regions.map(r => `
              <button type="button" class="mentor-country-card" data-region="${r.region}">
                <span class="mentor-country-card__flag">${REGION_ICON[r.region] || '🌐'}</span>
                <span class="mentor-country-card__name">${REGION_LABEL_EN[r.region] || r.region}</span>
                <span class="mentor-country-card__meta">${r.countries.length}개국</span>
              </button>`).join('')}
          </div>`;
      }
      const region = regions.find(r => r.region === activeRegion);
      return `
        <button type="button" class="mentor-back" data-back>← 대륙 전체</button>
        <div class="mentor-country-grid">
          ${region.countries.map(c => `
            <button type="button" class="mentor-country-card" data-country="${escapeHtml(c.country)}">
              <span class="mentor-country-card__flag">${countryFlag(c.countryEn) || '🌍'}</span>
              <span class="mentor-country-card__name">${escapeHtml(c.country)}</span>
              <span class="mentor-country-card__meta">${c.schoolCount}개 학교</span>
            </button>`).join('')}
        </div>`;
    }

    const sheet = document.createElement('div');
    sheet.className = 'app-sheet app-sheet--mentor-picker';
    sheet.innerHTML = `
      <div class="app-sheet__scrim" data-close></div>
      <div class="app-sheet__panel" role="dialog" aria-modal="true" aria-label="국가 선택">
        <div class="app-sheet__grip" data-close></div>
        <div class="app-sheet__head"><h2>국가 선택</h2><button type="button" class="app-sheet__done" data-close>닫기</button></div>
        <div class="app-sheet__body" id="countryPickerBody"></div>
      </div>`;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('is-open'));

    const close = () => {
      sheet.classList.remove('is-open');
      setTimeout(() => sheet.remove(), 300);
    };
    sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

    const bodyEl = sheet.querySelector('#countryPickerBody');
    function wire() {
      bodyEl.querySelectorAll('[data-region]').forEach(btn => {
        btn.addEventListener('click', () => { activeRegion = btn.dataset.region; bodyEl.innerHTML = bodyHtml(); wire(); });
      });
      bodyEl.querySelectorAll('[data-back]').forEach(btn => {
        btn.addEventListener('click', () => { activeRegion = null; bodyEl.innerHTML = bodyHtml(); wire(); });
      });
      bodyEl.querySelectorAll('[data-country]').forEach(btn => {
        btn.addEventListener('click', () => { onPick(btn.dataset.country); close(); });
      });
    }
    bodyEl.innerHTML = bodyHtml();
    wire();
  }

  /* --------------------------------------------------------- 질문 상세 */

  function relatedReviewsHtml(q) {
    if (!q.schoolId) return '';
    const all = MOCK.schoolReviews[q.schoolId] || [];
    if (!all.length) return '';
    const topics = matchReviewTopics(`${q.title} ${q.body}`);
    const hits = topics.length ? all.filter(r => topics.includes(r.tag)) : [];
    if (!hits.length) return '';
    return `
      <div class="mentor-related">
        <h3 class="mentor-section-title">관련 후기</h3>
        ${hits.slice(0, 3).map(r => `
          <div class="chat-message__quote">
            <div class="chat-message__quote-meta">${r.tag ? `#${escapeHtml(r.tag)} · ` : ''}${escapeHtml(r.author || '선배 후기')}</div>
            <div class="chat-message__quote-text">${escapeHtml(r.text)}</div>
          </div>`).join('')}
      </div>`;
  }

  /** 답변 카드 — 이름 없이 순서대로 A, B, C… 로만 구분한다(작성자를 드러내지 않는다) */
  function answerItemTemplate(a, i) {
    const letter = String.fromCharCode(65 + (i % 26));
    return `
      <div class="m2d-a">
        <div class="m2d-a__who"><span class="m2d-a__av${i ? ' is-alt' : ''}">${letter}</span>답변 ${letter}</div>
        <p class="m2d-a__body">${escapeHtml(a.body).replace(/\n/g, '<br>')}</p>
        <div class="m2d-a__foot">${timeAgo(a.createdAt)}</div>
      </div>`;
  }

  /** 학교 국가(한글) 기준으로 국기를 찾는다 — 질문에는 country만 있고
   *  countryEn은 없어서, 그 나라 학교 아무거나 하나 찾아 countryEn을 빌린다. */
  function countryFlagFor(countryKo) {
    const school = MOCK.schools.find(s => s.country === countryKo);
    return school ? countryFlag(school.countryEn) : '';
  }

  /**
   * 질문 상세는 바텀시트도, 모달도 아니라 진짜 새 창(전체 화면)처럼 뜨게 한다 —
   * 모달(.modal-scrim/.modal-panel)은 94vh라도 위쪽에 뒷화면이 살짝 비치고
   * 아래서 올라오는 느낌이 남아서, 아예 뷰포트 전체를 덮는 별도 레이어로
   * 바꿨다. 뒤로가기는 아이콘 하나가 아니라 "← 뒤로" 글자로 분명하게 뒀다.
   */
  function openQuestionSheet(id) {
    const q = allQuestions().find(x => x.id === id);
    if (!q) return;
    const sName = q.schoolName || (q.schoolId ? schoolName(q.schoolId) : null);
    const flag = countryFlagFor(q.country) || '🌍';
    const isOwn = AppState.isAuthed && typeof Auth !== 'undefined' && q.authorId === Auth.userId;

    const page = document.createElement('div');
    page.className = 'mentor-page';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.setAttribute('aria-label', '질문 상세');
    page.classList.add('m2d-page');
    page.innerHTML = `
      <div class="m2d-top">
        <button type="button" class="m2d-back" data-page-close aria-label="뒤로">‹</button>
        <span class="m2d-top__t"><b>질문</b><small>Talky</small></span>
        <span></span>
      </div>
      <div class="mentor-page__body m2d">
        <p class="m2d-country">${flag} ${escapeHtml(q.country)}${sName ? ` · ${escapeHtml(sName)}` : ''}</p>
        <h1 class="m2d-title">${escapeHtml(q.title)}</h1>
        <p class="m2d-body">${escapeHtml(q.body).replace(/\n/g, '<br>')}</p>
        <div class="m2d-meta">${timeAgo(q.createdAt)}</div>
        ${relatedReviewsHtml(q)}
        <div class="m2-sec"><h2>답변 ${q.answers.length}</h2></div>
        <div id="mentorAnswerList">${q.answers.length ? q.answers.map(answerItemTemplate).join('') : '<p class="m2d-empty">아직 답변이 없어요.</p>'}</div>
      </div>
      ${q.sample ? `
      <div class="m2d-bar"><span class="m2d-bar__in">예시 질문에는 답변할 수 없어요</span></div>` : isOwn ? '' : `
      <form class="m2d-bar" id="answerForm">
        <textarea class="m2d-bar__in" name="body" rows="1" required placeholder="아는 만큼 답해 주세요"></textarea>
        <button type="submit" class="m2d-bar__btn" id="answerSubmitBtn">등록</button>
      </form>`}`;
    document.body.appendChild(page);
    document.body.classList.add('is-sheet-open');
    requestAnimationFrame(() => page.classList.add('is-open'));

    const close = () => {
      page.classList.remove('is-open');
      document.body.classList.remove('is-sheet-open');
      setTimeout(() => page.remove(), 300);
    };
    page.addEventListener('click', (e) => { if (e.target.closest('[data-page-close]')) close(); });

    const form = page.querySelector('#answerForm');
    if (form) {
      // 입력창은 한 줄로 시작해서 쓰는 만큼 늘어난다(최대 5줄쯤)
      const ta = form.querySelector('textarea');
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
        const fd = new FormData(form);
        const body = (fd.get('body') || '').trim();
        if (!body) return;
        const submitBtn = page.querySelector('#answerSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '등록 중…';
        const res = await AppState.submitAnswer({ questionId: q.id, body });
        if (!res.ok) {
          submitBtn.disabled = false;
          submitBtn.textContent = '등록';
          if (typeof showToast === 'function') showToast('답변을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        if (typeof trackEvent === 'function') trackEvent('mentor_answer_submitted', { questionId: q.id });
        close();
        renderList();
        if (typeof showToast === 'function') showToast('답변을 등록했어요');
      });
    }
  }

  /** 고정 글 상세 — 질문 상세와 같은 전체 화면 레이어. 답변 입력은 없다. */
  function openPinPage(id) {
    const p = pins.find(x => x.id === id);
    if (!p) return;
    const page = document.createElement('div');
    page.className = 'mentor-page';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.setAttribute('aria-label', PIN_KIND[p.kind] || '공지');
    page.innerHTML = `
      <div class="mentor-page__head">
        <button type="button" class="mentor-page__back" data-page-close>← 뒤로</button>
      </div>
      <div class="mentor-page__body">
        <div class="mentor-detail">
          <div class="mentor-detail__tags">
            <span class="mentor-pin__badge mentor-pin__badge--${escapeHtml(p.kind)}">${PIN_KIND[p.kind] || '공지'}</span>
          </div>
          <h3 class="mentor-detail__title">${escapeHtml(p.title)}</h3>
          <p class="mentor-detail__body">${escapeHtml(p.body)}</p>
          <div class="mentor-detail__meta">${escapeHtml(p.author_label || '운영진')} · ${timeAgo(p.created_at)}</div>
        </div>
      </div>`;
    document.body.appendChild(page);
    document.body.classList.add('is-sheet-open');
    requestAnimationFrame(() => page.classList.add('is-open'));
    const close = () => {
      page.classList.remove('is-open');
      document.body.classList.remove('is-sheet-open');
      setTimeout(() => page.remove(), 300);
    };
    page.addEventListener('click', (e) => { if (e.target.closest('[data-page-close]')) close(); });
    if (typeof trackEvent === 'function') trackEvent('mentor_pin_open', { kind: p.kind });
  }

  renderCountryFilter();
  renderList();

  document.body.classList.add('mentor-gating');
  Auth.init().then(() => {
    document.body.classList.remove('mentor-gating');
    if (!AppState.isAuthed) { showGuestLock(); return; }
    loadPins();
  });

  document.addEventListener('MOCK:updated', () => {
    renderCountryFilter();
    renderList();
  });
})();
