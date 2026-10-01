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

      <section class="card card-pad prep-card" id="checklistSection"></section>
      <section class="card card-pad prep-card" id="livingSection"></section>

      <a class="reviews-cta" href="consult.html">
        <div class="reviews-cta__body">
          <span class="reviews-cta__eyebrow">선배 후기</span>
          <h2>파견 국가별 후기 보기</h2>
          <p>다녀온 선배들이 남긴 기숙사·교통·생활비 후기를 국가별로 모아봤어요</p>
        </div>
        <span class="reviews-cta__arrow" aria-hidden="true">→</span>
      </a>
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



/* ------------------------------------------------ 카드 열고 닫기 · 체크 저장
   둘 다 이 기기에만 남긴다(계정별 키). 체크리스트는 예시 콘텐츠(MOCK.checklist)라
   서버 테이블이 없다 — 예전엔 새로고침하면 체크가 다 풀렸다. */
function prepStoreKey(name) {
  const uid = (typeof Auth !== 'undefined' && Auth.userId) ? Auth.userId : 'guest';
  return `steppy_prep_${name}_${uid}`;
}
function prepRead(name, fallback) {
  try { const v = JSON.parse(localStorage.getItem(prepStoreKey(name))); return v == null ? fallback : v; }
  catch (e) { return fallback; }
}
function prepWrite(name, value) {
  try { localStorage.setItem(prepStoreKey(name), JSON.stringify(value)); } catch (e) { /* 사파리 프라이빗 모드 등 */ }
}

const CHEVRON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';

/** 카드 머리줄 — 왼쪽 제목, 오른쪽 [부가 정보][열기/닫기]. 닫혀도 머리줄은 남는다. */
function prepCardHead(title, key, extraRight = '') {
  const collapsed = !!prepRead('collapsed', {})[key];
  return `
    <div class="prep-card__head">
      <h2 class="prep-card__title">${title}</h2>
      <div class="prep-card__right">
        ${extraRight}
        <button type="button" class="prep-card__toggle" data-card-toggle="${key}"
                aria-expanded="${!collapsed}" aria-label="${collapsed ? '열기' : '닫기'}">${CHEVRON_SVG}</button>
      </div>
    </div>`;
}

function wirePrepCardToggle(section, key) {
  const apply = (collapsed) => {
    section.classList.toggle('is-collapsed', collapsed);
    const btn = section.querySelector('[data-card-toggle]');
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.setAttribute('aria-label', collapsed ? '열기' : '닫기');
  };
  apply(!!prepRead('collapsed', {})[key]);
  section.querySelector('[data-card-toggle]').addEventListener('click', () => {
    const state = prepRead('collapsed', {});
    state[key] = !state[key];
    prepWrite('collapsed', state);
    apply(state[key]);
  });
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/**
 * 비자 및 서류 — 단계형(스텝퍼). 동그라미를 눌러 끝낸 단계를 표시하면 맨 위
 * 진행 바가 그만큼 차오르고, 오른쪽 위 퍼센트가 따라 오른다. 제목 줄을 누르면
 * 설명이 펼쳐진다. 아직 안 끝낸 첫 단계가 "지금 할 일"로 강조된다.
 */
function renderPrepareChecklist() {
  const section = document.getElementById('checklistSection');
  if (!section) return;
  const items = MOCK.checklist;
  if (!items.length) {
    section.innerHTML = prepCardHead('비자 및 서류 체크리스트', 'checklist') +
      `<div class="prep-card__body"><p class="info-panel__text">서비스 준비 중이에요.</p></div>`;
    wirePrepCardToggle(section, 'checklist');
    return;
  }

  const done = new Set(prepRead('checklist_done', items.filter(i => i.done).map(i => i.id)));
  section.innerHTML = prepCardHead('비자 및 서류 체크리스트', 'checklist',
    `<span class="prep-card__pct"><b id="checklistPct">0%</b> 완료</span>`) + `
    <div class="prep-card__body">
      <div class="prep-progress" role="progressbar" aria-label="체크리스트 진행률" aria-valuemin="0" aria-valuemax="100">
        <div class="prep-progress__fill" id="checklistBar"></div>
      </div>
      <ol class="stepper" id="checklistList">
        ${items.map(item => `
          <li class="step-item" data-id="${item.id}">
            <button type="button" class="step-item__dot" data-toggle-done aria-label="${item.title} 완료 표시">${CHECK_SVG}</button>
            <div class="step-item__main">
              <!-- "Step N"은 순서대로 해야 한다는 뜻으로 읽혀서 뺐다 — 기준은 마감(D-day)이다 -->
              <button type="button" class="step-item__row" data-toggle-expand aria-expanded="false">
                <span class="step-item__title">${item.title}</span>
                <span class="step-item__due">${item.dueOffset}</span>
              </button>
              <div class="step-item__detail">
                <p>${item.detail}</p>
                ${item.id === 'flight' && AppState.getProgramRange() ? `
                <p class="step-item__departure">출국일 <b>${AppState.getProgramRange().start}</b>
                  <button type="button" class="step-item__departure-edit" data-edit-departure>수정</button></p>` : ''}
                <p class="step-item__source">출처 · ${item.source} (최종 업데이트 ${item.updatedAt})</p>
              </div>
            </div>
          </li>`).join('')}
      </ol>
    </div>`;

  const list = section.querySelector('#checklistList');
  const refresh = () => {
    let currentMarked = false;
    list.querySelectorAll('.step-item').forEach(el => {
      const isDone = done.has(el.dataset.id);
      el.classList.toggle('is-done', isDone);
      // 아직 안 끝낸 첫 단계만 "지금 할 일"
      const isCurrent = !isDone && !currentMarked;
      if (isCurrent) currentMarked = true;
      el.classList.toggle('is-current', isCurrent);
      el.querySelector('[data-toggle-done]').setAttribute('aria-pressed', String(isDone));
    });
    const pct = Math.round((done.size / items.length) * 100);
    section.querySelector('#checklistBar').style.width = `${pct}%`;
    section.querySelector('#checklistPct').textContent = `${pct}%`;
    section.querySelector('.prep-progress').setAttribute('aria-valuenow', String(pct));
  };

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.step-item');
    if (!item) return;
    if (e.target.closest('[data-toggle-done]')) {
      const id = item.dataset.id;
      if (done.has(id)) done.delete(id); else done.add(id);
      prepWrite('checklist_done', [...done]);
      refresh();
      return;
    }
    if (e.target.closest('[data-edit-departure]')) { openDeparturePrompt(); return; }
    const row = e.target.closest('[data-toggle-expand]');
    if (row) {
      // 항공권은 출국일이 있어야 고를 수 있다 — 아직 없으면 설명 대신 바로 입력 창을 띄운다
      if (item.dataset.id === 'flight' && !AppState.getProgramRange()) { openDeparturePrompt(); return; }
      const open = item.classList.toggle('is-expanded');
      row.setAttribute('aria-expanded', String(open));
    }
  });

  // 처음 그릴 때도 0%에서 차오르게 — 폭을 0으로 한 프레임 둔 뒤 채운다
  requestAnimationFrame(() => requestAnimationFrame(refresh));
  wirePrepCardToggle(section, 'checklist');
}

