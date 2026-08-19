(function () {
  AppState.load();
  renderProfileCard(document.getElementById('profileCard'));
  renderTodoCard(document.getElementById('todoCard'));
  renderHero();
  renderChecklist();
  renderLiving();
  renderTips();

  document.addEventListener('MOCK:updated', () => {
    renderHero(); renderChecklist(); renderLiving(); renderTips();
  });

  function renderHero() {
    const confirmed = AppState.getConfirmedSchool();
    const mount = document.getElementById('prepareHero');
    if (!confirmed) {
      mount.innerHTML = `
        <div class="empty-hero">
          <div>
            <h2>아직 확정한 학교가 없어요</h2>
            <p>학교 찾기에서 지망 학교를 선택하고 확정하면, 여기서 서류·비자·생활 준비를 관리할 수 있어요</p>
          </div>
          <a href="search.html" class="btn btn--primary">학교 찾기로 이동</a>
        </div>`;
      document.getElementById('checklistSection').style.display = 'none';
      document.getElementById('livingSection').style.display = 'none';
      document.getElementById('tipsSection').style.display = 'none';
      return;
    }
    document.getElementById('checklistSection').style.display = '';
    document.getElementById('livingSection').style.display = '';
    document.getElementById('tipsSection').style.display = '';
    mount.innerHTML = `
      <div class="confirmed-card" id="confirmedCardBtn">
        <div>
          <span class="eyebrow" style="color:var(--sky-100)">확정된 학교</span>
          <div class="confirmed-card__name">${confirmed.name}</div>
          <div class="confirmed-card__meta">${confirmed.country} · ${confirmed.city}${confirmed.qsRank ? ` · QS ${confirmed.qsRank}` : ''}</div>
          <div class="confirmed-card__badges">
            <span class="badge badge--amber">${AppState.profile.exchangeTerm.year} ${AppState.profile.exchangeTerm.season}</span>
          </div>
        </div>
        <span class="btn btn--ghost" style="color:#fff;border-color:rgba(255,255,255,.4);">학교 정보 보기</span>
      </div>`;
    document.getElementById('confirmedCardBtn').addEventListener('click', () => openSchoolModal(confirmed.id, { onChange: renderHero }));
  }

  function renderChecklist() {
    const mount = document.getElementById('checklistList');
    mount.innerHTML = MOCK.checklist.map(item => `
      <div class="checklist-item" data-id="${item.id}">
        <button type="button" class="checklist-item__row" data-toggle-expand>
          <span class="checklist-item__check" data-toggle-done>${item.done ? '✓' : ''}</span>
          <span class="checklist-item__title">${item.title}</span>
          <span class="checklist-item__due">${item.dueOffset}</span>
          <span class="checklist-item__caret">⌄</span>
        </button>
        <div class="checklist-item__detail">
          <p>${item.detail}</p>
          <p class="checklist-item__source">출처 · ${item.source} (최종 업데이트 ${item.updatedAt})</p>
        </div>
      </div>
    `).join('');

    mount.querySelectorAll('.checklist-item').forEach(el => {
      const row = el.querySelector('[data-toggle-expand]');
      const check = el.querySelector('[data-toggle-done]');
      row.addEventListener('click', (e) => {
        if (e.target === check) return;
        el.classList.toggle('is-expanded');
      });
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        el.classList.toggle('is-done');
        check.textContent = el.classList.contains('is-done') ? '✓' : '';
      });
    });
  }

  function renderLiving() {
    const lp = MOCK.livingPrep;
    const mount = document.getElementById('livingGrid');
    const keys = ['insurance', 'scholarship', 'telecom', 'bank'];
    mount.innerHTML = keys.map(k => {
      const d = lp[k];
      const scholarshipExtra = k === 'scholarship' ? `
        <div class="scholarship-list">
          ${MOCK.scholarships.map(s => `
            <div class="scholarship-row">
              <div class="scholarship-row__name">${s.name}</div>
              <div class="scholarship-row__amount">${s.amount}</div>
              <div class="scholarship-row__elig">${s.eligibility}</div>
            </div>`).join('')}
        </div>` : '';
      return `
        <div class="card living-card">
          <div class="living-card__title">${d.title}</div>
          <div class="living-card__summary">${d.summary}</div>
          ${scholarshipExtra}
          <div class="spec-note">⚠️ ${d.caution}</div>
        </div>`;
    }).join('');
  }

  function renderTips() {
    const confirmed = AppState.getConfirmedSchool();
    const schoolId = confirmed ? confirmed.id : null;
    const tips = MOCK.tips.filter(t => t.school === schoolId);
    const spots = MOCK.nearbySpots.filter(s => s.school === schoolId);
    document.getElementById('tipsList').innerHTML = tips.length
      ? tips.map(t => `<div class="tip-item"><div class="tip-item__title">${t.title}</div><div class="tip-item__summary">${t.summary}</div></div>`).join('')
      : `<p class="info-panel__text">아직 등록된 꿀강 정보가 없어요. 멘토 상담에서 물어보세요.</p>`;
    document.getElementById('spotsList').innerHTML = spots.length
      ? spots.map(s => `<div class="tip-item"><div class="tip-item__title">${s.title}</div><div class="tip-item__summary">${s.summary}</div></div>`).join('')
      : `<p class="info-panel__text">아직 등록된 장소 정보가 없어요.</p>`;
  }
})();
