(function () {
  AppState.load();
  const confirmed = AppState.getConfirmedSchool();
  let selectedMajor = AppState.profile.major;

  document.getElementById('creditsContext').textContent = confirmed
    ? `${confirmed.name} 기준으로 계산해요`
    : '아직 확정한 학교가 없어요. 학교 확정 전에는 예시 데이터로 보여드려요.';

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

  function renderMatches() {
    let matches = MOCK.courseMatches.filter(m => confirmed && m.school === confirmed.id);
    const isExample = matches.length === 0;
    if (isExample) matches = MOCK.courseMatches;
    // 전공 필드가 있는 데이터(목업)에서만 전공으로 좁힘 — 실 서버 데이터는 아직
    // 전공 구분이 없어 필터를 걸면 아무것도 안 남으므로 그대로 통과시킴
    if (selectedMajor && matches.some(m => m.homeMajor)) {
      matches = matches.filter(m => !m.homeMajor || m.homeMajor === selectedMajor);
    }

    document.getElementById('matchList').innerHTML = matches.length ? matches.map(m => `
      <div class="card match-card">
        <div class="match-card__top">
          <div class="match-card__courses">
            <div class="match-card__home">${m.homeCourse}</div>
            <div><span class="match-card__arrow">↔</span><span class="match-card__target">${m.targetCourse}</span></div>
          </div>
          <div class="similarity-ring" style="background:${similarityColor(m.similarity)}">${m.similarity}%</div>
        </div>
        <div class="match-card__topics">${m.matchedTopics.map(t => `<span class="chip">${t}</span>`).join('')}</div>
        <div class="match-card__note">${m.note}</div>
      </div>
    `).join('') : `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
  }

  document.getElementById('downloadReportBtn').addEventListener('click', () => {
    showToast('실제 서비스에서는 PDF 리포트로 다운로드돼요. 지금은 인쇄 미리보기로 보여드려요.');
    setTimeout(() => window.print(), 400);
  });

  renderMajorFilter();
  renderMatches();

  document.addEventListener('MOCK:updated', () => { renderMajorFilter(); renderMatches(); });
})();
