(function () {
  AppState.load();
  const confirmed = AppState.getConfirmedSchool();

  document.getElementById('creditsContext').textContent = confirmed
    ? `${confirmed.name} 기준으로 계산해요`
    : '아직 확정한 학교가 없어요. 학교 확정 전에는 예시 데이터로 보여드려요.';

  function computeCap() {
    const grad = parseFloat(document.getElementById('gradCredits').value) || 130;
    const duration = document.getElementById('durationSelect').value;
    const isQuarter = document.getElementById('quarterCheck').checked;
    const isArch = document.getElementById('archCheck').checked;

    let ratio;
    if (duration === '1') ratio = isArch ? 1 / 10 : 1 / 8;
    else ratio = isArch ? 1 / 5 : 1 / 4;

    let cap = grad * ratio;
    if (isQuarter) cap = cap; // 상한은 동일, 실제 인정은 취득학점의 2/3만 반영(아래 요약에서 별도 적용)
    return { cap: Math.floor(cap * 10) / 10, isQuarter };
  }

  function renderCap() {
    const { cap } = computeCap();
    document.getElementById('capValue').textContent = `${cap}학점`;
  }

  ['gradCredits', 'durationSelect', 'quarterCheck', 'archCheck'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderCap);
    document.getElementById(id).addEventListener('change', renderCap);
  });

  function similarityColor(pct) {
    if (pct >= 80) return 'var(--mint-500)';
    if (pct >= 60) return 'var(--amber-500)';
    return 'var(--coral-500)';
  }

  function renderMatches() {
    let matches = MOCK.courseMatches.filter(m => confirmed && m.school === confirmed.id);
    const isExample = matches.length === 0;
    if (isExample) matches = MOCK.courseMatches;

    document.getElementById('matchExampleNote').style.display = isExample ? 'block' : 'none';

    document.getElementById('matchList').innerHTML = matches.map(m => `
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
    `).join('');
  }

  document.getElementById('downloadReportBtn').addEventListener('click', () => {
    showToast('실제 서비스에서는 PDF 리포트로 다운로드돼요. 지금은 인쇄 미리보기로 보여드려요.');
    setTimeout(() => window.print(), 400);
  });

  renderCap();
  renderMatches();

  document.addEventListener('MOCK:updated', () => { renderCap(); renderMatches(); });
})();