/**
 * 출국일 입력 팝업 — 화면 가운데. 체크리스트의 "항공권 예약"에서 연다.
 * 날짜는 확정 카드의 출국 경로(renderDepartureCard)와 같은 값(AppState.setProgramRange)이라
 * 저장하면 위 D-day도 같이 바뀐다. 기간 모델이 출국·귀국 한 쌍이라 귀국일도 함께 받되,
 * 학기 기준 예상값을 미리 채워 두어 출국일만 고르고 저장해도 되게 한다.
 */
function openDeparturePrompt() {
  let scrim = document.getElementById('departurePromptScrim');
  const firstTime = !scrim;
  if (firstTime) {
    scrim = document.createElement('div');
    scrim.id = 'departurePromptScrim';
    scrim.className = 'modal-scrim';
    document.body.appendChild(scrim);
  }
  const range = AppState.getProgramRange() || guessProgramRange();
  scrim.innerHTML = `
    <div class="modal-panel departure-prompt" role="dialog" aria-modal="true" aria-labelledby="departurePromptTitle">
      <button type="button" class="modal-close" data-modal-close aria-label="닫기">✕</button>
      <p class="departure-prompt__icon" aria-hidden="true">✈️</p>
      <h2 class="departure-prompt__title" id="departurePromptTitle">출국일을 입력해주세요</h2>
      <p class="departure-prompt__desc">출국일을 알면 항공권 예약 시기와 남은 날을 세어드려요</p>
      <label class="departure-prompt__field">출국일<input type="date" id="dpStart" value="${range.start}"></label>
      <label class="departure-prompt__field departure-prompt__field--sub">귀국 예정일<input type="date" id="dpEnd" value="${range.end}"></label>
      <button type="button" class="btn btn--primary btn--block" id="dpSave">저장</button>
    </div>`;
  // 바깥 클릭·ESC는 한 번만 걸고, 다시 그린 ✕ 버튼만 매번 새로 잇는다
  if (firstTime) wireModalDismiss(scrim); else wireModalCloseButtons(scrim);
  openModal(scrim);
  scrim.querySelector('#dpSave').addEventListener('click', () => {
    const start = scrim.querySelector('#dpStart').value;
    const end = scrim.querySelector('#dpEnd').value;
    if (!start) { showToast('출국일을 골라주세요'); return; }
    if (!end || start > end) { showToast('출국일이 귀국일보다 늦을 수 없어요'); return; }
    AppState.setProgramRange(start, end);
    closeModal(scrim);
    renderDepartureCard(document.getElementById('departureCard'), { inline: true });
    renderPrepareChecklist();
    showToast('출국일을 저장했어요');
  });
}

