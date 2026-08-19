/**
 * F4 교환 준비하기 화면 렌더링.
 * prepare.html이 직접 로드하는 경우와, 다른 화면(F2/F3/F5)에서 학교를 확정한
 * 순간 그 자리에서 F4 레이아웃으로 전환(morphToPreparePage)하는 경우 모두에서 공유.
 */
const PREPARE_MARKUP = `
  <div class="page-shell prepare-hero" id="prepareHero"></div>

  <div class="page-shell prepare-grid">
    <div class="prepare-main">
      <div id="prepareMap"></div>
      <div id="prepareScore"></div>

      <section class="card card-pad" id="checklistSection">
        <div class="section-title"><div><h2>비자 및 서류 체크리스트</h2></div></div>
        <div class="checklist" id="checklistList"></div>
      </section>

      <section class="card card-pad" id="livingSection">
        <div class="section-title"><div><h2>생활 준비 — 준비물</h2></div></div>
        <div class="living-grid" id="livingGrid"></div>
      </section>

      <section class="card card-pad" id="tipsSection">
        <div class="section-title"><div><h2>Tips</h2></div></div>
        <div class="tip-row" id="tipsList"></div>
        <div class="section-title" style="margin-top:var(--space-5);"><div><h2>주변 가볼만한 곳</h2></div></div>
        <div class="tip-row" id="spotsList"></div>
      </section>
    </div>

    <aside class="prepare-aside">
      <section class="card card-pad" id="profileCard"></section>
      <section class="card card-pad" id="todoCard"></section>
    </aside>
  </div>
`;

function renderPrepareView() {
  renderProfileCard(document.getElementById('profileCard'));
  renderTodoCard(document.getElementById('todoCard'));
  renderPrepareHero();
  renderPrepareMap();
  renderPrepareScore();
  renderPrepareChecklist();
  renderPrepareLiving();
  renderPrepareTips();
}

function renderPrepareHero() {
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
      <div class="confirmed-card__identity">
        ${SCHOOL_LOGOS[confirmed.id]
          ? `<img class="confirmed-card__logo" src="assets/school-logos/${SCHOOL_LOGOS[confirmed.id]}" alt="${confirmed.name} 로고">`
          : `<div class="confirmed-card__logo confirmed-card__logo--empty"></div>`}
        <div>
          
          <div class="confirmed-card__name">${confirmed.name}</div>
          <div class="confirmed-card__meta">${confirmed.country} · ${confirmed.city}${confirmed.qsRank ? ` · QS ${confirmed.qsRank}` : ''}</div>
          <div class="confirmed-card__badges">
            <span class="badge badge--amber">${AppState.profile.exchangeTerm.year} ${AppState.profile.exchangeTerm.season}</span>
          </div>
        </div>
      </div>
      <div class="confirmed-card__actions">
        <span class="btn btn--ghost" style="color:#fff;border-color:rgba(255,255,255,.4);">학교 정보 보기</span>
        <button type="button" class="confirmed-card__cancel" id="cancelConfirmBtn">학교 확정 취소</button>
      </div>
    </div>`;
  document.getElementById('confirmedCardBtn').addEventListener('click', () => openSchoolModal(confirmed.id, { onChange: renderPrepareView }));
  document.getElementById('cancelConfirmBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    AppState.confirmSchool(null);
    window.location.href = 'home.html';
  });
}

function renderPrepareMap() {
  const confirmed = AppState.getConfirmedSchool();
  const mount = document.getElementById('prepareMap');
  if (!confirmed) { mount.innerHTML = ''; return; }
  mount.innerHTML = `
    <section class="card card-pad">
      <div class="section-title"><div><h2>학교 위치</h2></div></div>
      <div class="map-embed">
        <iframe src="${mapEmbedUrl(confirmed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${confirmed.name} 지도"></iframe>
      </div>
      <p class="map-caption">${confirmed.mapNote}</p>
    </section>`;
}

function renderPrepareScore() {
  const confirmed = AppState.getConfirmedSchool();
  document.getElementById('prepareScore').innerHTML = confirmed ? scoreCardHtml(confirmed, { numbered: false }) : '';
}

function renderPrepareChecklist() {
  const mount = document.getElementById('checklistList');
  if (!MOCK.checklist.length) {
    mount.innerHTML = `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
    return;
  }
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

function renderPrepareLiving() {
  const lp = MOCK.livingPrep;
  const mount = document.getElementById('livingGrid');
  const keys = ['insurance', 'scholarship', 'telecom', 'bank'].filter(k => lp[k]);
  if (!keys.length) {
    mount.innerHTML = `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
    return;
  }
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

function renderPrepareTips() {
  const confirmed = AppState.getConfirmedSchool();
  const schoolId = confirmed ? confirmed.id : null;
  const tips = MOCK.tips.filter(t => t.school === schoolId);
  const spots = MOCK.nearbySpots.filter(s => s.school === schoolId);
  document.getElementById('tipsList').innerHTML = tips.length
    ? tips.map(t => `<div class="tip-item"><div class="tip-item__title">${t.title}</div><div class="tip-item__summary">${t.summary}</div></div>`).join('')
    : `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
  document.getElementById('spotsList').innerHTML = spots.length
    ? spots.map(s => `<div class="tip-item"><div class="tip-item__title">${s.title}</div><div class="tip-item__summary">${s.summary}</div></div>`).join('')
    : `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
}

function ensurePrepareStylesLoaded() {
  if (document.querySelector('link[data-prepare-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/pages/prepare.css';
  link.dataset.prepareCss = 'true';
  document.head.appendChild(link);
}

/** 다른 화면에서 학교를 확정한 순간, 페이지 이동 없이 그 자리에서 F4 레이아웃으로 전환 */
function morphToPreparePage() {
  if (document.body.dataset.page === 'prepare') return;
  ensurePrepareStylesLoaded();
  document.querySelectorAll('body > .page-shell').forEach(el => el.remove());
  document.getElementById('mentor-float').insertAdjacentHTML('beforebegin', PREPARE_MARKUP);
  document.body.dataset.page = 'prepare';
  document.title = '교환 준비하기 — steppY';
  renderAppNav('prepare');
  renderPrepareView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('MOCK:updated', () => {
  if (document.body.dataset.page === 'prepare' && document.getElementById('prepareHero')) renderPrepareView();
});
