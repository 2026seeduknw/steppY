/**
 * F4 교환 준비하기 화면 렌더링.
 * prepare.html이 직접 로드하는 경우와, 다른 화면(F2/F3/F5)에서 학교를 확정한
 * 순간 그 자리에서 F4 레이아웃으로 전환(morphToPreparePage)하는 경우 모두에서 공유.
 */
const PREPARE_MARKUP = `
  <div class="page-shell prepare-hero" id="prepareHero"></div>

  <div class="page-shell prepare-grid">
    <div class="prepare-main">
      <div id="targetMajorCard"></div>

      <section class="card card-pad" id="todoCard"></section>

      <section class="card card-pad" id="checklistSection">
        <div class="section-title"><div><h2>비자 및 서류 체크리스트</h2></div></div>
        <div class="checklist" id="checklistList"></div>
      </section>

      <section class="card card-pad" id="livingSection">
        <div class="section-title"><div><h2>생활 준비 — 준비물</h2></div></div>
        <div class="living-grid" id="livingGrid"></div>
      </section>
    </div>
  </div>
`;

function renderPrepareView() {
  renderTargetMajorCard(document.getElementById('targetMajorCard'));
  renderTodoCard(document.getElementById('todoCard'));
  // 히어로를 먼저 그린다 — 출국 카드가 들어갈 자리(#departureCard)를 히어로가 만든다.
  renderPrepareHero();
  renderDepartureCard(document.getElementById('departureCard'), { inline: true });
  renderPrepareChecklist();
  renderPrepareLiving();
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
        <a href="search.html" class="btn btn--accent">학교 찾기로 이동</a>
      </div>`;
    document.getElementById('checklistSection').style.display = 'none';
    document.getElementById('livingSection').style.display = 'none';
    return;
  }
  // 출국하면 비자·서류 체크리스트를 내린다. 비자는 나오면 끝이라 남겨두면
  // 이미 끝낸 일이 할 일처럼 보인다. 생활 준비는 현지에서도 쓰니 그대로 둔다.
  const departed = typeof hasDeparted === 'function' && hasDeparted();
  document.getElementById('checklistSection').style.display = departed ? 'none' : '';
  document.getElementById('livingSection').style.display = '';
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

      <!-- 어느 학교로 언제 떠나는지는 학교 이름·국가와 같은 층위의 정보다.
           별도 카드로 두면 카드 안에 카드가 들어앉는다 — 같은 층위의 글로 적는다. -->
      <div id="departureCard"></div>
      <div class="confirmed-card__actions">
        <span class="btn btn--ghost" style="color:#fff;border-color:rgba(255,255,255,.4);">학교 정보 보기</span>
        <button type="button" class="confirmed-card__cancel" id="cancelConfirmBtn">학교 확정 취소</button>
      </div>
    </div>`;
  // 카드 아무 데나 누르면 학교 상세가 열린다. 그 안의 '수정'·날짜 입력만
  // 자기 일을 하도록 각자 stopPropagation 한다(js/components/departure.js).
  document.getElementById('confirmedCardBtn').addEventListener('click', () => {
    openSchoolModal(confirmed.id, { onChange: renderPrepareView });
  });
  document.getElementById('cancelConfirmBtn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '취소하는 중…';

    AppState.confirmSchool(null);
    // 서버에 반영된 뒤에 이동한다. 낙관적 갱신이라 화면은 이미 풀렸지만, 여기서
    // 바로 홈으로 넘어가면 홈이 새로 읽은 confirmed_school_id 가 아직 옛 값이라
    // 곧바로 교환 준비하기로 도로 튕겨 "취소가 안 되는" 것처럼 보인다.
    await AppState.flush();

    if (AppState.lastWriteError) {
      btn.disabled = false;
      btn.textContent = '학교 확정 취소';
      if (typeof showToast === 'function') showToast('취소하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    window.location.href = 'home.html';
  });
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
  const confirmed = AppState.getConfirmedSchool();
  const countryInfo = confirmed && MOCK.countryPrep.find(c => c.countryEn === confirmed.countryEn);
  const lp = Object.assign({}, MOCK.livingPrep);
  if (countryInfo) {
    lp.telecom = {
      title: '통신사', summary: `${countryInfo.telecomRecommend} · ${countryInfo.telecomPrice}`,
      caution: countryInfo.telecomNote
    };
    lp.insurance = {
      title: '보험', summary: `${countryInfo.insurance} · ${countryInfo.insurancePrice}`,
      caution: countryInfo.insuranceNote
    };
    lp.bank = {
      title: '계좌 개설', summary: countryInfo.bankRecommend,
      caution: `필요 서류: ${countryInfo.accountDocs}`
    };
  }
  const mount = document.getElementById('livingGrid');
  const keys = ['insurance', 'scholarship', 'telecom', 'bank'].filter(k => lp[k]);
  if (!keys.length) {
    mount.innerHTML = `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
    return;
  }
  // 넷을 전부 펼쳐 두면 화면 두 판이 설명문으로 찬다. 제목만 세워 두고 필요한
  // 항목만 열어 보게 한다 — 보험을 알아보는 날과 계좌를 여는 날은 다르다.
  // (체크리스트가 이미 같은 방식이라 조작이 낯설지 않다)
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
      <div class="card living-card" data-living="${k}">
        <button type="button" class="living-card__row" aria-expanded="false">
          <span class="living-card__title">${d.title}</span>
          <span class="living-card__caret" aria-hidden="true">⌄</span>
        </button>
        <div class="living-card__detail">
          <div class="living-card__summary">${d.summary}</div>
          ${scholarshipExtra}
          <div class="spec-note">⚠️ ${d.caution}</div>
        </div>
      </div>`;
  }).join('');

  mount.querySelectorAll('.living-card').forEach(card => {
    const row = card.querySelector('.living-card__row');
    row.addEventListener('click', () => {
      const open = card.classList.toggle('is-expanded');
      row.setAttribute('aria-expanded', String(open));
    });
  });
}