const prepEsc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 원문 출처 칸("url | url" 꼴)에서 링크만 뽑아 도메인으로 보여준다. */
function prepSourceLinks(raw) {
  const urls = String(raw || '').match(/https?:\/\/[^\s|]+/g) || [];
  return urls.map(u => {
    let host = u;
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* 그대로 */ }
    return `<a href="${prepEsc(u)}" target="_blank" rel="noopener">${prepEsc(host)}</a>`;
  }).join(', ');
}

/**
 * 생활 준비 — 보험 · 장학금 · 통신사 · 계좌.
 * 확정 학교 국가의 조사 자료(country_prep)를 "추천 / 요금 / 참고 / 필요 서류"
 * 칸으로 나눠 보여준다. 예전엔 원문 칸을 한 줄로 이어 붙여서 조사 메모가
 * 그대로 노출됐다. 문장은 화면용으로 다듬은 *_ko가 있으면 그걸 쓴다(data-source.js).
 */
function renderPrepareLiving() {
  const confirmed = AppState.getConfirmedSchool();
  const c = confirmed && MOCK.countryPrep.find(x => x.countryEn === confirmed.countryEn);
  const survey = c && c.surveyDate ? `${String(c.surveyDate).slice(0, 7).replace('-', '.')} 조사` : '';

  // 국가 자료가 없으면 기본 안내(living_prep)를 같은 모양으로 쓴다
  const base = (k) => {
    const d = MOCK.livingPrep[k];
    return d ? { title: d.title, rows: [['요약', d.summary]], note: d.caution } : null;
  };
  const cards = {
    insurance: c ? {
      title: '보험',
      rows: [['추천', c.insurance], ['요금', c.insurancePrice]],
      note: c.insuranceNote, source: c.insuranceSource
    } : base('insurance'),
    scholarship: base('scholarship'),
    telecom: c ? {
      title: '통신사',
      rows: [['추천', c.telecomRecommend], ['요금', c.telecomPrice]],
      note: c.telecomNote, source: c.telecomSource
    } : base('telecom'),
    bank: c ? {
      title: '계좌 개설',
      rows: [['추천', c.bankRecommend]],
      docs: c.accountDocs, source: c.bankSource
    } : base('bank')
  };

  const section = document.getElementById('livingSection');
  if (!section) return;
  section.innerHTML = prepCardHead('생활 준비 — 준비물', 'living') +
    `<div class="prep-card__body"><div class="living-grid" id="livingGrid"></div></div>`;
  wirePrepCardToggle(section, 'living');
  const mount = document.getElementById('livingGrid');
  const keys = ['insurance', 'scholarship', 'telecom', 'bank'].filter(k => cards[k]);
  if (!keys.length) {
    mount.innerHTML = `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
    return;
  }
  // 넷을 전부 펼쳐 두면 화면 두 판이 설명문으로 찬다. 제목만 세워 두고 필요한
  // 항목만 열어 보게 한다 — 보험을 알아보는 날과 계좌를 여는 날은 다르다.
  mount.innerHTML = keys.map(k => {
    const d = cards[k];
    const scholarshipExtra = k === 'scholarship' ? `
      <div class="scholarship-list">
        ${MOCK.scholarships.map(s => `
          <div class="scholarship-row">
            <div class="scholarship-row__name">${prepEsc(s.name)}</div>
            <div class="scholarship-row__amount">${prepEsc(s.amount)}</div>
            <div class="scholarship-row__elig">${prepEsc(s.eligibility)}</div>
          </div>`).join('')}
      </div>` : '';
    const links = d.source ? prepSourceLinks(d.source) : '';
    return `
      <div class="card living-card" data-living="${k}">
        <button type="button" class="living-card__row" aria-expanded="false">
          <span class="living-card__title">${prepEsc(d.title)}</span>
          <span class="living-card__caret" aria-hidden="true">⌄</span>
        </button>
        <div class="living-card__detail">
          <dl class="living-facts">
            ${d.rows.filter(([, v]) => v).map(([label, v]) => `
              <div class="living-facts__row"><dt>${label}</dt><dd>${prepEsc(v)}</dd></div>`).join('')}
            ${d.docs && d.docs.length ? `
              <div class="living-facts__row"><dt>필요 서류</dt><dd>
                <ul class="living-docs">${d.docs.map(x => `<li>${prepEsc(x)}</li>`).join('')}</ul>
              </dd></div>` : ''}
          </dl>
          ${scholarshipExtra}
          ${d.note ? `<p class="living-card__note">${prepEsc(d.note)}</p>` : ''}
          ${d.source && (links || survey) ? `<p class="living-card__source">출처 · ${[links, survey].filter(Boolean).join(' · ')}</p>` : ''}
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
