(function () {
  AppState.load();

  const LABELS = {
    // 기온이 말해주는 만큼만 적는다. climateType은 계절 평균기온 네 개로만
    // 나눈 값이라(js/data-source.js climateTypeFromTemps) 강수·습도·일조 자료가
    // 아예 없다. 예전 라벨('고온다습', '한랭·일조 짧음', '온화·잦은 비')은
    // 측정한 적 없는 것을 단정했고, 특히 '온화·잦은 비'는 나머지를 전부 받는
    // else 가지라 마드리드·바르셀로나·로마처럼 여름이 건조한 도시까지 묶였다.
    climateType: { 'four-season': '사계절 뚜렷', hot: '연중 더움', cold: '겨울 영하', 'mild-winter': '겨울 온화' },
    commerceLevel: { high: '상권 풍부', medium: '상권 보통', low: '상권 작음' },
    securityLevel: { high: '치안 우수', medium: '치안 보통', low: '치안 주의' },
    // 원본 목록에서 UIC 전용 파견교는 학교 이름 앞에 "(UIC Exclusive)"가 붙어
    // 있는 것이 전부다. 별도 컬럼이 없어 이름으로 가른다.
    program: { uic: 'UIC 전용', open: '전체 학부' },
    // 원본 Language 열에 English 가 들어 있는지 하나로 가른 값이다
    // (supabase/build_import.py). "영어 전용"이 아니라 "영어로 들을 수 있음"이다.
    track: { english: '영어', nonEnglish: '현지어' }
  };

  /** UIC(언더우드국제대학) 소속만 지원할 수 있는 파견교인지. */
  function programOf(school) {
    return /^\s*\(UIC Exclusive\)/i.test(school.name || '') ? 'uic' : 'open';
  }

  const state = {
    query: '', country: '', majors: new Set(), regions: new Set(),
    programs: new Set(), tracks: new Set(),
    commerce: new Set(), climate: new Set(), security: new Set(),
    qsMax: null, onlyEligible: false, onlyFavorite: false, sort: 'default', page: 1,
    // 내 전형(언어권)으로 지원할 수 있는 학교만 — 국제처 규칙상 다른 언어권 학교는 희망대학표에 못 쓴다
    onlyMyTrack: true,
    costBand: ''   // '' | low | mid | high — 한 달 생활비 추정치 구간
  };

  // 한 달 물가 구간(원). 271곳의 사분위가 약 238만 · 306만 · 367만이라 250·350만에서 끊었다.
  const COST_BANDS = { low: [0, 2500000], mid: [2500000, 3500000], high: [3500000, Infinity] };

  // 271개를 한 화면에 다 그리면 스크롤이 지나치게 길어진다 — 한 페이지 5개로 끊는다.
  const PAGE_SIZE = 5;

  function uniq(field) { return [...new Set(MOCK.schools.map(s => s[field]).filter(v => v != null))]; }

  // school.majors(학교별 지원 가능 전공)는 원본 데이터가 없어 항상 빈 배열이라(알려진
  // 한계) 학과 필터가 실제로는 아무것도 안 걸러냈다 — 대신 major_matches(전공 매칭
  // 결과)에 이 학교·전공 조합이 있는지로 판단한다. school.id -> 매칭된 홈전공 Set.
  let schoolMajorMatchMap = new Map();
  function rebuildMajorMatchMap() {
    schoolMajorMatchMap = new Map();
    (MOCK.majorMatches || []).forEach(m => {
      if (!schoolMajorMatchMap.has(m.school)) schoolMajorMatchMap.set(m.school, new Set());
      schoolMajorMatchMap.get(m.school).add(m.homeMajor);
    });
  }
  function rebuildCreditMap() {
    majorCreditMap = buildMajorCreditMap(AppState.profile && AppState.profile.major);
  }
  function schoolHasMajorMatch(school, major) {
    const set = schoolMajorMatchMap.get(school.id);
    return !!set && set.has(major);
  }

  // school.id → 내 전공으로 인정이 예상되는 과목 수 (js/components/major-credit.js)
  let majorCreditMap = new Map();

  function renderFilters() {
    renderQuickFilters();
    renderMajorFilter();
    renderChipGroup('programFilters', ['uic', 'open'], state.programs, LABELS.program);
    renderChipGroup('trackFilters', uniq('track'), state.tracks, LABELS.track);
    renderChipGroup('commerceFilters', uniq('commerceLevel'), state.commerce, LABELS.commerceLevel);
    renderChipGroup('securityFilters', uniq('securityLevel'), state.security, LABELS.securityLevel);
  }

  // 연세대 전공 마스터 리스트(76개) 기준 검색 가능한 다중 선택 드롭다운.
  // school.majors(학교별 지원 가능 전공)는 원본에 없어 항상 비어있으므로 옵션 목록만
  // MOCK.yonseiMajors로 채우고, 실제 필터링은 schoolHasMajorMatch()로 major_matches를 본다.
  function renderMajorFilter() {
    const mount = document.getElementById('majorFilters');
    mount.innerHTML = '';
    const items = MOCK.yonseiMajors.map(m => ({ value: m.majorName, label: m.majorName, group: m.college }));
    const select = createSearchableSelect({
      items,
      selected: [...state.majors],
      multiple: true,
      placeholder: '학과 검색',
      onChange: (values) => { state.majors = new Set(values); state.page = 1; renderGrid(); }
    });
    mount.appendChild(select.el);
  }

  /**
   * 검색창 아래 빠른 필터 세 개. 값은 기존 state(regions·country·climate)에 그대로 쓴다.
   *   대륙/국가 — 'r:유럽'(대륙 전체) 또는 'c:덴마크'(한 나라). 둘은 서로를 지운다.
   *   기후      — 하나만 고른다(시트에 있을 때는 여러 개였다).
   */
  function renderQuickFilters() {
    const regionSel = document.getElementById('quickRegion');
    const current = state.country ? `c:${state.country}` : (state.regions.size ? `r:${[...state.regions][0]}` : '');
    regionSel.innerHTML = `<option value="">대륙/국가</option>` + uniq('region').map(r => {
      const countries = [...new Set(MOCK.schools.filter(s => s.region === r).map(s => s.country))].sort((a, b) => a.localeCompare(b, 'ko'));
      return `<optgroup label="${r}">
        <option value="r:${r}">${r} 전체</option>
        ${countries.map(c => `<option value="c:${c}">${c}</option>`).join('')}
      </optgroup>`;
    }).join('');
    regionSel.value = current;

    const climateSel = document.getElementById('quickClimate');
    climateSel.innerHTML = `<option value="">기후/날씨</option>` +
      uniq('climateType').map(v => `<option value="${v}">${LABELS.climateType[v] || v}</option>`).join('');
    climateSel.value = state.climate.size ? [...state.climate][0] : '';

    document.getElementById('quickCost').value = state.costBand;
    syncQuickFilterState();
  }
  // 고른 필터는 칩이 채워진다 — 지금 무엇이 걸려 있는지 시트를 열지 않고 보인다.
  function syncQuickFilterState() {
    ['quickRegion', 'quickCost', 'quickClimate'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.toggle('is-active', !!el.value);
    });
  }

  function renderChipGroup(mountId, values, selectedSet, labelMap) {
    const mount = document.getElementById(mountId);
    mount.innerHTML = values.map(v => `<button type="button" class="chip ${selectedSet.has(v) ? 'is-selected' : ''}" data-value="${v}">${labelMap ? labelMap[v] : v}</button>`).join('');
    mount.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const v = chip.dataset.value;
        if (selectedSet.has(v)) selectedSet.delete(v); else selectedSet.add(v);
        chip.classList.toggle('is-selected');
        state.page = 1;
        renderGrid();
      });
    });
  }

  function matchesFilters(school) {
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = `${school.name} ${school.nameKo} ${school.country} ${school.majors.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.country && school.country !== state.country) return false;
    if (state.majors.size && ![...state.majors].some(m => schoolHasMajorMatch(school, m))) return false;
    if (state.programs.size && !state.programs.has(programOf(school))) return false;
    if (state.tracks.size && !state.tracks.has(school.track)) return false;
    if (state.regions.size && !state.regions.has(school.region)) return false;
    if (state.commerce.size && !state.commerce.has(school.commerceLevel)) return false;
    if (state.climate.size && !state.climate.has(school.climateType)) return false;
    if (state.security.size && !state.security.has(school.securityLevel)) return false;
    if (state.costBand) {
      const [min, max] = COST_BANDS[state.costBand];
      const cost = school.monthlyLivingCostKrw;
      // 물가 자료가 없는 학교는 구간을 고른 동안에는 뺀다 — 어느 칸인지 알 수 없다.
      if (cost == null || cost < min || cost >= max) return false;
    }
    if (state.qsMax && school.qsRank > state.qsMax) return false;
    if (state.onlyFavorite && !AppState.isFavorite(school.id)) return false;
    if (state.onlyMyTrack && myTrack() && !OIA.schoolOffersTrack(school, myTrack())) return false;
    if (state.onlyEligible && computeEligibility(AppState.profile, school).status !== 'go') return false;
    return true;
  }

  function sortSchools(list) {
    const profile = AppState.profile;
    if (state.sort === 'major') {
      return [...list].sort((a, b) => Number(schoolHasMajorMatch(b, profile.major)) - Number(schoolHasMajorMatch(a, profile.major)) || a.qsRank - b.qsRank);
    }
    if (state.sort === 'slot') {
      return [...list].sort((a, b) => b.slot - a.slot);
    }
    return list;
  }

  /**
   * 나라 화면 — 책장 머리의 "N schools →"를 누르면 같은 화면 위에 그 나라 학교만 모아
   * 예전 큰 카드(생활비·GPA·어학 컷·학점 인정 띠)로 연다. 주소에 #country=… 를 남겨
   * 휴대폰 뒤로가기로도 닫힌다. 지금 걸린 필터는 그대로 적용된다.
   */
  let openCountry = null;
  function openCountryView(country) {
    openCountry = country;
    history.pushState({ country }, '', '#country=' + encodeURIComponent(country));
    renderCountryView();
  }
  function closeCountryView(fromHistory) {
    if (!openCountry) return;
    openCountry = null;
    const view = document.getElementById('countryView');
    if (view) { view.classList.remove('is-open'); setTimeout(() => view.remove(), 280); }
    document.body.classList.remove('has-country-view');
    if (!fromHistory) history.back();
  }
  window.addEventListener('popstate', () => {
    const m = location.hash.match(/^#country=(.+)$/);
    if (m) { openCountry = decodeURIComponent(m[1]); renderCountryView(); }
    else closeCountryView(true);
  });
  function renderCountryView() {
    const list = sortSchools(MOCK.schools.filter(matchesFilters)).filter(sc => sc.country === openCountry);
    let view = document.getElementById('countryView');
    const fresh = !view;
    if (fresh) {
      view = document.createElement('div');
      view.id = 'countryView';
      view.className = 'v2-country';
      view.setAttribute('role', 'dialog');
      document.body.appendChild(view);
    }
    const first = list[0] || MOCK.schools.find(sc => sc.country === openCountry) || {};
    view.innerHTML = `
      <header class="v2-country__bar">
        <button type="button" class="v2-country__back" data-country-close aria-label="뒤로">‹</button>
        <h1 class="v2-country__title">${first.countryEn || openCountry} ${countryFlag(first.countryEn)}</h1>
        <span class="v2-country__count">${list.length}곳</span>
      </header>
      <div class="v2-country__body school-grid">
        ${list.length ? list.map(schoolCardTemplate).join('') : '<div class="empty-state">지금 필터에 맞는 학교가 없어요.</div>'}
      </div>`;
    view.querySelector('[data-country-close]').addEventListener('click', () => closeCountryView(false));
    view.setAttribute('aria-label', `${openCountry} 학교 목록`);
    bindSchoolCards(view);
    document.body.classList.add('has-country-view');
    if (fresh) requestAnimationFrame(() => view.classList.add('is-open'));
    else view.classList.add('is-open');
  }

  function renderGrid() {
    const filtered = sortSchools(MOCK.schools.filter(matchesFilters));
    document.getElementById('resultCount').innerHTML = `<strong>${filtered.length}</strong>개 학교`;
    const grid = document.getElementById('schoolGrid');
    const pager = document.getElementById('schoolPager');
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state">조건에 맞는 학교가 없어요. 필터를 조정해보세요.</div>`;
      if (pager) pager.innerHTML = '';
      return;
    }
    // 한 줄 = 한 나라. 나라 안의 학교는 책장처럼 옆으로 넘겨 본다 —
    // 271곳을 세로 카드로 쌓으면 나라를 비교하기 전에 스크롤부터 하게 된다.
    // 나라 순서는 정렬 결과에서 처음 나오는 순서를 따른다(정렬을 바꾸면 줄 순서도 바뀐다).
    if (pager) pager.innerHTML = '';
    const byCountry = new Map();
    filtered.forEach(sc => {
      if (!byCountry.has(sc.country)) byCountry.set(sc.country, []);
      byCountry.get(sc.country).push(sc);
    });
    grid.innerHTML = [...byCountry].map(([country, list], i) => `
      <section class="v2-shelf">
        <header class="v2-shelf__head">
          <h2 class="v2-shelf__country">${list[0].countryEn || country} ${countryFlag(list[0].countryEn)}</h2>
          <button type="button" class="v2-shelf__count" data-shelf-open="${country}">${list.length} school${list.length > 1 ? 's' : ''} →</button>
        </header>
        <div class="v2-shelf__track"><div class="v2-shelf__row">${list.map(shelfCardTemplate).join('')}</div></div>
      </section>`).join('');
    grid.querySelectorAll('[data-shelf-open]').forEach(btn => {
      btn.addEventListener('click', () => openCountryView(btn.dataset.shelfOpen));
    });
    bindSchoolCards(grid);
    // 로고는 비율이 제각각이라 칸이 아니라 면적을 맞춘다(logo-fit.js)
    fitLogosIn(grid, '.v2-book__logo img', { maxW: 64, maxH: 42, area: 38 * 38 });
    // 나라 화면이 열려 있으면(필터를 바꿨거나 하이드레이션으로 다시 그릴 때) 그 화면도 새로 그린다
    if (openCountry) renderCountryView();
  }

  function bindSchoolCards(root) {
    root.querySelectorAll('[data-open-school]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-fav-toggle-card]')) return;
        // 큰 카드 아래 띠(인정 예상 과목)는 학점 인정 탭으로 보낸다
        if (e.target.closest('[data-credit-link]')) { location.href = 'credits.html'; return; }
        const schoolId = el.dataset.openSchool;
        // 학과 필터로 찾아 들어온 거면, 모달의 "유사 전공"도 그 필터 기준으로 보여준다
        // (여러 학과를 동시에 선택했으면 이 학교가 실제로 매칭되는 학과를 고른다).
        const contextMajor = [...state.majors].find(m => schoolHasMajorMatch({ id: schoolId }, m));
        openSchoolModal(schoolId, { onChange: renderGrid, contextMajor });
      });
    });
    root.querySelectorAll('[data-fav-toggle-card]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const active = AppState.toggleFavorite(btn.dataset.favToggleCard);
        btn.classList.toggle('is-active', active);
        // 책장 카드의 하트는 글자(♡/♥), 큰 카드의 하트는 SVG라 글자만 바꾼다
        if (btn.classList.contains('v2-book__fav')) btn.textContent = active ? '♥' : '♡';
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  }

  /** 271곳 중 한 달 생활비가 비싼 순으로 몇 % 안에 드는지(상위 1% = 가장 비쌈). */
  function costPercentile(school) {
    const v = school.monthlyLivingCostKrw;
    if (v == null || isNaN(v)) return null;
    const all = MOCK.schools.map(s => s.monthlyLivingCostKrw).filter(x => x != null && !isNaN(x));
    const rank = all.filter(x => x > v).length + 1;
    return Math.max(1, Math.round(rank / all.length * 100));
  }

  /** "Aalborg University (AAU)" — 이름에 이미 괄호 약어가 있으면 그대로 쓴다. */
  function nameWithAbbr(school) {
    if (/\([A-Za-z.&\s]+\)\s*$/.test(school.name)) return school.name;
    return `${school.name} (${abbrOf(school.name)})`;
  }

  // 약어는 학교 이름 본체(" - 단과대" 앞)의 대문자 단어 머리글자로 만든다. 자료에 공식 약어가 없어
  // 실제 약어와 다를 수 있다(코펜하겐 UCPH → UC).
  function abbrOf(name) {
    const stop = new Set(['of', 'the', 'and', 'at', 'in', 'de', 'du', 'des', 'la', 'le', 'für', 'for']);
    const base = name.split(/\s[-–]\s|\(/)[0];
    const letters = base.split(/\s+/).filter(w => w && !stop.has(w.toLowerCase()) && /^[A-Za-zÀ-ÿ]/.test(w)).map(w => w[0].toUpperCase());
    return letters.join('').slice(0, 5) || schoolInitials(name);
  }

  // "모집 4명 · " — 여러 캠퍼스가 정원을 나눠 쓰는 학교(UC 계열 등)는 '공동'으로 적는다(school-modal.js quotaLabel 과 같은 기준)
  function slotText(school) {
    if (typeof school.slot !== 'number') return '';
    const shared = typeof SHARED_QUOTA_GROUPS !== 'undefined' && SHARED_QUOTA_GROUPS.some(g => g.test(school.id));
    return `${shared ? '공동' : '모집'} ${school.slot}명 · `;
  }

  function shelfCardTemplate(school) {
    const elig = computeEligibility(AppState.profile, school);
    const isFav = AppState.isFavorite(school.id);
    const logo = typeof SCHOOL_LOGOS !== 'undefined' && SCHOOL_LOGOS[school.id];
    const pct = costPercentile(school);
    const cost = school.monthlyLivingCostKrw != null ? `월 ${Math.round(school.monthlyLivingCostKrw / 10000).toLocaleString('ko-KR')}만` : '생활비 정보 없음';
    const gpa = formatGpa(school.gpaCut) || school.gpaCut || '-';
    const lang = school.langTest && school.langTest.cut != null ? `${school.langTest.type} ${school.langTest.cut}` : '어학 -';
    return `
      <div class="v2-book" role="button" tabindex="0" data-open-school="${school.id}">
        <div class="v2-book__cover">
          <span class="v2-book__logo">${logo
            ? `<img src="assets/school-logos/${logo}" alt="" loading="lazy" data-abbr="${abbrOf(school.name)}">`
            : `<span class="v2-book__abbr">${schoolInitials(school.name)}</span>`}</span>
          <button type="button" class="v2-book__fav ${isFav ? 'is-active' : ''}" data-fav-toggle-card="${school.id}"
                  aria-label="찜하기" aria-pressed="${isFav}">${isFav ? '♥' : '♡'}</button>
        </div>
        <p class="v2-book__name"><span>${nameWithAbbr(school)}</span></p>
        <p class="v2-book__line">GPA ${gpa} · ${lang} <span class="v2-book__elig v2-book__elig--${elig.status}">${elig.status === 'go' ? '✓ ' : ''}${elig.label}</span></p>
        <p class="v2-book__line">${slotText(school)}${cost}${pct ? ` <span class="v2-book__pct${pct <= 30 ? ' is-high' : ''}">상위 ${pct}%</span>` : ''}</p>
      </div>`;
  }

  function renderPager(pager, totalPages) {
    if (!pager) return;
    if (totalPages <= 1) { pager.innerHTML = ''; return; }
    pager.innerHTML = `
      <button type="button" class="pager-btn" id="pagerPrev" ${state.page <= 1 ? 'disabled' : ''} aria-label="이전 페이지">‹</button>
      <span class="pager-status">${state.page} / ${totalPages}</span>
      <button type="button" class="pager-btn" id="pagerNext" ${state.page >= totalPages ? 'disabled' : ''} aria-label="다음 페이지">›</button>
    `;
    const goTo = (page) => {
      state.page = page;
      renderGrid();
      document.getElementById('schoolGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.getElementById('pagerPrev').addEventListener('click', () => goTo(state.page - 1));
    document.getElementById('pagerNext').addEventListener('click', () => goTo(state.page + 1));
  }

  function schoolCardTemplate(school) {
    const elig = computeEligibility(AppState.profile, school);
    const isFav = AppState.isFavorite(school.id);
    return `
      <button type="button" class="card card--interactive school-card" data-open-school="${school.id}">
        <div class="school-card__top">
          <div class="school-card__meta">
            <span class="school-card__qs">${school.qsRank ? `QS ${school.qsRank}` : '순위 미정'}</span>
            ${eligibilityBadgeHtml(elig)}
            <span class="badge badge--neutral">${quotaLabel(school)}</span>
          </div>
          <span class="fav-btn ${isFav ? 'is-active' : ''}" data-fav-toggle-card="${school.id}">
            <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.2C.5 7.8 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.5 3.8 4 7.3-2.5 4.6-10 9.2-10 9.2z"/></svg>
          </span>
        </div>
        <div class="school-card__name">${countryFlag(school.countryEn)} ${school.name}</div>
        <div class="school-card__loc">${school.country} · ${school.city}</div>
        <div class="school-card__stats">
          <div><div class="school-card__stat-label">GPA 컷</div><div class="school-card__stat-value">${formatGpa(school.gpaCut) || school.gpaCut || '-'}</div></div>
          <div><div class="school-card__stat-label">${school.langTest.type}</div><div class="school-card__stat-value">${school.langTest.cut ?? '-'}</div></div>
          <div><div class="school-card__stat-label">한 달 물가</div><div class="school-card__stat-value">${formatMonthlyCost(school.monthlyLivingCostKrw)}</div></div>
        </div>
        ${creditBandHtml(school)}
      </button>
    `;
  }

  /**
   * 카드 맨 아래 띠 — 내 전공으로 인정이 예상되는 과목 수. 누르면 학점 인정 탭으로 간다.
   * 전공을 아직 입력하지 않았으면(게스트 포함) 띠를 두지 않는다 — 셀 기준이 없다.
   */
  function creditBandHtml(school) {
    const major = AppState.profile && AppState.profile.major;
    if (!major) return '';
    const label = majorShortLabel(major);
    const n = majorCreditMap.get(school.id);
    if (!n) return `<span class="school-card__credit school-card__credit--none">${label} 학점 인정 예상 과목 자료가 아직 없어요</span>`;
    return `<span class="school-card__credit" data-credit-link>
      <span>${label} 학점 인정 예상 과목: <strong>${n}개</strong> 보유</span>
      <span class="school-card__credit-arrow" aria-hidden="true">›</span>
    </span>`;
  }

  // ---- Simulation ----
  /**
   * 로그인 전에는 비교할 "내 점수"가 없어서 목표 시뮬레이션이 성립하지 않는다
   * (지금보다 몇 개 더 갈 수 있는지를 계산하는 기능이다).
   * 대신 점수를 직접 받아 지원 가능 여부를 바로 보여준다. 이 값은 계정이 아니라
   * 이 기기(localStorage)에만 남는다.
   */
  /**
   * 배너 자리는 로그인 여부로 갈린다.
   *   로그인 — 학점 인정으로 보내는 카드(search.html에 심어둔 마크업)
   *   게스트 — 점수 입력 패널. 로그인 전에는 판정 기준이 될 내 점수가 없다.
   *
   * 부팅 시점의 isAuthed는 아직 false다(세션 복구가 비동기). 예전에는 그 한 번으로
   * 결정하고 끝내서, 로그인한 사용자도 게스트 패널을 계속 보고 있었다.
   * 이제 하이드레이션 후 MOCK:updated에서 다시 판단한다.
   */
  const simBanner = document.querySelector('.sim-banner');
  const SIM_BANNER_CTA_HTML = simBanner ? simBanner.innerHTML : '';

  function renderBanner() {
    if (!simBanner) return;
    if (AppState.isAuthed) {
      if (simBanner.querySelector('.credits-cta')) return;
      simBanner.className = 'sim-banner sim-banner--cta';
      simBanner.innerHTML = SIM_BANNER_CTA_HTML;
      return;
    }
    if (simBanner.querySelector('#guestScoreForm')) return;
    renderGuestScorePanel();
  }

  function renderGuestScorePanel() {
    const banner = simBanner;
    const p = AppState.profile;
    const lang = (p.languageTests || []).find(t => !OIA.TESTS[t.type]?.notAccepted) || { type: 'TOEFL', score: '' };
    // 게스트는 시험 하나로 전형까지 정한다 — 시험이 곧 언어다(FLEX 는 언어를 따로 골라야 해서 뺐다).
    // IELTS 는 연세대 1차 지원에 낼 수 없어 목록에 없다(js/oia-rules.js).
    const LANGS = ['TOEFL', 'JLPT', 'HSK', 'DELF', 'DELE', 'Goethe', 'TORFL'];
    const filled = p.gpa !== null && p.gpa !== undefined;
    const value = lang.level || (lang.score != null ? lang.score : '');

    banner.classList.remove('sim-banner--cta');
    banner.classList.add('sim-banner--guest');
    banner.innerHTML = `
      <div class="score-prompt__head">
        <p class="score-prompt__title">${filled ? '입력한 점수로 판정하고 있어요' : '학점과 어학 점수를 입력해보세요'}</p>
        <p class="score-prompt__sub">${filled ? '언제든 고칠 수 있어요. 로그인하면 계정에 저장돼요.' : '지원 가능 여부를 알려드려요'}</p>
      </div>
      <form class="score-prompt__form" id="guestScoreForm">
        <label class="score-prompt__field">
          <span>학점</span>
          <input type="number" step="0.01" min="0" max="4.3" data-decimals="2" name="gpa"
                 value="${filled ? p.gpa : ''}" placeholder="3.2">
        </label>
        <label class="score-prompt__field">
          <span>어학</span>
          <select name="langType">${LANGS.map(t => `<option ${t === lang.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        <label class="score-prompt__field">
          <span>점수·등급</span>
          <input type="text" name="langScore" value="${value}" placeholder="96 · N2 · B2">
        </label>
        <button type="submit" class="btn btn--accent btn--sm">적용</button>
      </form>`;

    document.getElementById('guestScoreForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const gpa = fd.get('gpa') === '' ? null : roundDecimals(fd.get('gpa'), 2);
      const type = fd.get('langType');
      const def = OIA.TESTS[type];
      const raw = String(fd.get('langScore') || '').trim();
      let test = null;
      if (raw) {
        if (def.kind === 'score') {
          const n = parseFloat(raw);
          if (!Number.isNaN(n)) test = { type, score: n };
        } else {
          // 'n2' · '6' · 'b2' 처럼 적어도 등급표의 표기로 맞춘다
          const up = raw.toUpperCase().replace(/\s/g, '');
          const level = def.levels.find(l => l.toUpperCase() === up || l === `${up}급`);
          if (level) test = { type, level };
          else { showToast(`${type} 등급은 ${def.levels.slice(0, 3).join(' · ')}처럼 적어 주세요`); return; }
        }
      }
      AppState.updateProfile({
        gpa,
        gpaScale: 4.3,
        languageTests: test ? [test] : [],
        exchangeTerm: Object.assign({}, p.exchangeTerm, { track: test ? def.lang : null })
      });
      trackEvent('guest_score_entered', { hasGpa: gpa !== null, hasLang: !!test });
      renderGuestScorePanel();
      renderMyElig();
      renderGrid();
      if (typeof showToast === 'function') showToast('입력한 점수로 지원 가능 여부를 다시 계산했어요');
    });
  }

  /**
   * 내 지원 자격 — 학교와 상관없는 연세대 공통 기준. 여기서 걸리면 학교별 배지는 의미가 없어
   * 학교 목록보다 위에 둔다. 지금 명단이 내 학기의 명단이 아니면 그것도 여기서 알린다.
   */
  function renderMyElig() {
    const mount = document.getElementById('myEligibility');
    if (!mount) return;
    const p = AppState.profile;
    const myTerm = OIA.termKeyOf(p.exchangeTerm);
    const listTerm = (MOCK.schools[0] && MOCK.schools[0].term) || OIA.SCHOOLS_TERM;
    const termData = myTerm && OIA.TERMS[myTerm];
    const listNote = myTerm && listTerm && myTerm !== listTerm
      ? `<p class="list-term-note">지금 학교 목록은 <strong>${OIA.termLabel(listTerm)}</strong> 파견 명단이에요.
          ${termData && termData.schoolListAt ? `${OIA.termLabel(myTerm)} 명단은 ${OIA.fmtDate(termData.schoolListAt)}에 공지돼요 — 학교와 컷이 바뀔 수 있어요.` : '내 학기 명단이 나오면 바뀔 수 있어요.'}</p>`
      : '';
    // 게스트는 학점·어학만 받으므로 공통 자격 카드 대신 명단 안내만 둔다
    mount.innerHTML = (AppState.isAuthed ? myEligibilityHtml(p) : '') + listNote;
  }

  /** 내 전형으로 지원할 수 없는 학교를 숨기는 칩. 전형을 정했으면 처음부터 켜 둔다. */
  function myTrack() { return (AppState.profile.exchangeTerm || {}).track || null; }

  document.getElementById('searchInput').addEventListener('input', (e) => { state.query = e.target.value; state.page = 1; renderGrid(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; renderGrid(); });

  document.getElementById('quickRegion').addEventListener('change', (e) => {
    const v = e.target.value;
    state.country = v.startsWith('c:') ? v.slice(2) : '';
    state.regions = new Set(v.startsWith('r:') ? [v.slice(2)] : []);
    state.page = 1; syncQuickFilterState(); renderGrid();
  });
  document.getElementById('quickCost').addEventListener('change', (e) => { state.costBand = e.target.value; state.page = 1; syncQuickFilterState(); renderGrid(); });
  document.getElementById('quickClimate').addEventListener('change', (e) => {
    state.climate = new Set(e.target.value ? [e.target.value] : []);
    state.page = 1; syncQuickFilterState(); renderGrid();
  });
  // '상세 필터'는 layout.js 가 만든 시트 여는 버튼을 대신 누른다(그 버튼은 화면에서 감췄다).
  document.getElementById('quickMore').addEventListener('click', () => {
    const trigger = document.querySelector('.filter-trigger');
    if (trigger) trigger.click();
  });
  document.getElementById('qsSelect').addEventListener('change', (e) => { state.qsMax = e.target.value ? parseInt(e.target.value, 10) : null; state.page = 1; renderGrid(); });

  // 결과 수 옆의 두 칩(지원 가능만·즐겨찾기만). 켜짐은 다른 필터 칩과 같은 is-selected 로 보인다.
  function setQuickChip(btn, on) { btn.classList.toggle('is-selected', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  const eligibleToggle = document.getElementById('onlyEligibleToggle');
  eligibleToggle.addEventListener('click', () => { state.onlyEligible = !state.onlyEligible; setQuickChip(eligibleToggle, state.onlyEligible); state.page = 1; renderGrid(); });
  const trackToggle = document.getElementById('onlyMyTrackToggle');
  function syncTrackToggle() {
    const t = myTrack();
    trackToggle.hidden = !t;
    if (t) trackToggle.textContent = `${OIA.trackLabel(t)}만`;
    setQuickChip(trackToggle, !!t && state.onlyMyTrack);
  }
  trackToggle.addEventListener('click', () => { state.onlyMyTrack = !state.onlyMyTrack; syncTrackToggle(); state.page = 1; renderGrid(); });
  const favToggle = document.getElementById('onlyFavoriteToggle');
  favToggle.addEventListener('click', () => { state.onlyFavorite = !state.onlyFavorite; setQuickChip(favToggle, state.onlyFavorite); state.page = 1; renderGrid(); });

  document.getElementById('resetFilters').addEventListener('click', () => {
    state.country = ''; state.majors.clear(); state.regions.clear();
    state.programs.clear(); state.tracks.clear();
    state.commerce.clear(); state.climate.clear(); state.security.clear();
    state.qsMax = null; state.onlyEligible = false; state.onlyFavorite = false;
    state.costBand = '';
    state.page = 1;
    document.getElementById('qsSelect').value = '';
    setQuickChip(eligibleToggle, false); setQuickChip(favToggle, false);
    renderFilters(); renderGrid();
  });

  rebuildMajorMatchMap();
  rebuildCreditMap();
  renderFilters();
  syncTrackToggle();
  renderMyElig();
  renderGrid();
  renderBanner();

  ['MOCK:updated', 'profile:updated'].forEach(ev => document.addEventListener(ev, () => {
    rebuildMajorMatchMap();
    rebuildCreditMap();
    renderFilters();
    syncTrackToggle();
    renderMyElig();
    renderGrid();
    renderBanner();
  }));
})();
