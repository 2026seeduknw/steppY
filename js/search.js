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
    qsMax: null, onlyEligible: false, onlyFavorite: false, sort: 'default'
  };

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
  function schoolHasMajorMatch(school, major) {
    const set = schoolMajorMatchMap.get(school.id);
    return !!set && set.has(major);
  }

  function renderFilters() {
    renderCountrySelect();
    renderMajorFilter();
    renderChipGroup('programFilters', ['uic', 'open'], state.programs, LABELS.program);
    renderChipGroup('trackFilters', uniq('track'), state.tracks, LABELS.track);
    renderChipGroup('regionFilters', uniq('region'), state.regions);
    renderChipGroup('commerceFilters', uniq('commerceLevel'), state.commerce, LABELS.commerceLevel);
    renderChipGroup('climateFilters', uniq('climateType'), state.climate, LABELS.climateType);
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
      onChange: (values) => { state.majors = new Set(values); renderGrid(); }
    });
    mount.appendChild(select.el);
  }

  function renderCountrySelect() {
    const mount = document.getElementById('countryFilters');
    const countries = uniq('country');
    mount.innerHTML = `<select class="sort-select filter-select" id="countrySelect">
      <option value="">전체</option>
      ${countries.map(c => `<option value="${c}" ${state.country === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>`;
    document.getElementById('countrySelect').addEventListener('change', (e) => {
      state.country = e.target.value;
      renderGrid();
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
    if (state.qsMax && school.qsRank > state.qsMax) return false;
    if (state.onlyFavorite && !AppState.isFavorite(school.id)) return false;
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

  function renderGrid() {
    const filtered = sortSchools(MOCK.schools.filter(matchesFilters));
    document.getElementById('resultCount').innerHTML = `<strong>${filtered.length}</strong>개 학교`;
    const grid = document.getElementById('schoolGrid');
    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state">조건에 맞는 학교가 없어요. 필터를 조정해보세요.</div>`;
      return;
    }
    grid.innerHTML = filtered.map(schoolCardTemplate).join('');
    grid.querySelectorAll('[data-open-school]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-fav-toggle-card]')) return;
        const schoolId = el.dataset.openSchool;
        // 학과 필터로 찾아 들어온 거면, 모달의 "유사 전공"도 그 필터 기준으로 보여준다
        // (여러 학과를 동시에 선택했으면 이 학교가 실제로 매칭되는 학과를 고른다).
        const contextMajor = [...state.majors].find(m => schoolHasMajorMatch({ id: schoolId }, m));
        openSchoolModal(schoolId, { onChange: renderGrid, contextMajor });
      });
    });
    grid.querySelectorAll('[data-fav-toggle-card]').forEach(btn => {
      btn.addEventListener('click', () => {
        const active = AppState.toggleFavorite(btn.dataset.favToggleCard);
        btn.classList.toggle('is-active', active);
      });
    });
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
          <div><div class="school-card__stat-label">GPA 컷</div><div class="school-card__stat-value">${school.gpaCut}</div></div>
          <div><div class="school-card__stat-label">${school.langTest.type}</div><div class="school-card__stat-value">${school.langTest.cut}</div></div>
        </div>
      </button>
    `;
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
    const lang = (p.languageTests || [])[0] || { type: 'TOEFL', score: '' };
    const LANGS = ['TOEFL', 'IELTS', 'HSK', 'JLPT', 'DELF'];
    const filled = p.gpa !== null && p.gpa !== undefined;

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
          <input type="number" step="0.01" min="0" max="4.5" data-decimals="2" name="gpa"
                 value="${filled ? p.gpa : ''}" placeholder="3.62">
        </label>
        <label class="score-prompt__field">
          <span>어학</span>
          <select name="langType">${LANGS.map(t => `<option ${t === lang.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        <label class="score-prompt__field">
          <span>점수</span>
          <input type="number" name="langScore" value="${lang.score}" placeholder="96">
        </label>
        <button type="submit" class="btn btn--accent btn--sm">적용</button>
      </form>`;

    document.getElementById('guestScoreForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const gpa = fd.get('gpa') === '' ? null : roundDecimals(fd.get('gpa'), 2);
      const score = fd.get('langScore') === '' ? null : parseFloat(fd.get('langScore'));
      AppState.updateProfile({
        gpa,
        gpaScale: 4.3,
        languageTests: score === null ? [] : [{ type: fd.get('langType'), score }]
      });
      trackEvent('guest_score_entered', { hasGpa: gpa !== null, hasLang: score !== null });
      renderGuestScorePanel();
      renderGrid();
      if (typeof showToast === 'function') showToast('입력한 점수로 지원 가능 여부를 다시 계산했어요');
    });
  }

  document.getElementById('searchInput').addEventListener('input', (e) => { state.query = e.target.value; renderGrid(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
  document.getElementById('qsSelect').addEventListener('change', (e) => { state.qsMax = e.target.value ? parseInt(e.target.value, 10) : null; renderGrid(); });

  const eligibleToggle = document.getElementById('onlyEligibleToggle');
  eligibleToggle.addEventListener('click', () => { state.onlyEligible = !state.onlyEligible; eligibleToggle.classList.toggle('is-on'); renderGrid(); });
  const favToggle = document.getElementById('onlyFavoriteToggle');
  favToggle.addEventListener('click', () => { state.onlyFavorite = !state.onlyFavorite; favToggle.classList.toggle('is-on'); renderGrid(); });

  document.getElementById('resetFilters').addEventListener('click', () => {
    state.country = ''; state.majors.clear(); state.regions.clear();
    state.programs.clear(); state.tracks.clear();
    state.commerce.clear(); state.climate.clear(); state.security.clear();
    state.qsMax = null; state.onlyEligible = false; state.onlyFavorite = false;
    document.getElementById('qsSelect').value = '';
    eligibleToggle.classList.remove('is-on'); favToggle.classList.remove('is-on');
    renderFilters(); renderGrid();
  });

  rebuildMajorMatchMap();
  renderFilters();
  renderGrid();
  renderBanner();

  document.addEventListener('MOCK:updated', () => {
    rebuildMajorMatchMap();
    renderFilters();
    renderGrid();
    renderBanner();
  });
})();
