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

      <section id="todoCard" class="prep-todo"></section>

      <!-- 국제처 공식 일정(지원·배정 후·출국 전) — js/components/oia-timeline.js -->
      <section class="card card-pad" id="oiaTimeline"></section>

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
  // 신청 전공 카드는 없앴다 — 지원 학과는 학교를 정할 때(배정 등록 창)와 학교 정보 보기에서 고른다
  renderTodoCard(document.getElementById('todoCard'));
  // 히어로를 먼저 그린다 — 출국 카드가 들어갈 자리(#departureCard)를 히어로가 만든다.
  renderPrepareHero();
  renderDepartureCard(document.getElementById('departureCard'), { inline: true });
  renderPrepareChecklist();
  renderPrepareLiving();
  renderPrepareTimeline();
}

/**
 * 체크리스트(서류)와 생활 준비(생활)를 두 칸 전환 버튼으로 나눠 한 번에 하나만 보여 준다.
 * 고른 칸은 기억한다. To-Do의 '#checklistSection' 링크로 들어오면 서류 칸을 연다.
 */
function renderPrepSwitch(on) {
  const docs = document.getElementById('checklistSection');
  const life = document.getElementById('livingSection');
  if (!docs || !life) return;
  let sw = document.getElementById('prepSwitch');
  if (!on) { if (sw) sw.hidden = true; return; }
  if (!sw) {
    sw = document.createElement('div');
    sw.id = 'prepSwitch';
    sw.className = 'prep-switch';
    sw.setAttribute('role', 'tablist');
    sw.innerHTML = `
      <button type="button" role="tab" data-prep-tab="docs">서류</button>
      <button type="button" role="tab" data-prep-tab="life">생활</button>`;
    docs.parentNode.insertBefore(sw, docs);
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prep-tab]');
      if (!b) return;
      prepWrite('prep_tab', b.dataset.prepTab);
      applyPrepSwitch();
    });
  }
  sw.hidden = false;
  if (location.hash === '#checklistSection') prepWrite('prep_tab', 'docs');
  applyPrepSwitch();
}

