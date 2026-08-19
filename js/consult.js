(function () {
  AppState.load();
  const params = new URLSearchParams(location.search);
  const preselect = params.get('school');
  let activeSchool = preselect || null;

  let reviewPool = MOCK.schools.flatMap(s => s.reviews.map(text => ({ school: s, text })));

  function renderChips() {
    const mount = document.getElementById('schoolFilterRow');
    mount.innerHTML = `<button type="button" class="chip ${!activeSchool ? 'is-selected' : ''}" data-school="">전체</button>` +
      MOCK.schools.map(s => `<button type="button" class="chip ${activeSchool === s.id ? 'is-selected' : ''}" data-school="${s.id}">${s.name}</button>`).join('');
    mount.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => { activeSchool = chip.dataset.school || null; renderChips(); renderReviews(); });
    });
  }

  function renderReviews() {
    const filtered = activeSchool ? reviewPool.filter(r => r.school.id === activeSchool) : reviewPool;
    document.getElementById('reviewList').innerHTML = filtered.map(r => `
      <div class="card review-card">
        <div class="review-card__school">${r.school.name} · 선배 후기</div>
        <div class="review-card__text">${r.text}</div>
      </div>
    `).join('') || `<p class="info-panel__text">아직 등록된 후기가 없어요</p>`;
  }

  function fillSelect() {
    const sel = document.getElementById('askSchoolSelect');
    sel.innerHTML = `<option value="">학교 선택 안 함(일반 질문)</option>` +
      MOCK.schools.map(s => `<option value="${s.id}" ${s.id === preselect ? 'selected' : ''}>${s.name}</option>`).join('');
  }

  document.getElementById('askForm').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('질문을 등록했어요. 선배 후기 기반으로 답변을 준비 중이에요');
    e.target.reset();
    fillSelect();
  });

  renderChips();
  renderReviews();
  fillSelect();

  document.addEventListener('MOCK:updated', () => {
    reviewPool = MOCK.schools.flatMap(s => s.reviews.map(text => ({ school: s, text })));
    renderChips(); renderReviews(); fillSelect();
  });
})();
