/**
 * F5. 학점 인정 — "학점인정 과목 찾기"(course_matches) / "전공 매칭 찾기"(major_matches)
 * 두 모드를 한 페이지에서 토글로 전환한다. 예전엔 전공 매칭이 major-matching.html이라는
 * 별도 페이지였는데, 홈 배너 자리를 다른 용도로 바꾸면서 이 페이지 안의 모드 버튼으로
 * 진입하도록 옮겼다(major-matching.html 자체는 그대로 남아있음).
 */
(function () {
  AppState.load();
  let selectedMajor = AppState.profile.major;
  let mode = 'course'; // 'course' | 'major'

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

  function schoolDisplay(schoolId) {
    const school = MOCK.schools.find(s => s.id === schoolId);
    return {
      name: school ? (school.nameKo || school.name) : schoolId,
      country: school ? school.country : '',
      logo: SCHOOL_LOGOS[schoolId]
    };
  }

  /** targetCourse 원본 문자열 끝에 "(대학명)"이 그대로 붙어 있고, 이게 실제 캠퍼스명과
   * 다를 때가 있다(예: "First Year Korean (University of California)"인데 실제로는
   * UC Santa Barbara). 아래에서 정확한 학교명을 따로 보여주므로 중복/부정확한 접미사는 뗀다. */
  function stripSchoolSuffix(courseName) {
    return courseName.replace(/\s*\([^)]*\)\s*$/, '');
  }

  function renderCourseMatches() {
    const confirmed = AppState.getConfirmedSchool();
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
            <div class="match-card__field">
              <span class="match-card__field-label">과목명</span>
              <span class="match-card__target-course">${stripSchoolSuffix(m.targetCourse)}</span>
            </div>
            <div class="match-card__field">
              <span class="match-card__field-label">학교</span>
              <div class="match-card__school">
                ${school.logo ? `<img class="match-card__school-logo" src="assets/school-logos/${school.logo}" alt="">` : ''}
                <span class="match-card__school-name">${school.name}</span>
              </div>
            </div>
          </div>
          <div class="similarity-ring" style="background:${similarityColor(m.similarity)}">${m.similarity}%</div>
        </div>
        ${m.matchedTopics.length ? `
        <div class="match-card__topics-label">관련 키워드</div>
        <div class="match-card__topics">${m.matchedTopics.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
        <div class="match-card__note">${m.note}</div>
      </div>
    `;
    }).join('') : `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
  }

  function renderMajorMatches() {
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

  function renderMatches() {
    if (mode === 'major') renderMajorMatches();
    else renderCourseMatches();
  }

  function applyModeUI() {
    document.getElementById('creditsPageTitle').textContent = mode === 'major' ? '내 전공과 잘 맞는 해외 전공' : '학점 인정 사전 확인';
    const subtitle = document.getElementById('creditsPageSubtitle');
    if (mode === 'major') {
      subtitle.textContent = '262개 파견교 중 의미와 학문분류가 가까운 전공을 보여드려요.';
      subtitle.hidden = false;
    } else {
      subtitle.hidden = true;
    }
    document.getElementById('downloadReportBtn').style.display = mode === 'major' ? 'none' : '';
    document.querySelectorAll('.mode-toggle__btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === mode);
    });
  }

  document.getElementById('modeToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn || btn.dataset.mode === mode) return;
    mode = btn.dataset.mode;
    applyModeUI();
    renderMatches();
    trackEvent('credits_mode_switch', { mode });
  });

  document.getElementById('downloadReportBtn').addEventListener('click', () => {
    showToast('실제 서비스에서는 PDF 리포트로 다운로드돼요. 지금은 인쇄 미리보기로 보여드려요.');
    setTimeout(() => window.print(), 400);
  });

  applyModeUI();
  renderMajorFilter();
  renderMatches();

  document.addEventListener('MOCK:updated', () => { renderMajorFilter(); renderMatches(); });
})();
