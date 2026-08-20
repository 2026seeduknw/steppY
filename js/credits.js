(function () {
  AppState.load();
  const confirmed = AppState.getConfirmedSchool();
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
    if (pct >= 80) return 'var(--mint-500)';
    if (pct >= 60) return 'var(--amber-500)';
    return 'var(--coral-500)';
  }

  /** 이 페이지는 이미 위쪽 전공 필터로 "내 전공"이 정해져 있으므로, 카드 안에는
   * 과목명과 대학명만 크게 보여준다(전공명을 카드마다 반복 표시하면 과목/전공이
   * 헷갈린다는 피드백 반영). */
  function schoolDisplay(schoolId) {
    const school = MOCK.schools.find(s => s.id === schoolId);
    return {
      name: school ? (school.nameKo || school.name) : schoolId,
      logo: SCHOOL_LOGOS[schoolId]
    };
  }

  /** targetCourse 원본 문자열 끝에 "(대학명)"이 그대로 붙어 있고, 이게 실제 캠퍼스명과
   * 다를 때가 있다(예: "First Year Korean (University of California)"인데 실제로는
   * UC Santa Barbara). 아래에서 정확한 학교명을 따로 보여주므로 중복/부정확한 접미사는 뗀다. */
  function stripSchoolSuffix(courseName) {
    return courseName.replace(/\s*\([^)]*\)\s*$/, '');
  }

  function renderMatches() {
    let matches = MOCK.courseMatches.filter(m => confirmed && m.school === confirmed.id);
    const isExample = matches.length === 0;
    if (isExample) matches = MOCK.courseMatches;
    if (selectedMajor) {
      matches = matches.filter(m => m.homeMajor === selectedMajor);
    }

    document.getElementById('matchList').innerHTML = matches.length ? matches.map(m => {
      const school = schoolDisplay(m.school);
      return `
      <div class="card match-card">
        <div class="match-card__top">
          <div class="match-card__courses">
            <div class="match-card__target-course">${stripSchoolSuffix(m.targetCourse)}</div>
            <div class="match-card__school">
              ${school.logo ? `<img class="match-card__school-logo" src="assets/school-logos/${school.logo}" alt="">` : ''}
              <span class="match-card__school-name">${school.name}</span>
            </div>
          </div>
          <div class="similarity-ring" style="background:${similarityColor(m.similarity)}">${m.similarity}%</div>
        </div>
        <div class="match-card__topics">${m.matchedTopics.map(t => `<span class="chip">${t}</span>`).join('')}</div>
        <div class="match-card__note">${m.note}</div>
      </div>
    `;
    }).join('') : `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
  }

  document.getElementById('downloadReportBtn').addEventListener('click', () => {
    showToast('실제 서비스에서는 PDF 리포트로 다운로드돼요. 지금은 인쇄 미리보기로 보여드려요.');
    setTimeout(() => window.print(), 400);
  });

  renderMajorFilter();
  renderMatches();

  document.addEventListener('MOCK:updated', () => { renderMajorFilter(); renderMatches(); });
})();
