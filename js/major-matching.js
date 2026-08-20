(function () {
  AppState.load();
  let selectedMajor = AppState.profile.major;

  function renderMajorFilter() {
    const mount = document.getElementById('majorFilterMount');
    mount.innerHTML = '';
    const items = MOCK.yonseiMajors.map(m => ({ value: m.majorName, label: m.majorName, group: m.college }));
    const select = createSearchableSelect({
      items,
      selected: selectedMajor,
      multiple: false,
      placeholder: '전공 검색',
      onChange: (value) => { selectedMajor = value; renderMatches(); }
    });
    mount.appendChild(select.el);
  }

  function similarityColor(pct) {
    if (pct >= 85) return 'var(--mint-500)';
    if (pct >= 78) return 'var(--amber-500)';
    return 'var(--coral-500)';
  }

  function schoolDisplay(schoolId) {
    const school = MOCK.schools.find(s => s.id === schoolId);
    return {
      name: school ? (school.nameKo || school.name) : schoolId,
      country: school ? school.country : '',
      logo: SCHOOL_LOGOS[schoolId]
    };
  }

  function renderMatches() {
    const confirmed = AppState.getConfirmedSchool();
    const note = document.getElementById('confirmedSchoolNote');

    if (!selectedMajor) {
      document.getElementById('matchList').innerHTML = `<p class="info-panel__text">전공을 선택하면 매칭 결과를 보여드려요.</p>`;
      note.hidden = true;
      return;
    }

    const matches = MOCK.majorMatches.filter(m => m.homeMajor === selectedMajor);

    if (confirmed && matches.some(m => m.school === confirmed.id)) {
      note.hidden = false;
      note.textContent = `확정하신 ${confirmed.nameKo || confirmed.name}이(가) 포함된 결과예요 — 카드에 표시했어요.`;
    } else {
      note.hidden = true;
    }

    document.getElementById('matchList').innerHTML = matches.length ? matches.map(m => {
      const school = schoolDisplay(m.school);
      const isConfirmed = confirmed && m.school === confirmed.id;
      return `
      <div class="card match-card${isConfirmed ? ' match-card--confirmed' : ''}">
        <div class="match-card__top">
          <div class="match-card__courses">
            <div class="match-card__field">
              <span class="match-card__field-label">내 전공</span>
              <span class="match-card__home">${m.homeMajor}</span>
            </div>
            <div class="match-card__field">
              <span class="match-card__field-label">유사 전공</span>
              <span class="match-card__target">${m.targetMajor}</span>
            </div>
            <div class="match-card__field">
              <span class="match-card__field-label">학교</span>
              <div class="major-match-school">
                ${school.logo ? `<img class="major-match-school__logo" src="assets/school-logos/${school.logo}" alt="">` : ''}
                <span>${school.name}${school.country ? ` · ${school.country}` : ''}</span>
                ${isConfirmed ? '<span class="chip is-selected">확정 학교</span>' : ''}
              </div>
            </div>
          </div>
          <div class="similarity-ring" style="background:${similarityColor(m.similarity)}">${m.similarity}%</div>
        </div>
        ${m.matchedTopics.length ? `
        <div class="match-card__topics-label">관련 키워드</div>
        <div class="match-card__topics">${m.matchedTopics.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
        <div class="match-card__note">${m.note || ''}</div>
      </div>
    `;
    }).join('') : `<p class="info-panel__text">이 전공은 아직 뚜렷한 매칭 결과가 없어요.</p>`;
  }

  renderMajorFilter();
  renderMatches();

  document.addEventListener('MOCK:updated', () => { renderMajorFilter(); renderMatches(); });
})();