function ensurePrepareStylesLoaded() {
  if (document.querySelector('link[data-prepare-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/pages/prepare.css';
  link.dataset.prepareCss = 'true';

  // head 끝에 붙이면 앱 스킨(css/app.css)보다 뒤에 와서 이긴다. prepare.css의
  // .prepare-grid{display:grid; 1fr 336px}가 app.css의 세로 1단 규칙을 덮어써
  // 본문이 32px 폭으로 눌리고 글자가 세로로 쌓였다(prepare.html은 링크 순서가
  // 맞아 멀쩡하고, 홈에서 확정 후 변신했을 때만 깨졌다).
  // 페이지 CSS → 앱 스킨 순서를 지키도록 app.css 앞에 끼워 넣는다.
  const appSkin = document.querySelector('link[rel="stylesheet"][href$="css/app.css"]');
  if (appSkin) appSkin.parentNode.insertBefore(link, appSkin);
  else document.head.appendChild(link);
}

/** 다른 화면에서 학교를 확정한 순간, 페이지 이동 없이 그 자리에서 F4 레이아웃으로 전환 */
function morphToPreparePage() {
  if (document.body.dataset.page === 'prepare') return;
  ensurePrepareStylesLoaded();
  document.querySelectorAll('body > .page-shell').forEach(el => el.remove());
  document.getElementById('mentor-float').insertAdjacentHTML('beforebegin', PREPARE_MARKUP);
  document.body.dataset.page = 'prepare';
  document.title = '교환 준비하기 — steppY';
  // 앱 셸로 바꾸면서 renderAppNav()가 renderAppBar()/renderTabBar() 둘로 갈렸는데
  // 이 호출부를 놓쳤다. 정의가 없는 함수라 여기서 ReferenceError가 나면서 바로
  // 아래 renderPrepareView()가 실행되지 않았고, 마크업만 꽂힌 빈 카드들이 남았다.
  renderAppBar('prepare');
  renderTabBar('prepare');
  renderPrepareView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('MOCK:updated', () => {
  if (document.body.dataset.page === 'prepare' && document.getElementById('prepareHero')) renderPrepareView();
});
