/**
 * Mentor's Step — 공개 질문·답변 게시판.
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

  const ASK_COST = BM.ASK_COST;
  const ANSWER_REWARD = BM.ANSWER_REWARD;

  const state = { region: null, country: '', onlyFavorite: false };

  const listEl = document.getElementById('mentorList');
  const countryFilterMount = document.getElementById('mentorCountryFilter');
  const favToggle = document.getElementById('mentorFavToggle');
  const creditWrap = document.getElementById('mentorCredit');
  const creditNum = document.getElementById('mentorCreditNum');
  const askOpenBtn = document.getElementById('askOpenBtn');
  const pinsEl = document.getElementById('mentorPins');

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
    if (!AppState.isAuthed) { creditWrap.hidden = true; return; }
    creditWrap.hidden = false;
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
          <button type="button" class="chip" data-region="${r.region}">${REGION_ICON[r.region] || '🌐'} ${REGION_LABEL_EN[r.region] || r.region}</button>
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
    return MOCK.mentorQuestions.filter(q => {
      if (state.country && q.country !== state.country) return false;
      if (state.onlyFavorite && !AppState.isQuestionFavorite(q.id)) return false;
      return true;
    });
  }

  /**
   * 카드 대신 네이버 카페식 게시글 목록 — 한 줄에 제목 + 답변 수, 그 아래 한
   * 줄에 국가/학교·시간·즐겨찾기만 작게. 게시글이 많아질수록(271개교 x 여러
   * 질문) 카드보다 이 밀도가 스크롤 없이 더 많이 훑어볼 수 있다.
   */
  function questionRowTemplate(q) {
    const isFav = AppState.isQuestionFavorite(q.id);
    const sName = q.schoolId ? schoolName(q.schoolId) : null;
    return `
      <button type="button" class="mentor-row" data-open-question="${q.id}">
        <div class="mentor-row__line">
          <span class="mentor-row__tag">[${escapeHtml(q.country)}]</span>
          <span class="mentor-row__title">${escapeHtml(q.title)}</span>
          ${q.answers.length ? `<span class="mentor-row__count">[${q.answers.length}]</span>` : ''}
        </div>
        <div class="mentor-row__foot">
          <span class="mentor-row__meta">${sName ? `${escapeHtml(sName)} · ` : ''}${timeAgo(q.createdAt)}</span>
          <span class="mentor-row__fav ${isFav ? 'is-active' : ''}" data-fav-toggle-q="${q.id}" role="button" aria-label="즐겨찾기">
            <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.2C.5 7.8 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.5 3.8 4 7.3-2.5 4.6-10 9.2-10 9.2z"/></svg>
          </span>
        </div>
      </button>`;
  }

  function openAskSheet() {
    if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
    openAskSheetImpl();
  }

  /** 고정 글 한 줄 — 일반 글과 같은 두 줄 틀이되, 종류 배지와 옅은 배경으로 구분한다. */
  function pinRowTemplate(p) {
    return `
      <button type="button" class="mentor-row mentor-row--pin" data-open-pin="${escapeHtml(p.id)}">
        <div class="mentor-row__line">
          <span class="mentor-pin__badge mentor-pin__badge--${escapeHtml(p.kind)}">${PIN_KIND[p.kind] || '공지'}</span>
          <span class="mentor-row__title mentor-pin__title">${escapeHtml(p.title)}</span>
        </div>
        <div class="mentor-row__foot">
          <span class="mentor-row__meta">${escapeHtml(p.author_label || '운영진')} · ${timeAgo(p.created_at)}</span>
        </div>
      </button>`;
  }

  function renderPins() {
    // 즐겨찾기만 모아 볼 때는 고정 글을 접어 둔다 — 내가 찜한 글만 보이는 화면이라서
    if (!pins.length || state.onlyFavorite) { pinsEl.hidden = true; pinsEl.innerHTML = ''; return; }
    pinsEl.hidden = false;
    pinsEl.innerHTML = pins.map(pinRowTemplate).join('');
    pinsEl.querySelectorAll('[data-open-pin]').forEach(el => {
      el.addEventListener('click', () => openPinPage(el.dataset.openPin));
    });
  }

  async function loadPins() {
    try {
      const res = await supabaseClient.from('mentor_pins')
        .select('id, kind, title, body, author_label, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      pins = res.error ? [] : (res.data || []);
    } catch (e) { pins = []; }
    renderPins();
  }

  function renderList() {
    renderCreditBadge();
    renderPins();
    const items = filteredQuestions();
    if (!items.length) {
      listEl.innerHTML = `
        <div class="empty-state mentor-empty">
          <p>아직 질문이 없어요. 첫 질문을 남겨보세요.</p>
          <button type="button" class="btn btn--accent" id="mentorEmptyAsk">질문하기</button>
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
        const active = AppState.toggleQuestionFavorite(btn.dataset.favToggleQ);
        btn.classList.toggle('is-active', active);
      });
    });
  }

  favToggle.addEventListener('click', () => {
    if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
    state.onlyFavorite = !state.onlyFavorite;
    favToggle.classList.toggle('is-on');
    renderList();
  });
  askOpenBtn.addEventListener('click', openAskSheet);
  creditWrap.addEventListener('click', () => openPaywall({ reason: 'menu' }));
  document.addEventListener('credits:changed', renderCreditBadge);

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
            <div class="mentor-form__cost">질문 등록에 <strong>🪙 ${ASK_COST}</strong> 크레딧이 필요해요 · 내 크레딧 <strong id="askBalance">${AppState.getCredits()}</strong></div>
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
          if (AppState.getCredits() < ASK_COST) {
            // 쓴 글은 그대로 두고 결제창을 위에 겹쳐 연다 — 충전하고 돌아와 바로 등록할 수 있게
            openPaywall({ reason: 'credits', need: ASK_COST });
            return;
          }
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

  function answerItemTemplate(a) {
    return `
      <div class="mentor-answer">
        <div class="mentor-answer__meta">${timeAgo(a.createdAt)}</div>
        <div class="mentor-answer__body">${escapeHtml(a.body)}</div>
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
    const q = MOCK.mentorQuestions.find(x => x.id === id);
    if (!q) return;
    const sName = q.schoolId ? schoolName(q.schoolId) : null;
    const flag = countryFlagFor(q.country) || '🌍';
    const isOwn = AppState.isAuthed && typeof Auth !== 'undefined' && q.authorId === Auth.userId;

    const page = document.createElement('div');
    page.className = 'mentor-page';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.setAttribute('aria-label', '질문 상세');
    page.innerHTML = `
      <div class="mentor-page__head">
        <button type="button" class="mentor-page__back" data-page-close>← 뒤로</button>
      </div>
      <div class="mentor-page__body">
        <div class="mentor-detail">
          <div class="mentor-detail__tags">
            <span class="mentor-detail__flag" title="${escapeHtml(q.country)}" aria-label="${escapeHtml(q.country)}">${flag}</span>
            ${sName ? `<span class="chip chip--sm mentor-detail__school">${escapeHtml(sName)}</span>` : ''}
          </div>
          <h3 class="mentor-detail__title">${escapeHtml(q.title)}</h3>
          <p class="mentor-detail__body">${escapeHtml(q.body)}</p>
          <div class="mentor-detail__meta">${timeAgo(q.createdAt)}</div>
        </div>
        ${relatedReviewsHtml(q)}
        <div class="mentor-answers">
          <h3 class="mentor-section-title">답변 ${q.answers.length}개</h3>
          <div id="mentorAnswerList">${q.answers.length ? q.answers.map(answerItemTemplate).join('') : '<p class="mentor-answers__empty">아직 답변이 없어요.</p>'}</div>
        </div>
        ${isOwn ? '' : `
        <form class="mentor-form mentor-answer-form" id="answerForm">
          <textarea name="body" required placeholder="아는 만큼 도와주세요"></textarea>
          <div class="mentor-form__cost">답변을 등록하면 <strong>🪙 +${ANSWER_REWARD}</strong> 크레딧을 받아요</div>
          <button type="submit" class="btn btn--accent btn--block" id="answerSubmitBtn">답변 등록</button>
        </form>`}
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

    const form = page.querySelector('#answerForm');
    if (form) {
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
          submitBtn.textContent = '답변 등록';
          if (typeof showToast === 'function') showToast('답변을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        if (typeof trackEvent === 'function') trackEvent('mentor_answer_submitted', { questionId: q.id });
        close();
        renderList();
        if (typeof showToast === 'function') showToast('답변을 등록했어요. 크레딧을 받았어요');
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
  loadPins();

  document.addEventListener('MOCK:updated', () => {
    renderCountryFilter();
    renderList();
  });
})();
