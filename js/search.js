(function () {
  AppState.load();

  const LABELS = {
    climateType: { 'four-season': '사계절 뚜렷', hot: '고온다습', cold: '한랭·일조 짧음', 'mild-winter': '온화·잦은 비' },
    commerceLevel: { high: '상권 풍부', medium: '상권 보통', low: '상권 작음' },
    securityLevel: { high: '치안 우수', medium: '치안 보통', low: '치안 주의' }
  };

  const state = {
    query: '', countries: new Set(), majors: new Set(), regions: new Set(),
    commerce: new Set(), climate: new Set(), security: new Set(),
    qsMax: null, onlyEligible: false, onlyFavorite: false, sort: 'default'
  };

  function uniq(field) { return [...new Set(MOCK.schools.map(s => s[field]).filter(v => v != null))]; }

  function renderFilters() {
    renderChipGroup('countryFilters', uniq('country'), state.countries);
    renderMajorFilter();
    renderChipGroup('regionFilters', uniq('region'), state.regions);
    renderChipGroup('commerceFilters', uniq('commerceLevel'), state.commerce, LABELS.commerceLevel);
    renderChipGroup('climateFilters', uniq('climateType'), state.climate, LABELS.climateType);
    renderChipGroup('securityFilters', uniq('securityLevel'), state.security, LABELS.securityLevel);
  }

  // 연세대 전공 마스터 리스트(76개) 기준 검색 가능한 다중 선택 드롭다운.
  // school.majors(학교별 지원 가능 전공)가 아니라 MOCK.yonseiMajors를 옵션으로 씀 —
  // 실데이터 학교들은 majors가 비어있어(알려진 한계) 선택해도 결과가 안 나올 수 있음.
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
    if (state.countries.size && !state.countries.has(school.country)) return false;
    if (state.majors.size && !school.majors.some(m => state.majors.has(m))) return false;
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
      return [...list].sort((a, b) => Number(b.majors.includes(profile.major)) - Number(a.majors.includes(profile.major)) || a.qsRank - b.qsRank);
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
        openSchoolModal(el.dataset.openSchool, { onChange: renderGrid });
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
          <span class="school-card__qs">${school.qsRank ? `QS ${school.qsRank}` : '순위 미정'}</span>
          <span class="fav-btn ${isFav ? 'is-active' : ''}" data-fav-toggle-card="${school.id}">
            <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.2C.5 7.8 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.5 3.8 4 7.3-2.5 4.6-10 9.2-10 9.2z"/></svg>
          </span>
        </div>
        <div class="school-card__name">${school.name}</div>
        <div class="school-card__loc">${school.country} · ${school.city}</div>
        <div class="school-card__badges">${eligibilityBadgeHtml(elig)}<span class="badge badge--neutral">모집 ${school.slot}명</span></div>
        <div class="school-card__stats">
          <div><div class="school-card__stat-label">GPA 컷</div><div class="school-card__stat-value">${school.gpaCut}</div></div>
          <div><div class="school-card__stat-label">${school.langTest.type}</div><div class="school-card__stat-value">${school.langTest.cut}</div></div>
        </div>
      </button>
    `;
  }

  // ---- Simulation ----
  function wireSimulation() {
    document.getElementById('simForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const targetGpa = parseFloat(fd.get('targetGpa'));
      const targetLang = parseFloat(fd.get('targetLang'));
      const currentCount = MOCK.schools.filter(s => computeEligibility(AppState.profile, s).status === 'go').length;
      const simulatedProfile = Object.assign({}, AppState.profile, {
        gpa: Math.max(AppState.profile.gpa, targetGpa || 0),
        languageTests: [{ type: AppState.profile.languageTests[0].type, score: Math.max(AppState.profile.languageTests[0].score, targetLang || 0) }]
      });
      const newCount = MOCK.schools.filter(s => computeEligibility(simulatedProfile, s).status === 'go').length;
      const diff = Math.max(0, newCount - currentCount);
      document.getElementById('simResult').innerHTML = diff > 0
        ? `목표 점수를 달성하면 <strong>${diff}개</strong>의 학교를 더 갈 수 있어요`
        : `입력하신 목표 점수로는 지원 가능 학교 수가 늘어나지 않아요. 더 높은 점수를 시도해보세요`;
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
    state.countries.clear(); state.majors.clear(); state.regions.clear();
    state.commerce.clear(); state.climate.clear(); state.security.clear();
    state.qsMax = null; state.onlyEligible = false; state.onlyFavorite = false;
    document.getElementById('qsSelect').value = '';
    eligibleToggle.classList.remove('is-on'); favToggle.classList.remove('is-on');
    renderFilters(); renderGrid();
  });

  renderFilters();
  renderGrid();
  wireSimulation();

  document.addEventListener('MOCK:updated', () => { renderFilters(); renderGrid(); });
})();