function applyPrepSwitch() {
  const tab = prepRead('prep_tab', 'docs') === 'life' ? 'life' : 'docs';
  document.getElementById('checklistSection').style.display = tab === 'docs' ? '' : 'none';
  document.getElementById('livingSection').style.display = tab === 'life' ? '' : 'none';
  document.querySelectorAll('#prepSwitch [data-prep-tab]').forEach(b => {
    const on = b.dataset.prepTab === tab;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
}

/** 국제처 일정 — 배정 발표 전이면 지원 일정부터, 출국 뒤에는 파견 중·귀국 후. */
function renderPrepareTimeline() {
  const mount = document.getElementById('oiaTimeline');
  if (!mount || typeof renderOiaTimeline !== 'function') return;
  const info = typeof departureInfo === 'function' ? departureInfo() : {};
  // 출국 전에는 국제처 할 일이 체크리스트에 녹아 있고, 알아둘 일은 위 두 줄(#prepareSchedule)로 본다.
  // 이 카드는 파견 중·귀국 후에만 쓴다.
  const sched = document.getElementById('prepareSchedule');
  if (sched && typeof renderUpcomingSchedule === 'function') renderUpcomingSchedule(sched);
  if (!AppState.getConfirmedSchool() || (info.phase !== 'after' && info.phase !== 'abroad')) { mount.style.display = 'none'; return; }
  mount.style.display = '';
  renderOiaTimeline(mount, { phases: info.phase === 'after' ? ['return'] : ['abroad', 'return'], title: '국제처 일정' });
}

function renderPrepareHero() {
  const confirmed = AppState.getConfirmedSchool();
  const mount = document.getElementById('prepareHero');
  if (!confirmed) {
    mount.innerHTML = `
      <div class="empty-hero">
        <div>
          <h2>아직 배정된 학교가 없어요</h2>
          <p>희망대학표를 만들고 배정 결과(또는 미리 준비해볼 학교)를 등록하면, 여기서 서류·비자·생활 준비를 관리할 수 있어요</p>
        </div>
        <a href="search.html" class="btn btn--accent">학교 찾기로 이동</a>
      </div>`;
    document.getElementById('checklistSection').style.display = 'none';
    document.getElementById('livingSection').style.display = 'none';
    renderPrepSwitch(false);
    return;
  }
  // 출국하면 비자·서류 체크리스트를 내린다. 비자는 나오면 끝이라 남겨두면
  // 이미 끝낸 일이 할 일처럼 보인다. 생활 준비는 현지에서도 쓰니 그대로 둔다.
  const departed = typeof hasDeparted === 'function' && hasDeparted();
  document.getElementById('checklistSection').style.display = departed ? 'none' : '';
  document.getElementById('livingSection').style.display = '';
  // 출국 전에는 '서류 | 생활' 중 하나만 보여 준다(출국 뒤엔 생활만 남아 전환이 필요 없다)
  renderPrepSwitch(!departed);
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
            ${OIA.beforePlacement(AppState.profile) ? '<span class="badge badge--neutral">배정 발표 전 · 미리 준비 중</span>' : ''}
          </div>
        </div>
      </div>

      <!-- 어느 학교로 언제 떠나는지는 학교 이름·국가와 같은 층위의 정보다.
           별도 카드로 두면 카드 안에 카드가 들어앉는다 — 같은 층위의 글로 적는다. -->
      <div id="departureCard"></div>
      <div class="confirmed-card__actions">
        <span class="btn btn--ghost" style="color:#fff;border-color:rgba(255,255,255,.4);">학교 정보 보기</span>
        <button type="button" class="confirmed-card__cancel" id="cancelConfirmBtn">${OIA.beforePlacement(AppState.profile) ? '미리 준비 그만두기' : '배정 학교 지우기'}</button>
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
      btn.textContent = OIA.beforePlacement(AppState.profile) ? '미리 준비 그만두기' : '배정 학교 지우기';
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
function prepCardHead(title, key, extraRight = '', opts = {}) {
  const collapsed = !!prepRead('collapsed', {})[key];
  return `
    <div class="prep-card__head">
      <h2 class="prep-card__title">${title}</h2>
      <div class="prep-card__right">
        ${extraRight}
        ${opts.noToggle ? '' : `<button type="button" class="prep-card__toggle" data-card-toggle="${key}"
                aria-expanded="${!collapsed}" aria-label="${collapsed ? '열기' : '닫기'}">${CHEVRON_SVG}</button>`}
      </div>
    </div>`;
}

function wirePrepCardToggle(section, key) {
  const apply = (collapsed) => {
    section.classList.toggle('is-collapsed', collapsed);
    const btn = section.querySelector('[data-card-toggle]');
    if (!btn) return;
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

/* 비자 서류 — 크롤러(exchange-doc-crawler)가 대사관·이민청 등 공식 출처에서만 모은 국가별
   목록(visa_requirements / visa_documents). 서류 이름은 크롤러의 표준 분류를 한글로 옮긴다
   (원문 표기는 국가마다 영어·폴란드어 등으로 섞여 있다). */
const VISA_DOC_KO = {
  PASSPORT: '여권', PHOTO: '증명사진', VISA_APPLICATION_FORM: '비자 신청서',
  ENROLLMENT_CERTIFICATE: '입학 허가서', FINANCIAL_PROOF: '재정 증명', BANK_STATEMENT: '은행 잔고 증명',
  INSURANCE: '보험 증명', ACCOMMODATION_PROOF: '숙소 증명', MEDICAL_CERTIFICATE: '건강진단서',
  POLICE_CLEARANCE_CERTIFICATE: '범죄경력 증명서', FLIGHT_ITINERARY: '항공권(왕복)', COPY_OF_ID: '신분증 사본'
};
const VISA_SOURCE_KO = { EMBASSY_CONSULATE_SEOUL: '주한 대사관', NATIONAL_IMMIGRATION_AUTHORITY: '이민 당국' };

/**
 * 파견교 지원 서류 — 학교마다 다른 서류는 크롤링이 불안정해서 앱이 정리하지 않는다
 * (exchange-doc-crawler: 263개교 중 152개만 찾았고 자동 확정 0건). 대부분 공통인 3종만
 * 보여주고, 나머지는 연세대 OIA 학교 정보·Factsheet·학교 공식 사이트에서 직접 확인하게 한다.
 * OIA 공지는 연세대가 준 원본 엑셀(Notice from OIA) 문구 그대로다.
 */
/* OIA 안내(schools.notice_from_oia)는 국제처 원문을 그대로 옮긴 글이라 한 덩어리로 보여주면 읽기 어렵다.
     · 한글 줄 바로 뒤에 같은 내용의 영어 번역이 붙는다 → 번역은 뺀다(한글만 남긴다).
     · 여러 조건이 세미콜론으로 한 줄에 이어진다 → 조건마다 한 줄로 나눈다.
     · 번역 없이 영어로만 온 줄(장학금·캠퍼스 소개 등)은 그대로 둔다.
   줄이 많으면 앞의 네 줄만 보이고 나머지는 '더보기'로 접는다. */
function oiaNoticeItems(raw) {
  const hasKo = (t) => /[가-힣]/.test(t);
  const items = [];
  let untranslated = 0;   // 아직 영어 짝을 만나지 못한 한글 줄 수 — 그만큼의 영어 줄은 번역으로 보고 건너뛴다
  String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
    if (hasKo(line)) {
      untranslated += 1;
      // 세미콜론·문장 끝에서 나눈다(괄호 안은 나누지 않는다)
      line.split(/(?:;|\.\s+(?=\S))(?![^(]*\))/).map((t) => t.trim().replace(/^※\s*/, '').replace(/\.$/, '')).filter(Boolean)
        .forEach((t) => items.push(t));
    } else if (untranslated > 0) {
      untranslated -= 1;
    } else {
      items.push(line.replace(/^※\s*/, ''));
    }
  });
  // 지원 조건(한글)을 먼저, 영어로만 온 부가 안내는 뒤에 둔다
  return [...items.filter(hasKo), ...items.filter((t) => !hasKo(t))];
}

function oiaNoticeHtml(raw) {
  const items = oiaNoticeItems(raw);
  if (!items.length) return '';
  // 주소는 눌러서 열 수 있게 — 글자는 도메인만 보여 줄바꿈이 깨지지 않게 한다
  const li = (t) => `<li>${prepEsc(t).replace(/https?:\/\/[^\s)]+/g, (url) => {
    const host = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    return `<a href="${url}" target="_blank" rel="noopener">${host} ↗</a>`;
  })}</li>`;
  const SHOW = 4;
  const head = items.slice(0, SHOW).map(li).join('');
  const rest = items.slice(SHOW);
  return `
      <div class="app-docs__notice">
        <p class="app-docs__notice-title">OIA 안내</p>
        <ul>${head}</ul>
        ${rest.length ? `<details><summary>${rest.length}개 더보기</summary><ul>${rest.map(li).join('')}</ul></details>` : ''}
      </div>`;
}

function applicationDocsHtml() {
  const school = AppState.getConfirmedSchool();
  if (!school) return '';
  const l = school.links || {};
  const links = [
    l.oia && ['연세대 OIA 학교 정보', l.oia],
    l.factsheet && ['파견교 Factsheet', l.factsheet],
    l.website && ['파견교 공식 사이트', l.website]
  ].filter(Boolean);
  return `
    <div class="app-docs">
      <p class="app-docs__title">파견교 지원 서류</p>
      <p class="app-docs__desc">대부분의 파견교가 공통으로 요구하는 서류예요.</p>
      <ul class="living-docs"><li>성적증명서</li><li>어학 성적표</li><li>여권 사본</li></ul>
      <p class="app-docs__desc">학교마다 추가 서류가 있을 수 있어요.<br>지원 전에 아래 공식 안내에서 꼭 확인하세요.</p>
      ${oiaNoticeHtml(school.oiaNotice)}
      ${links.length ? `<div class="app-docs__links">${links.map(([label, url]) =>
        `<a href="${prepEsc(url)}" target="_blank" rel="noopener">${label} ↗</a>`).join('')}</div>` : ''}
    </div>`;
}

/** 체크리스트 항목의 출처 줄 — 고정 출처는 그대로, 학교·국가에 따라 달라지는 출처는 확정 학교 기준으로. */
function checklistSourceHtml(item) {
  const school = AppState.getConfirmedSchool();
  let links = [];
  let checked = item.checkedAt ? `${String(item.checkedAt).slice(0, 7).replace('-', '.')} 확인` : '';
  if (item.sources && item.sources.length) {
    links = item.sources.map(src => src.url
      ? `<a href="${prepEsc(src.url)}" target="_blank" rel="noopener">${prepEsc(src.label)}</a>`
      : prepEsc(src.label));
  } else if (item.dynamicSource === 'insurance' && school) {
    const c = MOCK.countryPrep.find(x => x.countryEn === school.countryEn);
    if (c && c.insuranceSource) links = [prepSourceLinks(c.insuranceSource)];
    if (c && c.surveyDate) checked = `${String(c.surveyDate).slice(0, 7).replace('-', '.')} 조사`;
  } else if (item.dynamicSource === 'school' && school) {
    const l = school.links || {};
    links = [
      l.oia && `<a href="${prepEsc(l.oia)}" target="_blank" rel="noopener">연세대 OIA 학교 정보</a>`,
      l.website && `<a href="${prepEsc(l.website)}" target="_blank" rel="noopener">파견교 공식 사이트</a>`
    ].filter(Boolean);
  }
  // 비자는 위 서류 박스가 출처 링크를 이미 보여준다. 출처가 없는 항목은 줄을 아예 두지 않는다.
  if (!links.length) return '';
  return `<p class="step-item__source">출처 · ${links.join(', ')}${checked ? ` · ${checked}` : ''}</p>`;
}

/** 기숙사 — 연세대 OIA 원본 엑셀의 기숙사 보장 여부·안내 문구가 있으면 그대로 보여준다. */
function housingInfoHtml() {
  const school = AppState.getConfirmedSchool();
  const h = school && school.housing;
  if (!h || (!h.guaranteed && !h.info)) return '';
  const label = { Yes: '보장', No: '보장 안 됨', Partial: '일부 보장' }[h.guaranteed] || h.guaranteed;
  // 안내 칸에 주소만 들어 있는 학교가 있다 — 그대로 늘어놓지 않고 링크로 바꾼다
  const info = h.info ? prepEsc(h.info).replace(/https?:\/\/[^\s<]+/g,
    (u) => `<a href="${u}" target="_blank" rel="noopener">파견교 기숙사 안내 ↗</a>`) : '';
  return `<p class="step-item__housing">${label ? `<b>OIA 자료 · 기숙사 ${prepEsc(label)}</b> ` : ''}${info}</p>`;
}

/** 두 절(쉼표로 이어진 두 덩이)이면 쉼표 뒤에서 줄을 바꾼다 — '10,000'처럼 붙은 쉼표는 그대로 */
function prepClauses(text) {
  return prepEsc(text).replace(/,\s+/g, ',<br>');
}

/** steppY가 추천하는 내용은 초록 상자에 따로 담는다 */
function steppyPickHtml(text) {
  return text ? `<div class="steppy-pick"><span class="steppy-pick__label">steppY 추천</span><p>${prepEsc(text)}</p></div>` : '';
}

/** 보험 — 예전 '생활 준비' 보험 카드 내용을 체크리스트 '해외여행자보험 가입' 항목 안으로 옮겼다 */
function insuranceInfoHtml() {
  const school = AppState.getConfirmedSchool();
  const c = school && MOCK.countryPrep.find(x => x.countryEn === school.countryEn);
  if (!c || (!c.insurance && !c.insurancePrice)) return '';
  const rows = [['요금', c.insurancePrice]].filter(([, v]) => v);
  // 출처는 항목 아래 checklistSourceHtml 이 이미 달아 준다
  return `
    ${steppyPickHtml(c.insurance)}
    <dl class="living-facts">${rows.map(([l, v]) => `
      <div class="living-facts__row"><dt>${l}</dt><dd>${prepClauses(v)}</dd></div>`).join('')}
    </dl>
    ${c.insuranceNote ? `<p class="living-card__note">${prepClauses(c.insuranceNote)}</p>` : ''}`;
}

function visaDocsHtml() {
  const school = AppState.getConfirmedSchool();
  const v = school && MOCK.visaRequirements && MOCK.visaRequirements[school.countryEn];
  if (!v) return '';
  const country = school.country || school.countryEn;
  const sources = (v.sources || []).filter(s => s && s.url).map(s => {
    let host = s.url;
    try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { /* 그대로 */ }
    return `<a href="${prepEsc(s.url)}" target="_blank" rel="noopener">${VISA_SOURCE_KO[s.kind] || '공식 안내'} · ${prepEsc(host)}</a>`;
  });
  if (v.status === 'excluded') {
    return `<div class="visa-docs"><p class="visa-docs__note">${prepEsc(v.statusLabelKo || '국가가 정해지면 그 나라 기준으로 확인하세요')}</p></div>`;
  }
  // 같은 종류가 여러 이름으로 잡힌 경우(Passport / 여권)는 한 번만
  const seen = new Set();
  const docs = (v.documents || []).filter(d => {
    const key = d.standardType || d.rawName;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(d => VISA_DOC_KO[d.standardType] || d.rawName);
  return `
    <div class="visa-docs">
      <p class="visa-docs__title">${prepEsc(country)} 학생비자 서류</p>
      ${docs.length
        ? `<ul class="living-docs">${docs.map(x => `<li>${prepEsc(x)}</li>`).join('')}</ul>
           <p class="visa-docs__note">공식 안내에서 자동으로 모은 목록이라 빠진 서류가 있을 수 있어요.<br>신청 전에 아래 공식 안내를 꼭 확인하세요.</p>`
        : `<p class="visa-docs__note">아직 서류 목록을 정리하지 못했어요.<br>아래 공식 안내에서 확인하세요.</p>`}
      ${sources.length ? `<p class="visa-docs__sources">${sources.join('')}</p>` : ''}
    </div>`;
}

/**
 * 비자 및 서류 — 단계형(스텝퍼). 동그라미를 눌러 끝낸 단계를 표시하면 맨 위
 * 진행 바가 그만큼 차오르고, 오른쪽 위 퍼센트가 따라 오른다. 제목 줄을 누르면
 * 설명이 펼쳐진다. 아직 안 끝낸 첫 단계가 "지금 할 일"로 강조된다.
 */
/*
 * 비자 및 서류 체크리스트 = 기본 준비 항목(MOCK.checklist) + 국제처 책자 일정의 "할 일"(js/oia-rules.js).
 * 같은 일은 하나로 합친다(여권·비자·보험+출국신고서). 국제처 마감일이 있는 항목은 D-day가 붙는다.
 * 배정 발표가 끝났으면 지원 단계 일(지원서 제출 등)은 뺀다.
 * 완료 체크는 국제처 일정 체크(oiaReadDone)와 To-Do에도 같이 반영한다.
 */
const PREP_OIA_MERGE = { passport: 'passport', visa: 'visa', insurance: 'departure-report' };
/** 체크리스트를 성격별로 끊어 보여 준다. 목록에 없는 항목은 마지막 묶음으로 */
const PREP_GROUPS = [
  { key: 'apply', title: '국제처 지원', ids: ['oia:langcert', 'oia:exempt', 'oia:apply'] },
  { key: 'host', title: '파견교 서류', ids: ['oia:host-deadline', 'passport', 'transcript', 'oia:doc2', 'oia:acceptance'] },
  { key: 'visa', title: '비자·보험', ids: ['visa', 'insurance'] },
  { key: 'go', title: '출국 준비', ids: [] }
];
function prepGroupOf(id) {
  const g = PREP_GROUPS.find(g => g.ids.includes(id));
  return g ? g.key : 'go';
}
const PREP_ORDER = ['oia:host-deadline', 'passport', 'oia:langcert', 'oia:exempt', 'oia:apply', 'transcript', 'oia:doc2', 'oia:acceptance', 'visa', 'insurance', 'flight', 'housing', 'oia:tuition', 'oia:extra-pledge'];
function prepMergedChecklist() {
  const base = (MOCK.checklist || []).map(it => Object.assign({}, it));
  if (typeof OIA === 'undefined') return base;
  const evs = OIA.scheduleFor(AppState.profile, AppState.getProgramRange());
  const before = OIA.beforePlacement(AppState.profile);
  const tasks = evs.filter(ev => !ev.info && (ev.phase === 'placed' || (before && ev.phase === 'apply')));
  const byId = Object.fromEntries(tasks.map(ev => [ev.id, ev]));
  base.forEach(it => {
    const ev = byId[PREP_OIA_MERGE[it.id]];
    if (ev) { it.oia = ev; delete byId[ev.id]; }
  });
  const extra = Object.values(byId).map(ev => ({ id: 'oia:' + ev.id, title: ev.title, detail: ev.detail || '', oia: ev, fromOia: true }));
  const all = base.concat(extra);
  const rank = (it) => { const i = PREP_ORDER.indexOf(it.id); return i < 0 ? 99 : i; };
  return all.sort((a, b) => rank(a) - rank(b));
}

/** 끝의 괄호 설명은 다음 줄에 회색으로 — '연세대 등록금 납부 (휴학 중이면 복학 신청)' */
function prepTitleHtml(title) {
  const m = String(title).match(/^(.*\S)\s*\(([^()]+)\)$/);
  return m ? `${m[1]}<small class="step-item__note">${m[2]}</small>` : title;
}

/** 체크리스트용 짧은 마감 — 'D-62 1월 7일(목)'. 기간이면 시작일만, 시각은 빼고(홈의 두 줄과 같은 꼴) */
function prepDueShort(ev) {
  if (ev.approx === 'month') return `${OIA.kst(ev.due).getMonth() + 1}월 중`;
  const d = OIA.daysUntil(ev.due), end = OIA.daysUntil(ev.dueTo || ev.due);
  const dday = end < 0 ? '지남' : d <= 0 && ev.dueTo ? '진행 중' : d === 0 ? '오늘' : `D-${d}`;
  return `<b class="oia-tl__dday${end < 0 ? ' is-past' : d <= 7 ? ' is-soon' : ''}">${dday}</b> ${OIA.fmtDate(ev.due, { withTime: false })}`;
}

/** 체크리스트의 국제처 항목을 체크하면 국제처 일정 체크와 To-Do 체크도 같은 상태로 맞춘다 */
function prepSyncOiaDone(oiaId, isDone) {
  if (typeof oiaReadDone === 'function') {
    const set = oiaReadDone();
    if (isDone) set.add(oiaId); else set.delete(oiaId);
    oiaWriteDone(set);
  }
  if (AppState.isAuthed) {
    const t = AppState.getTodos().find(x => x.id === 'oia-' + oiaId);
    if (t && !!t.done !== isDone) AppState.toggleTodo(t.id);
  }
}

document.addEventListener('checklist:changed', () => { if (document.getElementById('checklistSection')) renderPrepareChecklist(); });

function renderPrepareChecklist() {
  const section = document.getElementById('checklistSection');
  if (!section) return;
  const items = prepMergedChecklist();
  if (!items.length) {
    section.innerHTML = prepCardHead('비자 및 서류 체크리스트', 'checklist', '', { noToggle: true }) +
      `<div class="prep-card__body"><p class="info-panel__text">서비스 준비 중이에요.</p></div>`;
    return;
  }

  const done = new Set(prepRead('checklist_done', items.filter(i => i.done).map(i => i.id)));
  // 국제처 일정 카드·To-Do에서 체크한 것도 완료로 친다(예전 기록을 그대로 이어받는다)
  const oiaDone = typeof oiaReadDone === 'function' ? oiaReadDone() : new Set();
  items.forEach(it => { if (it.oia && oiaDone.has(it.oia.id)) done.add(it.id); });
  // 카테고리별로 접은 상태는 기억해 둔다
  const groupsClosed = prepRead('checklist_groups_closed', []);
  section.innerHTML = prepCardHead('비자 및 서류 체크리스트', 'checklist',
    `<span class="prep-card__pct"><b id="checklistPct">0%</b> 완료</span>`, { noToggle: true }) + `
    <div class="prep-card__body">
      ${typeof OIA !== 'undefined' && OIA.termOf(AppState.profile).data ? `<p class="prep-card__source">${OIA.termOf(AppState.profile).data.source} 일정 기반이에요.<br>일정은 바뀔 수 있으니 국제처 공지로 꼭 다시 확인하세요.</p>` : ''}
      <div class="prep-progress" role="progressbar" aria-label="체크리스트 진행률" aria-valuemin="0" aria-valuemax="100">
        <div class="prep-progress__fill" id="checklistBar"></div>
      </div>
      <div class="prep-groups" id="checklistList">
        ${PREP_GROUPS.map(g => ({ g, list: items.filter(it => prepGroupOf(it.id) === g.key) })).filter(x => x.list.length).map(({ g, list }) => `
        <div class="prep-group${groupsClosed.includes(g.key) ? ' is-collapsed' : ''}" data-group="${g.key}">
          <h3 class="prep-group__head">
            <button type="button" class="prep-group__title" data-group-toggle aria-expanded="${!groupsClosed.includes(g.key)}">
              ${g.title}<span class="prep-group__count" data-group-count></span>
              <span class="prep-group__caret" aria-hidden="true">${CHEVRON_SVG}</span>
            </button>
          </h3>
          <ol class="stepper">
        ${list.map(item => `
          <li class="step-item" data-id="${item.id}">
            <button type="button" class="step-item__dot" data-toggle-done aria-label="${item.title} 완료 표시">${CHECK_SVG}</button>
            <div class="step-item__main">
              <!-- "Step N"은 순서대로 해야 한다는 뜻으로 읽혀서 뺐다. 마감(D-day)도 근거가 없어 지금은 비어 있다 -->
              <div class="step-item__head">
                <button type="button" class="step-item__row" data-toggle-expand aria-expanded="false">
                  <span class="step-item__title">${prepTitleHtml(item.title)}</span>
                  ${item.oia && item.oia.due ? `<span class="step-item__due">${prepDueShort(item.oia)}</span>`
                    : item.oia && item.oia.rel ? `<span class="step-item__due">출국 ${-item.oia.rel.days}일 전</span>`
                    : item.dueOffset ? `<span class="step-item__due">${item.dueOffset}</span>` : ''}
                </button>
                ${todoAddBtnHtml(item)}
              </div>
              <div class="step-item__detail">
                ${item.detail ? `<p>${item.detail}</p>` : ''}
                ${item.oia && !item.fromOia && item.oia.detail ? `<p class="step-item__oia"><b>국제처</b> ${item.oia.title} · ${item.oia.detail}</p>` : ''}
                ${item.id === 'visa' ? visaDocsHtml() : ''}
                ${item.id === 'insurance' ? insuranceInfoHtml() : ''}
                ${item.id === 'flight' && AppState.getProgramRange() ? `
                <p class="step-item__departure">출국일 <b>${AppState.getProgramRange().start}</b>
                  <button type="button" class="step-item__departure-edit" data-edit-departure>수정</button></p>` : ''}
                ${item.dynamicSource === 'school' ? housingInfoHtml() : ''}
                ${checklistSourceHtml(item)}
              </div>
            </div>
          </li>`).join('')}
          </ol>
        </div>`).join('')}
      </div>
      ${applicationDocsHtml()}
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
    list.querySelectorAll('.prep-group').forEach(g => {
      const els = [...g.querySelectorAll('.step-item')];
      const n = els.filter(el => done.has(el.dataset.id)).length;
      g.querySelector('[data-group-count]').textContent = `${n}/${els.length}`;
      g.classList.toggle('is-complete', n === els.length);
    });
    const pct = Math.round((done.size / items.length) * 100);
    section.querySelector('#checklistBar').style.width = `${pct}%`;
    section.querySelector('#checklistPct').textContent = `${pct}%`;
    section.querySelector('.prep-progress').setAttribute('aria-valuenow', String(pct));
  };

  list.addEventListener('click', (e) => {
    const gt = e.target.closest('[data-group-toggle]');
    if (gt) {
      const g = gt.closest('.prep-group');
      const closed = g.classList.toggle('is-collapsed');
      gt.setAttribute('aria-expanded', String(!closed));
      const set = new Set(prepRead('checklist_groups_closed', []));
      if (closed) set.add(g.dataset.group); else set.delete(g.dataset.group);
      prepWrite('checklist_groups_closed', [...set]);
      return;
    }
    const item = e.target.closest('.step-item');
    if (!item) return;
    if (e.target.closest('[data-toggle-done]')) {
      const id = item.dataset.id;
      if (done.has(id)) done.delete(id); else done.add(id);
      prepWrite('checklist_done', [...done]);
      const it = items.find(x => x.id === id);
      if (it && it.oia) prepSyncOiaDone(it.oia.id, done.has(id));
      const todoMount = document.getElementById('todoCard');
      if (todoMount && typeof renderTodoCard === 'function') renderTodoCard(todoMount);
      refresh();
      return;
    }
    if (e.target.closest('[data-edit-departure]')) { openDeparturePrompt(); return; }
    if (e.target.closest('[data-add-todo]')) {
      const it = items.find(x => x.id === item.dataset.id);
      if (!AppState.isAuthed) { location.href = 'auth.html'; return; }
      if (it) openTodoAddPrompt(it.title);
      return;
    }
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
  section.classList.remove('is-collapsed');
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
/** 체크리스트 항목을 To-Do로 — 이미 같은 제목이 있으면 ✓로 보여주고 다시 추가하지 않게 한다. */
function todoAddBtnHtml(item) {
  const added = AppState.isAuthed && AppState.getTodos().some(t => t.title === item.title);
  return added
    ? `<span class="step-item__add is-added" aria-label="To-Do에 추가됨" title="To-Do에 추가됨">✓</span>`
    : `<button type="button" class="step-item__add" data-add-todo aria-label="${item.title} To-Do에 추가" title="To-Do에 추가">+</button>`;
}

/**
 * To-Do 추가 팝업 — 제목은 체크리스트 항목 이름으로 채워 두고 고칠 수 있다.
 * 기한은 선택: 앱이 정해 줄 근거가 없어서(처리 기간이 나라·사람마다 다름) 아는 사람만 넣는다.
 * 기한 없는 할 일은 supabase/todos_optional_date.sql이 적용돼야 서버에 저장된다.
 */
function openTodoAddPrompt(title) {
  let scrim = document.getElementById('todoAddScrim');
  const firstTime = !scrim;
  if (firstTime) {
    scrim = document.createElement('div');
    scrim.id = 'todoAddScrim';
    scrim.className = 'modal-scrim';
    document.body.appendChild(scrim);
  }
  const tags = ['서류', '지원', '어학', '기타'];
  scrim.innerHTML = `
    <form class="modal-panel departure-prompt todo-add-prompt" role="dialog" aria-modal="true" aria-labelledby="todoAddTitle">
      <button type="button" class="modal-close" data-modal-close aria-label="닫기">✕</button>
      <h2 class="departure-prompt__title" id="todoAddTitle">To-Do에 추가하기</h2>
      <label class="departure-prompt__field">할 일<input type="text" name="title" value="${prepEsc(title)}" required maxlength="80"></label>
      <label class="departure-prompt__field departure-prompt__field--sub">기한 (선택)<input type="date" name="date"></label>
      <label class="departure-prompt__field departure-prompt__field--sub">분류
        <select name="tag">${tags.map(t => `<option${t === '서류' ? ' selected' : ''}>${t}</option>`).join('')}</select>
      </label>
      <button type="submit" class="btn btn--primary btn--block">추가하기</button>
    </form>`;
  if (firstTime) wireModalDismiss(scrim); else wireModalCloseButtons(scrim);
  openModal(scrim);
  const form = scrim.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const t = String(fd.get('title') || '').trim();
    if (!t) return;
    AppState.addTodo({ title: t, date: fd.get('date') || null, tag: fd.get('tag') });
    closeModal(scrim);
    if (typeof renderTodoCard === 'function') renderTodoCard(document.getElementById('todoCard'));
    renderPrepareChecklist();
    showToast('To-Do에 추가했어요');
  });
}

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
    // 국제처 장학금 목록은 늘 있다 — 기본 안내(living_prep)가 비어 있어도 카드를 둔다
    scholarship: base('scholarship') || { title: '장학금', rows: [] },
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
  // 서류|생활 전환으로 이미 한 카드만 보이니 카드 자체를 접는 버튼은 두지 않는다(묶음별 토글만)
  section.innerHTML = prepCardHead('생활 준비 · 준비물', 'living', '', { noToggle: true }) +
    `<div class="prep-card__body"><p class="prep-card__source">요금·추천·장학금 조건은 조사 시점 기준이라 바뀌었을 수 있어요.<br>가입·신청 전에 공식 안내에서 꼭 직접 확인하세요.</p><div class="prep-groups" id="livingGrid"></div></div>`;
  section.classList.remove('is-collapsed');
  const mount = document.getElementById('livingGrid');
  // 보험은 체크리스트 '해외여행자보험 가입' 항목에 들어 있어 여기선 뺀다
  const keys = ['scholarship', 'telecom', 'bank'].filter(k => cards[k]);
  if (!keys.length) {
    mount.innerHTML = `<p class="info-panel__text">서비스 준비 중이에요.</p>`;
    return;
  }
  const livingOpen = prepRead('living_groups_open', []);
  // 넷을 전부 펼쳐 두면 화면 두 판이 설명문으로 찬다. 제목만 세워 두고 필요한
  // 항목만 열어 보게 한다 — 보험을 알아보는 날과 계좌를 여는 날은 다르다.
  mount.innerHTML = keys.map(k => {
    const d = cards[k];
    // 장학금은 국제처 책자(Ch.10) 목록을 쓴다. 학점처럼 앱이 아는 조건만 미리 견주고,
    // 국적·학자금 구간처럼 받지 않는 정보는 조건 문장으로만 보여준다.
    const scholarshipExtra = k === 'scholarship' ? `
      <div class="scholarship-list">
        ${OIA.SCHOLARSHIPS.map(s => {
          const fit = s.check(AppState.profile, confirmed);
          return `
          <div class="scholarship-row">
            <div class="scholarship-row__name">${prepEsc(s.name)}${fit === true ? ` <span class="badge badge--go">${s.id === 'icu' || s.id === 'housing' ? '해당' : '학점 기준 충족'}</span>` : fit === false ? ' <span class="badge badge--warn">기준 미달</span>' : ''}</div>
            <div class="scholarship-row__amount">${prepEsc(s.amount)} · ${prepEsc(s.when)}</div>
            <div class="scholarship-row__elig">${prepEsc(s.cond)}</div>
          </div>`;
        }).join('')}
        <p class="living-card__note">문의 · 국제처 국제팀 02-2123-4704 / sap@yonsei.ac.kr</p>
      </div>` : '';
    const links = d.source ? prepSourceLinks(d.source) : '';
    // 서류 체크리스트와 같은 꼴 — 묶음 제목 줄을 눌러 접고 편다. 처음엔 접어 두고, 연 것은 기억한다
    const open = livingOpen.includes(k);
    return `
      <div class="prep-group living-group${open ? '' : ' is-collapsed'}" data-living="${k}">
        <h3 class="prep-group__head">
          <button type="button" class="prep-group__title" data-living-toggle aria-expanded="${open}">
            ${prepEsc(d.title)}
            <span class="prep-group__caret" aria-hidden="true">${CHEVRON_SVG}</span>
          </button>
        </h3>
        <div class="living-group__body">
          ${steppyPickHtml((d.rows.find(([l]) => l === '추천') || [])[1])}
          <dl class="living-facts">
            ${d.rows.filter(([l, v]) => v && l !== '추천').map(([label, v]) => `
              <div class="living-facts__row"><dt>${label}</dt><dd>${prepClauses(v)}</dd></div>`).join('')}
            ${d.docs && d.docs.length ? `
              <div class="living-facts__row"><dt>필요 서류</dt><dd>
                <ul class="living-docs">${d.docs.map(x => `<li>${prepEsc(x)}</li>`).join('')}</ul>
              </dd></div>` : ''}
          </dl>
          ${scholarshipExtra}
          ${d.note ? `<p class="living-card__note">${prepClauses(d.note)}</p>` : ''}
          ${d.source && (links || survey) ? `<p class="living-card__source">출처 · ${[links, survey].filter(Boolean).join(' · ')}</p>` : ''}
          ${d.rows.some(([, v]) => v) || (d.docs && d.docs.length) ? '<p class="living-card__verify">조사 시점 기준 정보라 요금·서류가 바뀌었을 수 있어요.<br>신청 전에 공식 사이트에서 꼭 직접 확인하세요.</p>' : ''}
        </div>
      </div>`;
  }).join('');

  mount.querySelectorAll('.living-group').forEach(g => {
    const btn = g.querySelector('[data-living-toggle]');
    btn.addEventListener('click', () => {
      const open = !g.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(open));
      const set = new Set(prepRead('living_groups_open', []));
      if (open) set.add(g.dataset.living); else set.delete(g.dataset.living);
      prepWrite('living_groups_open', [...set]);
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
  document.title = '교환 준비하기 · steppY';
  // 앱 셸로 바꾸면서 renderAppNav()가 renderAppBar()/renderTabBar() 둘로 갈렸는데
  // 이 호출부를 놓쳤다. 정의가 없는 함수라 여기서 ReferenceError가 나면서 바로
  // 아래 renderPrepareView()가 실행되지 않았고, 마크업만 꽂힌 빈 카드들이 남았다.
  renderAppBar('prepare');
  renderTabBar('prepare');
  renderPrepareView();
  // 방금 확정했다면 출국일이 아직 없다 — 다음 화면까지 기다리지 않고 바로 묻는다
  if (typeof ensureDepartureDate === 'function') ensureDepartureDate();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('MOCK:updated', () => {
  if (document.body.dataset.page === 'prepare' && document.getElementById('prepareHero')) renderPrepareView();
});
